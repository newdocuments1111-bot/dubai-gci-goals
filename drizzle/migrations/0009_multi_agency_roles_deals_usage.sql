-- AI Vision 2.0: agencies, members and roles. Existing single-owner data moves into "Demo Agency".
CREATE TABLE public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  plan_logins integer NOT NULL DEFAULT 3 CHECK (plan_logins BETWEEN 1 AND 1000),
  monthly_fee_aed numeric NOT NULL DEFAULT 0 CHECK (monthly_fee_aed >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trial','paused','cancelled')),
  goal_setting_mode text NOT NULL DEFAULT 'both' CHECK (goal_setting_mode IN ('agent','owner','both')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('hq_admin','owner','agent')),
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 200),
  split_percent numeric NOT NULL DEFAULT 50 CHECK (split_percent BETWEEN 0 AND 100),
  annual_gci_goal_aed numeric CHECK (annual_gci_goal_aed IS NULL OR annual_gci_goal_aed >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id, role)
);
CREATE INDEX agency_members_user_idx ON public.agency_members(user_id);
-- A person works for one agency (HQ admin rows are separate).
CREATE UNIQUE INDEX agency_members_one_agency ON public.agency_members(user_id) WHERE role IN ('owner','agent');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_members TO authenticated;
GRANT ALL ON public.agency_members TO service_role;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

INSERT INTO public.agencies(id, name, plan_logins, status, goal_setting_mode)
VALUES ('de000000-0000-4000-8000-000000000001', 'Demo Agency', 10, 'active', 'both');
INSERT INTO public.agency_members(agency_id, user_id, email, role, display_name)
SELECT 'de000000-0000-4000-8000-000000000001', '4d579439-b761-474e-b412-a31428aac258', 'newdocuments1111@gmail.com', r,
  COALESCE((SELECT NULLIF(agent_name, '') FROM public.app_settings WHERE id = 'owner'), 'Owner')
FROM unnest(ARRAY['owner','hq_admin']) AS r;

CREATE FUNCTION public.is_hq_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.agency_members WHERE user_id = auth.uid() AND role = 'hq_admin') $$;
CREATE FUNCTION public.my_agency_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND role IN ('owner','agent') LIMIT 1 $$;
CREATE FUNCTION public.is_agency_member(_agency uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.agency_members WHERE user_id = auth.uid() AND agency_id = _agency AND role IN ('owner','agent')) $$;
CREATE FUNCTION public.is_agency_owner(_agency uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.agency_members WHERE user_id = auth.uid() AND agency_id = _agency AND role = 'owner') $$;

-- agency_id on every business table; existing rows belong to Demo Agency.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['leads','listings','viewings','follow_ups','chat_messages','alerts','owners','payment_schedules','consent_log','document_log','ai_reply_settings','app_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN agency_id uuid NOT NULL DEFAULT %L::uuid REFERENCES public.agencies(id) ON DELETE CASCADE', t, 'de000000-0000-4000-8000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN agency_id SET DEFAULT public.my_agency_id()', t);
    EXECUTE format('CREATE INDEX %I ON public.%I(agency_id)', t || '_agency_idx', t);
  END LOOP;
END $$;

-- Leads: assigned agent + CRM fields the chat fills in.
ALTER TABLE public.leads
  ADD COLUMN assigned_agent_id uuid DEFAULT auth.uid(),
  ADD COLUMN area text NOT NULL DEFAULT '',
  ADD COLUMN budget text NOT NULL DEFAULT '',
  ADD COLUMN timing text NOT NULL DEFAULT '',
  ADD COLUMN next_step text NOT NULL DEFAULT '';
UPDATE public.leads SET assigned_agent_id = '4d579439-b761-474e-b412-a31428aac258',
  area = COALESCE(learned->>'location', ''), budget = COALESCE(learned->>'budget', ''), timing = COALESCE(learned->>'move_in', '');
