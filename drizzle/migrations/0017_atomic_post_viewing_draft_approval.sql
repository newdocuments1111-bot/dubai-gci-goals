CREATE UNIQUE INDEX followups_viewing_kind_unique ON public.follow_ups(viewing_id,kind);
CREATE FUNCTION public.claim_viewing_followup(p_id uuid,p_draft text) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE f public.follow_ups; l public.leads; message_id uuid; first_at timestamptz; c public.consent_log;
BEGIN
 SELECT * INTO f FROM public.follow_ups WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR f.kind NOT IN ('viewing_followup','viewing_2day') OR f.status<>'pending' OR NOT public.can_access_lead(f.lead_id) THEN RAISE EXCEPTION 'Draft is not available for approval'; END IF;
 SELECT * INTO l FROM public.leads WHERE id=f.lead_id FOR UPDATE;
 SELECT * INTO c FROM public.consent_log WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1;
 IF l.stopped OR NOT l.opted_in OR c.id IS NULL OR c.agreed_to !~* '(agreed|consent|opt.?in)' OR c.agreed_to ~* '(withdr|stop|revok|declin|not agreed)' THEN RAISE EXCEPTION 'Client has not agreed to contact or has stopped messages'; END IF;
 IF f.send_after>now() THEN RAISE EXCEPTION 'This follow-up is not due yet'; END IF;
 IF extract(hour FROM now() AT TIME ZONE l.timezone)<8 OR extract(hour FROM now() AT TIME ZONE l.timezone)>=21 OR extract(hour FROM now() AT TIME ZONE 'Asia/Dubai')<9 OR extract(hour FROM now() AT TIME ZONE 'Asia/Dubai')>=20 THEN RAISE EXCEPTION 'Client quiet hours or outside 9am–8pm Dubai sending hours'; END IF;
 IF f.kind='viewing_2day' THEN
 SELECT coalesce(sent_at,send_after,created_at) INTO first_at FROM public.follow_ups WHERE viewing_id=f.viewing_id AND kind='viewing_followup' AND status IN ('pending','sent');
 IF first_at IS NULL OR first_at>now()-interval '48 hours' OR EXISTS(SELECT 1 FROM public.chat_messages WHERE lead_id=l.id AND role='client' AND created_at>first_at) THEN RAISE EXCEPTION 'Client replied or the follow-up is not due'; END IF;
 END IF;
 IF l.whatsapp_last_inbound_at IS NOT NULL THEN
 IF l.whatsapp_last_inbound_at<=now()-interval '24 hours' THEN RAISE EXCEPTION 'The WhatsApp 24-hour window is closed. Use Send template on the lead page with an approved template; this free-form draft cannot be sent.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_settings s WHERE s.agency_id=l.agency_id AND nullif(s.phone_number_id,'') IS NOT NULL AND (NOT s.test_mode OR regexp_replace(l.phone,'[^0-9]','','g') IN (SELECT regexp_replace(x,'[^0-9]','','g') FROM unnest(s.test_recipients) x))) THEN RAISE EXCEPTION 'WhatsApp is not set up or test-recipient safety list blocks this number'; END IF;
 END IF;
 INSERT INTO public.chat_messages(lead_id,role,content,language,author_id,sent,channel) VALUES(l.id,'owner',p_draft,l.language,auth.uid(),l.whatsapp_last_inbound_at IS NULL,CASE WHEN l.whatsapp_last_inbound_at IS NULL THEN 'app' ELSE 'whatsapp' END) RETURNING id INTO message_id;
 UPDATE public.follow_ups SET draft=p_draft,status=CASE WHEN l.whatsapp_last_inbound_at IS NULL THEN 'sent' ELSE 'sending' END,chat_message_id=message_id,sent_at=CASE WHEN l.whatsapp_last_inbound_at IS NULL THEN now() ELSE NULL END WHERE id=f.id;
 RETURN message_id;
END; $$;
REVOKE ALL ON FUNCTION public.claim_viewing_followup(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_viewing_followup(uuid,text) TO authenticated,service_role;