-- WhatsApp part 2: approved message templates and a send queue that re-checks every rule before each send.
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL DEFAULT public.my_agency_id() REFERENCES public.agencies(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  name text NOT NULL CHECK (name ~ '^[a-z0-9_]{1,250}$'),
  language text NOT NULL DEFAULT 'en' CHECK (language ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  category text NOT NULL CHECK (category IN ('marketing','utility')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1024),
  variables text[] NOT NULL DEFAULT '{}',
  examples jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_body text NOT NULL DEFAULT '' CHECK (char_length(meta_body) <= 1024),
  meta_template_id text CHECK (char_length(meta_template_id) <= 100),
  meta_status text NOT NULL DEFAULT 'draft' CHECK (meta_status IN ('draft','pending','approved','rejected','paused','disabled')),
  rejection_reason text CHECK (char_length(rejection_reason) <= 500),
  submitted_at timestamptz,
  status_checked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, name, language)
);
COMMENT ON COLUMN public.message_templates.variables IS 'Token for each Meta position: variables[1] fills {{1}} in meta_body.';
CREATE UNIQUE INDEX message_templates_meta_id_unique ON public.message_templates(meta_template_id) WHERE meta_template_id IS NOT NULL;
GRANT SELECT ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read templates" ON public.message_templates FOR SELECT TO authenticated
  USING (public.is_hq_admin() OR public.is_agency_member(agency_id));

ALTER TABLE public.whatsapp_settings
  ADD COLUMN send_mode text NOT NULL DEFAULT 'approve' CHECK (send_mode IN ('approve','auto')),
  ADD COLUMN marketing_gap_days integer NOT NULL DEFAULT 7 CHECK (marketing_gap_days BETWEEN 1 AND 90);

CREATE TABLE public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  template_name text NOT NULL DEFAULT '' CHECK (char_length(template_name) <= 250),
  category text NOT NULL DEFAULT 'utility' CHECK (category IN ('marketing','utility')),
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview text NOT NULL DEFAULT '' CHECK (char_length(preview) <= 2000),
  purpose text NOT NULL DEFAULT 'manual' CHECK (purpose IN ('manual','listing_match','launch','renewal','referral')),
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','scheduled','sent','failed','cancelled','blocked')),
  block_reason text CHECK (char_length(block_reason) <= 500),
  send_after timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  error text CHECK (char_length(error) <= 1000),
  wa_message_id text CHECK (char_length(wa_message_id) <= 200),
  chat_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  attempts integer NOT NULL DEFAULT 0,
  claimed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_outbox_due_idx ON public.whatsapp_outbox(send_after) WHERE status IN ('approved','scheduled');
CREATE INDEX whatsapp_outbox_agency_idx ON public.whatsapp_outbox(agency_id, created_at DESC);
CREATE INDEX whatsapp_outbox_lead_sent_idx ON public.whatsapp_outbox(lead_id, sent_at DESC) WHERE status = 'sent';
GRANT SELECT ON public.whatsapp_outbox TO authenticated;
GRANT ALL ON public.whatsapp_outbox TO service_role;
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue read" ON public.whatsapp_outbox FOR SELECT TO authenticated
  USING (public.is_hq_admin() OR public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND public.can_access_lead(lead_id)));
CREATE TRIGGER whatsapp_outbox_set_agency BEFORE INSERT OR UPDATE OF lead_id ON public.whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_agency_from_parent();

-- Claim due queue items so two runs never send the same item at once.
CREATE FUNCTION public.claim_whatsapp_outbox(p_ids uuid[], p_limit integer) RETURNS SETOF public.whatsapp_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH c AS (
    SELECT o.id FROM public.whatsapp_outbox o
    WHERE o.status IN ('approved','scheduled') AND o.send_after <= now()
      AND (o.claimed_until IS NULL OR o.claimed_until < now())
      AND (p_ids IS NULL OR o.id = ANY(p_ids))
    ORDER BY o.send_after LIMIT greatest(1, least(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.whatsapp_outbox o SET claimed_until = now() + interval '2 minutes', attempts = o.attempts + 1, updated_at = now()
  WHERE o.id IN (SELECT id FROM c)
  RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_outbox(uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_outbox(uuid[], integer) TO service_role;