CREATE INDEX leads_assigned_agent_idx ON public.leads(assigned_agent_id);
ALTER TABLE public.chat_messages ADD COLUMN author_id uuid DEFAULT auth.uid();

-- Settings become one row per agency.
ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_id_check;
ALTER TABLE public.ai_reply_settings DROP CONSTRAINT ai_reply_settings_id_check;
ALTER TABLE public.app_settings ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.ai_reply_settings ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_agency_unique UNIQUE (agency_id);
ALTER TABLE public.ai_reply_settings ADD CONSTRAINT ai_reply_settings_agency_unique UNIQUE (agency_id);
ALTER TABLE public.app_settings
  ADD COLUMN missed_lead_minutes integer NOT NULL DEFAULT 15 CHECK (missed_lead_minutes BETWEEN 1 AND 1440),
  ADD COLUMN minutes_per_ai_reply numeric NOT NULL DEFAULT 2 CHECK (minutes_per_ai_reply BETWEEN 0 AND 120);

-- Calendars and inventory identity are per agency.
DROP INDEX public.viewings_unique_booked_start;
CREATE UNIQUE INDEX viewings_unique_booked_start_per_agency ON public.viewings(agency_id, starts_at) WHERE status = 'booked';
DROP INDEX public.listings_source_external_id;
CREATE UNIQUE INDEX listings_source_external_id_per_agency ON public.listings(agency_id, source, external_id) WHERE external_id IS NOT NULL;

-- Deals and usage.
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL DEFAULT public.my_agency_id() REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL DEFAULT auth.uid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  deal_type text NOT NULL CHECK (deal_type IN ('sale','rent')),
  price_aed numeric NOT NULL CHECK (price_aed >= 0),
  commission_percent numeric NOT NULL CHECK (commission_percent BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'under offer' CHECK (status IN ('under offer','closed','fell through')),
  closed_at timestamptz,
  ai_handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deals_agency_idx ON public.deals(agency_id);
CREATE INDEX deals_agent_idx ON public.deals(agent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('whatsapp_message','ai_reply')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_agency_time_idx ON public.usage_events(agency_id, created_at);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
INSERT INTO public.usage_events(agency_id, type, created_at) SELECT agency_id, 'ai_reply', created_at FROM public.chat_messages WHERE role = 'ai';

CREATE FUNCTION public.can_access_lead(_lead uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = _lead AND (public.is_agency_owner(l.agency_id) OR (public.is_agency_member(l.agency_id) AND l.assigned_agent_id = auth.uid()))) $$;

CREATE FUNCTION public.agency_booked_times() RETURNS SETOF timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT starts_at FROM public.viewings WHERE status = 'booked' AND agency_id = public.my_agency_id() $$;

-- Child rows always take the agency of their lead (or property owner).
CREATE FUNCTION public.set_agency_from_parent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent uuid;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN SELECT agency_id INTO parent FROM public.leads WHERE id = NEW.lead_id; END IF;
  IF parent IS NULL AND TG_TABLE_NAME = 'follow_ups' THEN
    IF NEW.owner_id IS NOT NULL THEN SELECT agency_id INTO parent FROM public.owners WHERE id = NEW.owner_id; END IF;
  END IF;
  IF parent IS NOT NULL THEN NEW.agency_id := parent; END IF;
  IF NEW.agency_id IS NULL THEN RAISE EXCEPTION 'Agency is required.'; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['chat_messages','viewings','follow_ups','alerts','consent_log','payment_schedules'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF lead_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_agency_from_parent()', t || '_set_agency', t);
  END LOOP;
END $$;

CREATE FUNCTION public.check_lead_agent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_agent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.agency_members WHERE agency_id = NEW.agency_id AND user_id = NEW.assigned_agent_id AND role IN ('owner','agent')) THEN
    RAISE EXCEPTION 'Choose an agent from this agency.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leads_check_agent BEFORE INSERT OR UPDATE OF assigned_agent_id, agency_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.check_lead_agent();

CREATE FUNCTION public.prepare_deal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent uuid;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT agency_id INTO parent FROM public.leads WHERE id = NEW.lead_id;
    IF parent IS NULL THEN RAISE EXCEPTION 'Lead not found.'; END IF;
    NEW.agency_id := parent;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agency_members WHERE agency_id = NEW.agency_id AND user_id = NEW.agent_id AND role IN ('owner','agent')) THEN
    RAISE EXCEPTION 'Choose an agent from this agency.';
  END IF;
  IF NEW.listing_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.listings WHERE id = NEW.listing_id AND agency_id = NEW.agency_id) THEN
    RAISE EXCEPTION 'Choose a listing from this agency.';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.lead_id IS DISTINCT FROM OLD.lead_id THEN
    NEW.ai_handled := COALESCE((SELECT m.role = 'ai' FROM public.chat_messages m WHERE m.lead_id = NEW.lead_id AND m.role <> 'client' ORDER BY m.created_at LIMIT 1), false);
  ELSE
    NEW.ai_handled := OLD.ai_handled;
  END IF;
  IF NEW.status = 'closed' THEN NEW.closed_at := COALESCE(NEW.closed_at, now()); ELSE NEW.closed_at := NULL; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER deals_prepare BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.prepare_deal();

