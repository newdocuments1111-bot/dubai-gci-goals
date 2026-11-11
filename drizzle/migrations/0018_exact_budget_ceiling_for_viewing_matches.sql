CREATE OR REPLACE FUNCTION public.draft_second_viewing_followups() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; options text; budget_text text; ceiling_aed numeric; text_reply text; inserted integer:=0; affected integer;
BEGIN
 IF NOT pg_try_advisory_xact_lock(7238102) THEN RETURN 0; END IF;
 FOR r IN SELECT v.id AS viewing_id,v.listing_id,l.*,coalesce(f.sent_at,f.send_after,f.created_at) AS first_at
 FROM public.viewings v JOIN public.leads l ON l.id=v.lead_id
 JOIN public.follow_ups f ON f.viewing_id=v.id AND f.kind='viewing_followup' AND f.status IN ('pending','sent')
 WHERE v.status='done' AND NOT l.stopped AND l.opted_in
 AND coalesce(f.sent_at,f.send_after,f.created_at)<=now()-interval '48 hours'
 AND EXISTS(SELECT 1 FROM (SELECT c.agreed_to FROM public.consent_log c WHERE c.lead_id=l.id ORDER BY c.created_at DESC LIMIT 1) latest WHERE latest.agreed_to ~* '(agreed|consent|opt.?in)' AND latest.agreed_to !~* '(withdr|stop|revok|declin|not agreed)')
 AND NOT EXISTS(SELECT 1 FROM public.chat_messages m WHERE m.lead_id=l.id AND m.role='client' AND m.created_at>coalesce(f.sent_at,f.send_after,f.created_at))
 AND NOT EXISTS(SELECT 1 FROM public.follow_ups x WHERE x.viewing_id=v.id AND x.kind='viewing_2day')
 LIMIT 100
 LOOP
   options:=NULL; ceiling_aed:=NULL;
   budget_text:=lower(coalesce(nullif(r.budget,''),r.learned->>'budget',''));
   IF budget_text ~ '^(aed[[:space:]]*)?[0-9][0-9,]*(\.[0-9]+)?[[:space:]]*(m|million|k|thousand)?([[:space:]]*aed)?$' THEN
     ceiling_aed:=regexp_replace(budget_text,'[^0-9.]','','g')::numeric;
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