CREATE FUNCTION public.client_reply_text(p_lang text,p_key text,p_latin boolean DEFAULT false) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $fn$ SELECT ($json${"en":{"secondFollowUp":"Hi! I hope you’re doing well. Would you like another viewing?","secondWithListings":"Hi! I hope you’re doing well. These similar options are within your budget: {listings}. Would you like to view either?"},"ar":{"secondFollowUp":"مرحباً! أتمنى أن تكون بخير. هل ترغب في معاينة أخرى؟","secondWithListings":"مرحباً! أتمنى أن تكون بخير. هذه خيارات مشابهة ضمن ميزانيتك: {listings}. هل ترغب في معاينة أحدها؟"},"hi":{"secondFollowUp":"नमस्ते! उम्मीद है आप अच्छे हैं। क्या आप एक और प्रॉपर्टी देखना चाहेंगे?","secondWithListings":"नमस्ते! उम्मीद है आप अच्छे हैं। ये मिलते-जुलते विकल्प आपके बजट में हैं: {listings}। क्या आप इनमें से कोई देखना चाहेंगे?"},"ru":{"secondFollowUp":"Здравствуйте! Надеюсь, у вас всё хорошо. Хотели бы вы посмотреть ещё один объект?","secondWithListings":"Здравствуйте! Надеюсь, у вас всё хорошо. Эти похожие варианты укладываются в ваш бюджет: {listings}. Хотели бы вы посмотреть один из них?"},"hiLatin":{"secondFollowUp":"Namaste! Umeed hai aap achhe hain. Kya aap ek aur property dekhna chahenge?","secondWithListings":"Namaste! Umeed hai aap achhe hain. Yeh milte-julte options aapke budget mein hain: {listings}. Kya aap inmein se koi dekhna chahenge?"}}$json$::jsonb)->(CASE WHEN p_lang='hi' AND p_latin THEN 'hiLatin' WHEN p_lang IN ('en','ar','hi','ru') THEN p_lang ELSE 'en' END)->>p_key $fn$;
REVOKE ALL ON FUNCTION public.client_reply_text(text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_reply_text(text,text,boolean) TO authenticated,service_role;
CREATE FUNCTION public.draft_second_viewing_followups() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; options text; budget_text text; ceiling_aed numeric; text_reply text; inserted integer:=0; affected integer;
BEGIN
 IF NOT pg_try_advisory_xact_lock(7238102) THEN RETURN 0; END IF;
 FOR r IN SELECT v.id AS viewing_id,v.listing_id,l.*,coalesce(f.sent_at,f.send_after,f.created_at) AS first_at
 FROM public.viewings v JOIN public.leads l ON l.id=v.lead_id
 JOIN public.follow_ups f ON f.viewing_id=v.id AND f.kind='viewing_followup' AND f.status IN ('pending','sent')
 WHERE v.status='done' AND NOT l.stopped AND l.opted_in
 AND coalesce(f.sent_at,f.send_after,f.created_at)<=now()-interval '48 hours'
 AND EXISTS(SELECT 1 FROM public.consent_log c WHERE c.lead_id=l.id AND c.agreed_to ~* '(agreed|consent|opt.?in)' AND c.agreed_to !~* '(withdr|stop|revok|declin|not agreed)')
 AND NOT EXISTS(SELECT 1 FROM public.chat_messages m WHERE m.lead_id=l.id AND m.role='client' AND m.created_at>coalesce(f.sent_at,f.send_after,f.created_at))
 AND NOT EXISTS(SELECT 1 FROM public.follow_ups x WHERE x.viewing_id=v.id AND x.kind='viewing_2day')
 LIMIT 100
 LOOP
   options:=NULL; ceiling_aed:=NULL;
   budget_text:=lower(coalesce(nullif(r.budget,''),r.learned->>'budget',''));
   IF budget_text ~ '^(aed[[:space:]]*)?[0-9][0-9,]*(\.[0-9]+)?[[:space:]]*(m|million|k|thousand)?([[:space:]]*aed)?$' THEN
     ceiling_aed:=replace(substring(budget_text FROM '[0-9][0-9,]*(\.[0-9]+)?'),',','')::numeric;
     IF budget_text ~ '(million|m)([[:space:]]*aed)?$' THEN ceiling_aed:=ceiling_aed*1000000;
     ELSIF budget_text ~ '(thousand|k)([[:space:]]*aed)?$' THEN ceiling_aed:=ceiling_aed*1000; END IF;
   END IF;
   IF ceiling_aed>0 THEN
    SELECT string_agg(x.title || ' — ' || x.community || ' — AED ' || x.price_aed::text, '; ') INTO options
    FROM (SELECT q.title,q.community,q.price_aed FROM public.listings q
      LEFT JOIN public.listings original ON original.id=r.listing_id
      WHERE q.agency_id=r.agency_id AND q.status='Available' AND NOT q.needs_check AND q.last_checked>now()-interval '24 hours'
        AND q.last_checked<=now() AND q.price_aed<=ceiling_aed AND q.id IS DISTINCT FROM r.listing_id
        AND nullif(q.permit_number,'') IS NOT NULL
        AND ((original.id IS NOT NULL AND q.property_type=original.property_type AND q.bedrooms=original.bedrooms AND q.community=original.community)
          OR (original.id IS NULL AND nullif(r.area,'') IS NOT NULL AND lower(q.community)=lower(r.area)))
      ORDER BY q.price_aed LIMIT 2) x;
   END IF;
   text_reply:=public.client_reply_text(r.language,CASE WHEN options IS NULL THEN 'secondFollowUp' ELSE 'secondWithListings' END,coalesce(r.learned->>'_script','native')='latin');
   text_reply:=replace(text_reply,'{listings}',coalesce(options,''));
   INSERT INTO public.follow_ups(agency_id,lead_id,viewing_id,kind,draft,status,send_after)
    VALUES(r.agency_id,r.id,r.viewing_id,'viewing_2day',text_reply,'pending',now()) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS affected=ROW_COUNT; inserted:=inserted+affected;
 END LOOP;
 RETURN inserted;
END; $$;
REVOKE ALL ON FUNCTION public.draft_second_viewing_followups() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.draft_second_viewing_followups() TO service_role;
CREATE OR REPLACE FUNCTION public.draft_scheduled_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
 IF NOT pg_try_advisory_xact_lock(7238101) THEN RETURN; END IF;
 INSERT INTO public.follow_ups (agency_id, lead_id, kind, draft, send_after, status)
 SELECT l.agency_id, v.lead_id, 'viewing_reminder','Good evening! Just a friendly reminder about your ' || v.kind || ' tomorrow at ' || to_char(v.starts_at AT TIME ZONE 'Asia/Dubai', 'HH24:MI') || ' (Dubai time). Looking forward to it!',v.starts_at, 'pending'
 FROM public.viewings v JOIN public.leads l ON l.id = v.lead_id
 WHERE v.status = 'booked' AND NOT v.reminder_sent AND (v.starts_at AT TIME ZONE l.timezone)::date = (now() AT TIME ZONE l.timezone)::date + 1 AND EXTRACT(hour FROM now() AT TIME ZONE l.timezone) >= 18;
 UPDATE public.viewings v SET reminder_sent = true FROM public.leads l WHERE l.id = v.lead_id AND v.status = 'booked' AND NOT v.reminder_sent AND (v.starts_at AT TIME ZONE l.timezone)::date = (now() AT TIME ZONE l.timezone)::date + 1 AND EXTRACT(hour FROM now() AT TIME ZONE l.timezone) >= 18;
 INSERT INTO public.follow_ups (agency_id, owner_id, kind, draft, send_after, status)
 SELECT o.agency_id, o.id, 'lease_reminder','Lease reminder: ' || o.name || '''s lease in ' || o.area || ' (' || o.building || ') ends in 120 days. Time to discuss renewal.',o.lease_end::timestamptz, 'pending'
 FROM public.owners o WHERE o.lease_end = (now() AT TIME ZONE 'Asia/Dubai')::date + 120 AND NOT EXISTS (SELECT 1 FROM public.follow_ups f WHERE f.kind = 'lease_reminder' AND f.owner_id = o.id AND f.send_after::date = o.lease_end);
 INSERT INTO public.follow_ups (agency_id, owner_id, kind, draft, send_after, status)
 SELECT o.agency_id, o.id, 'anniversary_reminder','Home anniversary: ' || o.name || '''s home in ' || o.area || ' (' || o.building || ') completes another year in 7 days. A warm check-in message is due.',(make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM o.handover_date)::int, EXTRACT(day FROM o.handover_date)::int))::timestamptz, 'pending'
 FROM public.owners o WHERE o.handover_date IS NOT NULL AND make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM o.handover_date)::int, EXTRACT(day FROM o.handover_date)::int) = (now() AT TIME ZONE 'Asia/Dubai')::date + 7 AND NOT EXISTS (SELECT 1 FROM public.follow_ups f WHERE f.kind = 'anniversary_reminder' AND f.owner_id = o.id AND f.send_after::date = make_date(EXTRACT(year FROM now())::int, EXTRACT(month FROM o.handover_date)::int, EXTRACT(day FROM o.handover_date)::int));
 INSERT INTO public.follow_ups (agency_id, lead_id, kind, draft, send_after, status)
 SELECT p.agency_id, p.lead_id, 'payment_reminder','Payment reminder: ' || p.label || ' of AED ' || to_char(p.amount_aed, 'FM999,999,999') || ' is due in 7 days' || COALESCE(' (' || p.milestone || ')', '') || '.',p.due_date::timestamptz, 'pending'
 FROM public.payment_schedules p WHERE NOT p.paid AND p.due_date = (now() AT TIME ZONE 'Asia/Dubai')::date + 7 AND NOT EXISTS (SELECT 1 FROM public.follow_ups f WHERE f.kind = 'payment_reminder' AND f.agency_id = p.agency_id AND f.draft LIKE '%' || p.label || '%' AND f.send_after::date = p.due_date);
 PERFORM public.draft_second_viewing_followups();
 IF extract(isodow FROM now() AT TIME ZONE 'Asia/Dubai')=1 AND extract(hour FROM now() AT TIME ZONE 'Asia/Dubai')=9 THEN
 INSERT INTO public.weekly_reports(agency_id,week_start,report) SELECT a.id,(date_trunc('week',now() AT TIME ZONE 'Asia/Dubai')::date-7),public.weekly_report_source(a.id,now()) FROM public.agencies a ON CONFLICT(agency_id,week_start) DO NOTHING;
 END IF;
END; $function$;
REVOKE ALL ON FUNCTION public.draft_scheduled_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.draft_scheduled_reminders() TO service_role;