-- One usage row per AI reply (billing meter).
CREATE FUNCTION public.log_ai_reply_usage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usage_events(agency_id, type) VALUES (NEW.agency_id, 'ai_reply');
  RETURN NEW;
END $$;
CREATE TRIGGER chat_messages_log_ai_usage AFTER INSERT ON public.chat_messages FOR EACH ROW WHEN (NEW.role = 'ai') EXECUTE FUNCTION public.log_ai_reply_usage();

-- Login limits and goal-setting mode.
CREATE FUNCTION public.enforce_member_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed integer; used integer; mode text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'A member cannot be moved to another login.'; END IF;
  IF NEW.role IN ('owner','agent') AND (TG_OP = 'INSERT' OR OLD.role NOT IN ('owner','agent') OR OLD.agency_id <> NEW.agency_id) THEN
    SELECT plan_logins INTO allowed FROM public.agencies WHERE id = NEW.agency_id FOR UPDATE;
    SELECT count(DISTINCT user_id) INTO used FROM public.agency_members WHERE agency_id = NEW.agency_id AND role IN ('owner','agent') AND user_id <> NEW.user_id;
    IF used >= allowed THEN RAISE EXCEPTION 'Your plan has % logins. Contact Elite Visions to add more.', allowed; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.annual_gci_goal_aed IS DISTINCT FROM OLD.annual_gci_goal_aed AND auth.uid() IS NOT NULL AND NOT public.is_hq_admin() THEN
    SELECT goal_setting_mode INTO mode FROM public.agencies WHERE id = NEW.agency_id;
    IF NEW.user_id = auth.uid() AND mode = 'owner' AND NOT public.is_agency_owner(NEW.agency_id) THEN RAISE EXCEPTION 'In this agency the owner sets goals.'; END IF;
    IF NEW.user_id <> auth.uid() AND mode = 'agent' THEN RAISE EXCEPTION 'In this agency agents set their own goals.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agency_members_rules BEFORE INSERT OR UPDATE ON public.agency_members FOR EACH ROW EXECUTE FUNCTION public.enforce_member_rules();

-- Access rules.
CREATE POLICY "members read their agency" ON public.agencies FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.is_agency_member(id));
CREATE POLICY "hq manages agencies" ON public.agencies FOR ALL TO authenticated USING (public.is_hq_admin()) WITH CHECK (public.is_hq_admin());

