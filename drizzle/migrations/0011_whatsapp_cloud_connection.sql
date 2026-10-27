-- WhatsApp Cloud API (Meta, direct): per-agency settings, durable webhook inbox, delivery tracking.
CREATE TABLE public.whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL DEFAULT '' CHECK (phone_number_id ~ '^[0-9]{0,30}$'),
  waba_id text NOT NULL DEFAULT '' CHECK (waba_id ~ '^[0-9]{0,30}$'),
  display_number text NOT NULL DEFAULT '' CHECK (char_length(display_number) <= 40),
  status text NOT NULL DEFAULT 'not_checked' CHECK (status IN ('not_checked','connected','error')),
  status_detail text NOT NULL DEFAULT '' CHECK (char_length(status_detail) <= 500),
  test_mode boolean NOT NULL DEFAULT true,
  test_recipients text[] NOT NULL DEFAULT '{}' CHECK (cardinality(test_recipients) <= 20 AND array_to_string(test_recipients, ',') ~ '^([0-9]{6,15}(,[0-9]{6,15})*)?$'),
  last_webhook_at timestamptz,
  checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX whatsapp_settings_phone_unique ON public.whatsapp_settings(phone_number_id) WHERE phone_number_id <> '';
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read whatsapp settings" ON public.whatsapp_settings FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.is_agency_member(agency_id));
CREATE POLICY "hq adds whatsapp settings" ON public.whatsapp_settings FOR INSERT TO authenticated WITH CHECK (public.is_hq_admin());
CREATE POLICY "hq changes whatsapp settings" ON public.whatsapp_settings FOR UPDATE TO authenticated USING (public.is_hq_admin()) WITH CHECK (public.is_hq_admin());

INSERT INTO public.whatsapp_settings(agency_id, phone_number_id, waba_id, display_number, test_mode, test_recipients)
VALUES ('de000000-0000-4000-8000-000000000001', '1429713293548712', '1135797042296710', '+1 555 172 9366 (Meta test number)', true, ARRAY['919989649633','918328448065']);

-- Durable inbox: one row per incoming message / status / other change, deduplicated by delivery_key.
CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE CHECK (char_length(delivery_key) <= 300),
  kind text NOT NULL CHECK (kind IN ('message','status','other')),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL DEFAULT '',
  wa_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  outcome text NOT NULL DEFAULT '' CHECK (char_length(outcome) <= 500),
  processing_error text CHECK (char_length(processing_error) <= 1000),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_until timestamptz
);
CREATE INDEX whatsapp_events_pending_idx ON public.whatsapp_webhook_events(next_attempt_at) WHERE processed_at IS NULL;
CREATE INDEX whatsapp_events_wa_id_idx ON public.whatsapp_webhook_events(wa_id);
CREATE INDEX whatsapp_events_agency_idx ON public.whatsapp_webhook_events(agency_id, received_at DESC);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read whatsapp events" ON public.whatsapp_webhook_events FOR SELECT TO authenticated USING (public.is_hq_admin() OR public.is_agency_owner(agency_id));

-- Messages know their channel and WhatsApp delivery state.
ALTER TABLE public.chat_messages
  ADD COLUMN channel text NOT NULL DEFAULT 'app' CHECK (channel IN ('app','whatsapp')),
  ADD COLUMN wa_message_id text CHECK (char_length(wa_message_id) <= 200),
  ADD COLUMN in_reply_to text CHECK (char_length(in_reply_to) <= 200),
  ADD COLUMN wa_status text CHECK (wa_status IN ('sending','accepted','sent','delivered','read','failed')),
  ADD COLUMN wa_error text CHECK (char_length(wa_error) <= 1000),
  ADD COLUMN wa_sent_at timestamptz,
  ADD COLUMN wa_delivered_at timestamptz,
  ADD COLUMN wa_read_at timestamptz,
  ADD COLUMN wa_failed_at timestamptz;
