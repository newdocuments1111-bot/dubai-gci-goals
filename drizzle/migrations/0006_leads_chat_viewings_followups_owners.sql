CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'buyer' CHECK (type IN ('buyer','seller','landlord','tenant','other')),
  source text NOT NULL DEFAULT 'Other' CHECK (source IN ('Bayut','Property Finder','Instagram','WhatsApp','Website','Referral','Other')),
  score text NOT NULL DEFAULT 'Cold' CHECK (score IN ('Hot','Warm','Cold')),
  learned jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'Asia/Dubai',
  ai_paused boolean NOT NULL DEFAULT false,
  flagged boolean NOT NULL DEFAULT false,
  opted_in boolean NOT NULL DEFAULT false,
  stopped boolean NOT NULL DEFAULT false,
  hubspot_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages leads" ON public.leads FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('client','ai','owner','system')),
  content text NOT NULL,
  original_content text,
  language text NOT NULL DEFAULT 'en',
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_lead_idx ON public.chat_messages (lead_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages chat messages" ON public.chat_messages FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agreed_to text NOT NULL,
  how text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.consent_log TO authenticated;
GRANT ALL ON public.consent_log TO service_role;
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages consent log" ON public.consent_log FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'viewing' CHECK (kind IN ('viewing','valuation')),
  starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','done','no-show','cancelled')),
  reminder_sent boolean NOT NULL DEFAULT false,
  followup_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewings TO authenticated;
GRANT ALL ON public.viewings TO service_role;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages viewings" ON public.viewings FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id uuid,
  kind text NOT NULL DEFAULT 'follow-up' CHECK (kind IN ('follow-up','payment-reminder','milestone-update','value-update','anniversary','lease-reminder','revival')),
  draft text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','cancelled','sent')),
  send_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages follow ups" ON public.follow_ups FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  agreed_to_updates boolean NOT NULL DEFAULT false,
  handover_date date,
  kind text NOT NULL DEFAULT 'owner' CHECK (kind IN ('owner','investor')),
  update_frequency text NOT NULL DEFAULT 'quarterly' CHECK (update_frequency IN ('quarterly','monthly')),
  area text NOT NULL DEFAULT '',
  building text NOT NULL DEFAULT '',
  lease_end date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages owners" ON public.owners FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  label text NOT NULL,
  amount_aed numeric NOT NULL CHECK (amount_aed >= 0),
  due_date date NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  milestone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_schedules TO authenticated;
GRANT ALL ON public.payment_schedules TO service_role;
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages payment schedules" ON public.payment_schedules FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('hot','aml')),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages alerts" ON public.alerts FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');