CREATE POLICY "members read teammates" ON public.agency_members FOR SELECT TO authenticated USING (public.is_hq_admin() OR user_id = auth.uid() OR public.is_agency_member(agency_id));
CREATE POLICY "hq manages members" ON public.agency_members FOR ALL TO authenticated USING (public.is_hq_admin()) WITH CHECK (public.is_hq_admin());
CREATE POLICY "owners add agents" ON public.agency_members FOR INSERT TO authenticated WITH CHECK (public.is_agency_owner(agency_id) AND role = 'agent');
CREATE POLICY "owners update members" ON public.agency_members FOR UPDATE TO authenticated USING (public.is_agency_owner(agency_id) AND role <> 'hq_admin') WITH CHECK (public.is_agency_owner(agency_id) AND role IN ('owner','agent'));
CREATE POLICY "owners remove agents" ON public.agency_members FOR DELETE TO authenticated USING (public.is_agency_owner(agency_id) AND role = 'agent');

DROP POLICY IF EXISTS "owner manages leads" ON public.leads;
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND assigned_agent_id = auth.uid()));
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND assigned_agent_id = auth.uid()));
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated USING (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND assigned_agent_id = auth.uid())) WITH CHECK (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND assigned_agent_id = auth.uid()));
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated USING (public.is_agency_owner(agency_id));

DROP POLICY IF EXISTS "owner manages chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "owner manages viewings" ON public.viewings;
DROP POLICY IF EXISTS "owner manages follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS "owner manages alerts" ON public.alerts;
DROP POLICY IF EXISTS "owner manages consent log" ON public.consent_log;
DROP POLICY IF EXISTS "owner manages payment schedules" ON public.payment_schedules;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['chat_messages','viewings','follow_ups','alerts','consent_log','payment_schedules'] LOOP
    EXECUTE format('CREATE POLICY "hq reads %s" ON public.%I FOR SELECT TO authenticated USING (public.is_hq_admin())', t, t);
    EXECUTE format('CREATE POLICY "agency manages %s" ON public.%I FOR ALL TO authenticated USING (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND (lead_id IS NULL OR public.can_access_lead(lead_id)))) WITH CHECK (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND (lead_id IS NULL OR public.can_access_lead(lead_id))))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Owner manages listings" ON public.listings;
DROP POLICY IF EXISTS "owner manages owners" ON public.owners;
DROP POLICY IF EXISTS "owner reads and writes document log" ON public.document_log;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['listings','owners','document_log'] LOOP
    EXECUTE format('CREATE POLICY "hq reads %s" ON public.%I FOR SELECT TO authenticated USING (public.is_hq_admin())', t, t);
    EXECUTE format('CREATE POLICY "agency manages %s" ON public.%I FOR ALL TO authenticated USING (public.is_agency_member(agency_id)) WITH CHECK (public.is_agency_member(agency_id))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "owner manages settings" ON public.app_settings;
DROP POLICY IF EXISTS "Owner manages reply settings" ON public.ai_reply_settings;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['app_settings','ai_reply_settings'] LOOP
    EXECUTE format('CREATE POLICY "members read %s" ON public.%I FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.is_agency_member(agency_id))', t, t);
    EXECUTE format('CREATE POLICY "owners insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_agency_owner(agency_id))', t, t);
    EXECUTE format('CREATE POLICY "owners update %s" ON public.%I FOR UPDATE TO authenticated USING (public.is_agency_owner(agency_id)) WITH CHECK (public.is_agency_owner(agency_id))', t, t);
    EXECUTE format('CREATE POLICY "owners delete %s" ON public.%I FOR DELETE TO authenticated USING (public.is_agency_owner(agency_id))', t, t);
  END LOOP;
END $$;

-- Shared reference data: every agency reads, Elite Visions HQ edits.
DROP POLICY IF EXISTS "owner manages market data" ON public.market_transactions;
DROP POLICY IF EXISTS "owner manages knowledge" ON public.uae_knowledge;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['market_transactions','uae_knowledge'] LOOP
    EXECUTE format('CREATE POLICY "members read %s" ON public.%I FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.my_agency_id() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "hq manages %s" ON public.%I FOR ALL TO authenticated USING (public.is_hq_admin()) WITH CHECK (public.is_hq_admin())', t, t);
  END LOOP;
END $$;

CREATE POLICY "deals read" ON public.deals FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND (agent_id = auth.uid() OR (lead_id IS NOT NULL AND public.can_access_lead(lead_id)))));
CREATE POLICY "deals insert" ON public.deals FOR INSERT TO authenticated WITH CHECK (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND agent_id = auth.uid()));
CREATE POLICY "deals update" ON public.deals FOR UPDATE TO authenticated USING (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND agent_id = auth.uid())) WITH CHECK (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND agent_id = auth.uid()));
CREATE POLICY "deals delete" ON public.deals FOR DELETE TO authenticated USING (public.is_agency_owner(agency_id));