CREATE UNIQUE INDEX chat_messages_wa_message_id_unique ON public.chat_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE UNIQUE INDEX chat_messages_one_reply_per_inbound ON public.chat_messages(in_reply_to) WHERE in_reply_to IS NOT NULL;

ALTER TABLE public.leads ADD COLUMN whatsapp_last_inbound_at timestamptz;
CREATE INDEX leads_agency_phone_idx ON public.leads(agency_id, phone);

-- Billing meter: one whatsapp_message row per WhatsApp message in, and per message Meta accepted out.
CREATE FUNCTION public.log_whatsapp_usage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.channel = 'whatsapp' AND NEW.wa_message_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.wa_message_id IS NULL) THEN
    INSERT INTO public.usage_events(agency_id, type) VALUES (NEW.agency_id, 'whatsapp_message');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_whatsapp_usage() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chat_messages_log_whatsapp_usage AFTER INSERT OR UPDATE OF wa_message_id ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_whatsapp_usage();

-- Claim the given inbox rows plus a few overdue ones (recovery), so two deliveries never process the same row at once.
CREATE FUNCTION public.claim_whatsapp_events(p_ids uuid[], p_extra integer) RETURNS SETOF public.whatsapp_webhook_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH a AS (
    SELECT w.id FROM public.whatsapp_webhook_events w
    WHERE w.id = ANY(p_ids) AND w.processed_at IS NULL AND (w.claimed_until IS NULL OR w.claimed_until < now())
    FOR UPDATE SKIP LOCKED
  ), b AS (
    SELECT w.id FROM public.whatsapp_webhook_events w
    WHERE NOT (w.id = ANY(p_ids)) AND w.processed_at IS NULL AND w.attempts < 8 AND w.next_attempt_at <= now()
      AND (w.claimed_until IS NULL OR w.claimed_until < now())
    ORDER BY w.next_attempt_at LIMIT greatest(0, least(p_extra, 5))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.whatsapp_webhook_events e SET claimed_until = now() + interval '90 seconds', attempts = e.attempts + 1
  WHERE e.id IN (SELECT id FROM a UNION SELECT id FROM b)
  RETURNING e.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_events(uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_events(uuid[], integer) TO service_role;

-- Apply a delivery status: never move backwards (an old "sent" cannot overwrite "read"), keep Meta's first time for each state.
CREATE FUNCTION public.apply_whatsapp_status(p_wa_id text, p_status text, p_at timestamptz, p_error text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.chat_messages; old_rank int; new_rank int;
BEGIN
  IF p_status NOT IN ('sent','delivered','read','failed') THEN RETURN true; END IF;
  SELECT * INTO m FROM public.chat_messages WHERE wa_message_id = p_wa_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  old_rank := CASE m.wa_status WHEN 'sent' THEN 1 WHEN 'failed' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END;
  new_rank := CASE p_status WHEN 'sent' THEN 1 WHEN 'failed' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 END;
  UPDATE public.chat_messages SET
    wa_status = CASE WHEN new_rank > old_rank OR (p_status = 'failed' AND old_rank < 2) THEN p_status ELSE wa_status END,
    wa_error = CASE WHEN p_status = 'failed' THEN COALESCE(left(p_error, 1000), wa_error) ELSE wa_error END,
    wa_sent_at = CASE WHEN p_status = 'sent' THEN COALESCE(wa_sent_at, p_at) ELSE wa_sent_at END,
    wa_delivered_at = CASE WHEN p_status = 'delivered' THEN COALESCE(wa_delivered_at, p_at) ELSE wa_delivered_at END,
    wa_read_at = CASE WHEN p_status = 'read' THEN COALESCE(wa_read_at, p_at) ELSE wa_read_at END,
    wa_failed_at = CASE WHEN p_status = 'failed' THEN COALESCE(wa_failed_at, p_at) ELSE wa_failed_at END
  WHERE id = m.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apply_whatsapp_status(text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_whatsapp_status(text, text, timestamptz, text) TO service_role;