CREATE POLICY "owners read usage" ON public.usage_events FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.is_agency_owner(agency_id));

-- Files: chat media by lead, vault by agency folder, listing media by agency folder (old single-level files belong to Demo Agency).
CREATE FUNCTION public.storage_path_access(_bucket text, _name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE parts text[] := string_to_array(_name, '/'); target uuid;
BEGIN
  IF _bucket = 'chat-media' THEN
    BEGIN target := parts[1]::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.can_access_lead(target);
  ELSIF _bucket = 'documents' THEN
    BEGIN target := parts[1]::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.is_agency_member(target);
  ELSIF _bucket IN ('listing-media','listing-photos') THEN
    IF array_length(parts, 1) >= 3 THEN
      BEGIN target := parts[2]::uuid; EXCEPTION WHEN others THEN RETURN false; END;
      RETURN public.is_agency_member(target);
    END IF;
    RETURN public.is_agency_member('de000000-0000-4000-8000-000000000001'::uuid);
  END IF;
  RETURN false;
END $$;
DROP POLICY IF EXISTS "Owner manages private listing media" ON storage.objects;
DROP POLICY IF EXISTS "Owner manages shareable photos" ON storage.objects;
DROP POLICY IF EXISTS "owner manages document vault files" ON storage.objects;
DROP POLICY IF EXISTS "owner chat media" ON storage.objects;
CREATE POLICY "agency members manage app files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('chat-media','documents','listing-media','listing-photos') AND public.storage_path_access(bucket_id, name))
  WITH CHECK (bucket_id IN ('chat-media','documents','listing-media','listing-photos') AND public.storage_path_access(bucket_id, name));
CREATE POLICY "hq reads app files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('chat-media','documents','listing-media','listing-photos') AND public.is_hq_admin());

-- Onboarding and goal RPCs.
CREATE FUNCTION public.create_my_agency(_name text, _display_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; uid uuid := auth.uid(); clean_name text := btrim(COALESCE(_name, '')); person text := left(btrim(COALESCE(_display_name, '')), 200);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  IF EXISTS (SELECT 1 FROM public.agency_members WHERE user_id = uid AND role IN ('owner','agent')) THEN RAISE EXCEPTION 'You already belong to an agency.'; END IF;
  IF char_length(clean_name) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Enter your agency name.'; END IF;
  INSERT INTO public.agencies(name, status) VALUES (clean_name, 'trial') RETURNING id INTO new_id;
  INSERT INTO public.agency_members(agency_id, user_id, email, role, display_name) VALUES (new_id, uid, COALESCE(auth.jwt()->>'email', ''), 'owner', person);
  INSERT INTO public.app_settings(id, agency_id, agency_name, agent_name) VALUES (new_id::text, new_id, clean_name, person);
  INSERT INTO public.ai_reply_settings(id, agency_id, agency_name) VALUES (new_id::text, new_id, clean_name);
  RETURN new_id;
END $$;

CREATE FUNCTION public.set_goal_setting_mode(_mode text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.my_agency_id();
BEGIN
  IF a IS NULL OR NOT public.is_agency_owner(a) THEN RAISE EXCEPTION 'Only the agency owner can change this.'; END IF;
  IF _mode NOT IN ('agent','owner','both') THEN RAISE EXCEPTION 'Choose who sets goals.'; END IF;
  UPDATE public.agencies SET goal_setting_mode = _mode WHERE id = a;
END $$;

CREATE FUNCTION public.set_my_goal(_goal numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid := public.my_agency_id(); mode text;
BEGIN
  IF a IS NULL THEN RAISE EXCEPTION 'Join an agency first.'; END IF;
  IF _goal IS NULL OR _goal < 0 OR _goal > 1000000000 THEN RAISE EXCEPTION 'Enter a goal between 0 and 1,000,000,000 AED.'; END IF;
  SELECT goal_setting_mode INTO mode FROM public.agencies WHERE id = a;
  IF mode = 'owner' AND NOT public.is_agency_owner(a) THEN RAISE EXCEPTION 'In this agency the owner sets goals.'; END IF;
  UPDATE public.agency_members SET annual_gci_goal_aed = _goal WHERE user_id = auth.uid() AND agency_id = a AND role IN ('owner','agent');
END $$;

-- HQ overview (runs with the caller's access; returns nothing unless HQ).
CREATE FUNCTION public.hq_agency_overview() RETURNS TABLE(
  agency_id uuid, agency_name text, status text, plan_logins integer, monthly_fee_aed numeric, logins_used bigint,
  leads bigint, ai_replies bigint, viewings bigint, deals bigint, closed_gci_aed numeric,
  ai_replies_month bigint, whatsapp_month bigint, missed_leads bigint, flagged_chats bigint
) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT a.id, a.name, a.status, a.plan_logins, a.monthly_fee_aed,
    (SELECT count(DISTINCT m.user_id) FROM public.agency_members m WHERE m.agency_id = a.id AND m.role IN ('owner','agent')),
    (SELECT count(*) FROM public.leads l WHERE l.agency_id = a.id),
    (SELECT count(*) FROM public.usage_events u WHERE u.agency_id = a.id AND u.type = 'ai_reply'),
    (SELECT count(*) FROM public.viewings v WHERE v.agency_id = a.id),
    (SELECT count(*) FROM public.deals d WHERE d.agency_id = a.id),
    (SELECT COALESCE(sum(d.price_aed * d.commission_percent / 100), 0) FROM public.deals d WHERE d.agency_id = a.id AND d.status = 'closed'),
    (SELECT count(*) FROM public.usage_events u WHERE u.agency_id = a.id AND u.type = 'ai_reply' AND u.created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai')),
    (SELECT count(*) FROM public.usage_events u WHERE u.agency_id = a.id AND u.type = 'whatsapp_message' AND u.created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai')),
    (SELECT count(*) FROM public.alerts al WHERE al.agency_id = a.id AND al.kind = 'missed' AND NOT al.read),
    (SELECT count(*) FROM public.leads l WHERE l.agency_id = a.id AND l.flagged)
  FROM public.agencies a WHERE public.is_hq_admin() ORDER BY a.created_at $$;

-- Missed-lead alerts: last client message unanswered for longer than the agency setting.
-- Checked when the home or HQ screen opens (alerts are only shown in the app).
CREATE FUNCTION public.check_missed_leads() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; hq boolean := public.is_hq_admin(); a uuid := public.my_agency_id();
BEGIN
  IF NOT hq AND a IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.alerts(agency_id, lead_id, kind, message)
  SELECT l.agency_id, l.id, 'missed', 'Missed lead: ' || COALESCE(NULLIF(l.name, ''), 'A lead') || ' has waited more than ' || COALESCE(s.missed_lead_minutes, 15) || ' minutes for a reply.'
  FROM public.leads l
  JOIN LATERAL (SELECT max(created_at) AS at FROM public.chat_messages WHERE lead_id = l.id AND role = 'client') c ON c.at IS NOT NULL
  LEFT JOIN public.app_settings s ON s.agency_id = l.agency_id
  WHERE (hq OR l.agency_id = a) AND NOT l.stopped
    AND c.at > now() - interval '7 days'
    AND c.at < now() - make_interval(mins => COALESCE(s.missed_lead_minutes, 15))
    AND NOT EXISTS (SELECT 1 FROM public.chat_messages r WHERE r.lead_id = l.id AND r.role <> 'client' AND r.created_at >= c.at)
    AND NOT EXISTS (SELECT 1 FROM public.alerts x WHERE x.lead_id = l.id AND x.kind = 'missed' AND x.created_at >= c.at);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Existing procedures now follow agency access instead of one email.
CREATE OR REPLACE FUNCTION public.draft_old_lead_revivals() RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$ DECLARE n integer; a uuid := public.my_agency_id(); BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'Agency access required'; END IF;
 INSERT INTO public.follow_ups(lead_id, kind, draft, status, send_after)
 SELECT id, 'revival', 'Hello ' || COALESCE(NULLIF(name, ''), 'there') || ', I hope you are well. Are you still looking for a property in Dubai? No pressure — let me know if your plans have changed.', 'pending', now()
 FROM public.leads WHERE agency_id = a AND opted_in = true AND stopped = false AND last_message_at < now() - interval '30 days'
 ON CONFLICT (lead_id) WHERE kind = 'revival' DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END; $$;

CREATE OR REPLACE FUNCTION public.approve_chat_follow_up(p_id uuid, p_draft text) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$ DECLARE f public.follow_ups; l public.leads; BEGIN
 IF auth.uid() IS NULL OR public.my_agency_id() IS NULL THEN RAISE EXCEPTION 'Agency access required'; END IF;
 SELECT * INTO f FROM public.follow_ups WHERE id = p_id AND agency_id = public.my_agency_id() FOR UPDATE;
 IF NOT FOUND OR f.status <> 'pending' THEN RAISE EXCEPTION 'Draft is no longer pending'; END IF;
 IF f.send_after IS NOT NULL AND f.send_after > now() THEN RAISE EXCEPTION 'This follow-up is not due yet'; END IF;
 IF f.lead_id IS NOT NULL THEN
 SELECT * INTO l FROM public.leads WHERE id = f.lead_id FOR UPDATE;
 IF NOT FOUND OR l.stopped OR (f.kind = 'revival' AND NOT l.opted_in) THEN RAISE EXCEPTION 'Client has not agreed to contact or has stopped messages'; END IF;
 INSERT INTO public.chat_messages(lead_id, role, content, sent) VALUES (l.id, 'ai', p_draft, true);
 UPDATE public.leads SET last_message_at = now() WHERE id = l.id;
 END IF;
 UPDATE public.follow_ups SET draft = p_draft, status = 'sent' WHERE id = p_id;
 END; $$;

CREATE OR REPLACE FUNCTION public.draft_scheduled_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  INSERT INTO public.follow_ups (agency_id, lead_id, kind, draft, send_after, status)
  SELECT l.agency_id, v.lead_id, 'viewing_reminder',
    'Good evening! Just a friendly reminder about your ' || v.kind || ' tomorrow at ' || to_char(v.starts_at AT TIME ZONE 'Asia/Dubai', 'HH24:MI') || ' (Dubai time). Looking forward to it!',
    v.starts_at, 'pending'
  FROM public.viewings v JOIN public.leads l ON l.id = v.lead_id
  WHERE v.status = 'booked' AND NOT v.reminder_sent
    AND (v.starts_at AT TIME ZONE l.timezone)::date = (now() AT TIME ZONE l.timezone)::date + 1
    AND EXTRACT(hour FROM now() AT TIME ZONE l.timezone) >= 18;
  UPDATE public.viewings v SET reminder_sent = true
  FROM public.leads l WHERE l.id = v.lead_id AND v.status = 'booked' AND NOT v.reminder_sent
    AND (v.starts_at AT TIME ZONE l.timezone)::date = (now() AT TIME ZONE l.timezone)::date + 1
    AND EXTRACT(hour FROM now() AT TIME ZONE l.timezone) >= 18;

  INSERT INTO public.follow_ups (agency_id, owner_id, kind, draft, send_after, status)
  SELECT o.agency_id, o.id, 'lease_reminder',
    'Lease reminder: ' || o.name || '''s lease in ' || o.area || ' (' || o.building || ') ends in 120 days. Time to discuss renewal.',
    o.lease_end::timestamptz, 'pending'
  FROM public.owners o
  WHERE o.lease_end = (now() AT TIME ZONE 'Asia/Dubai')::date + 120
    AND NOT EXISTS (SELECT 1 FROM public.follow_ups f WHERE f.kind = 'lease_reminder' AND f.owner_id = o.id AND f.send_after::date = o.lease_end);

  INSERT INTO public.follow_ups (agency_id, owner_id, kind, draft, send_after, status)
  SELECT o.agency_id, o.id, 'anniversary_reminder',
    'Home anniversary: ' || o.name || '''s home in ' || o.area || ' (' || o.building || ') completes another year in 7 days. A warm check-in message is due.',
    (make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM o.handover_date)::int, EXTRACT(day FROM o.handover_date)::int))::timestamptz, 'pending'
  FROM public.owners o
  WHERE o.handover_date IS NOT NULL
    AND make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM o.handover_date)::int, EXTRACT(day FROM o.handover_date)::int) = (now() AT TIME ZONE 'Asia/Dubai')::date + 7
    AND NOT EXISTS (SELECT 1 FROM public.follow_ups f WHERE f.kind = 'anniversary_reminder' AND f.owner_id = o.id AND f.send_after::date = make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM o.handover_date)::int, EXTRACT(day FROM o.handover_date)::int));

  INSERT INTO public.follow_ups (agency_id, lead_id, kind, draft, send_after, status)
  SELECT p.agency_id, p.lead_id, 'payment_reminder',
    'Payment reminder: ' || p.label || ' of AED ' || to_char(p.amount_aed, 'FM999,999,999') || ' is due in 7 days' || COALESCE(' (' || p.milestone || ')', '') || '.',
    p.due_date::timestamptz, 'pending'
  FROM public.payment_schedules p
  WHERE NOT p.paid AND p.due_date = (now() AT TIME ZONE 'Asia/Dubai')::date + 7
    AND NOT EXISTS (SELECT 1 FROM public.follow_ups f WHERE f.kind = 'payment_reminder' AND f.agency_id = p.agency_id AND f.draft LIKE '%' || p.label || '%' AND f.send_after::date = p.due_date);
END;
$function$;

REVOKE ALL ON FUNCTION public.is_hq_admin(), public.my_agency_id(), public.is_agency_member(uuid), public.is_agency_owner(uuid), public.can_access_lead(uuid), public.agency_booked_times(), public.storage_path_access(text, text), public.create_my_agency(text, text), public.set_goal_setting_mode(text), public.set_my_goal(numeric), public.hq_agency_overview(), public.check_missed_leads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hq_admin(), public.my_agency_id(), public.is_agency_member(uuid), public.is_agency_owner(uuid), public.can_access_lead(uuid), public.agency_booked_times(), public.storage_path_access(text, text), public.create_my_agency(text, text), public.set_goal_setting_mode(text), public.set_my_goal(numeric), public.hq_agency_overview(), public.check_missed_leads() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_agency_from_parent(), public.check_lead_agent(), public.prepare_deal(), public.log_ai_reply_usage(), public.enforce_member_rules() FROM PUBLIC, anon, authenticated;