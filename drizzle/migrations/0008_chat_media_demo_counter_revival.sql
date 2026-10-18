ALTER TABLE public.chat_messages ADD COLUMN media_path text, ADD COLUMN media_kind text CHECK (media_kind IN ('audio','image'));
CREATE POLICY "owner chat media" ON storage.objects FOR ALL TO authenticated USING (bucket_id='chat-media' AND (auth.jwt()->>'email')='newdocuments1111@gmail.com') WITH CHECK (bucket_id='chat-media' AND (auth.jwt()->>'email')='newdocuments1111@gmail.com');
CREATE TABLE public.demo_usage (visitor_id uuid NOT NULL, day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date, messages integer NOT NULL DEFAULT 0 CHECK(messages BETWEEN 0 AND 20), PRIMARY KEY(visitor_id,day));
GRANT ALL ON public.demo_usage TO service_role;
ALTER TABLE public.demo_usage ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.reserve_demo_message(p_visitor uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE used integer; BEGIN
 INSERT INTO public.demo_usage(visitor_id,day,messages) VALUES(p_visitor,(now() AT TIME ZONE 'UTC')::date,1) ON CONFLICT(visitor_id,day) DO UPDATE SET messages=demo_usage.messages+1 WHERE demo_usage.messages<20 RETURNING messages INTO used;
 IF used IS NULL THEN RAISE EXCEPTION 'Daily demo limit reached'; END IF; RETURN used; END; $$;
REVOKE ALL ON FUNCTION public.reserve_demo_message(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_demo_message(uuid) TO service_role;
CREATE UNIQUE INDEX revival_once_per_lead ON public.follow_ups(lead_id) WHERE kind='revival';
CREATE FUNCTION public.draft_old_lead_revivals() RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$ DECLARE n integer; BEGIN
 IF (auth.jwt()->>'email') IS DISTINCT FROM 'newdocuments1111@gmail.com' THEN RAISE EXCEPTION 'Owner access required'; END IF;
 INSERT INTO public.follow_ups(lead_id,kind,draft,status,send_after)
 SELECT id,'revival','Hello ' || COALESCE(NULLIF(name,''),'there') || ', I hope you are well. Are you still looking for a property in Dubai? No pressure — let me know if your plans have changed.','pending',now()
 FROM public.leads WHERE opted_in=true AND stopped=false AND last_message_at < now()-interval '30 days'
 ON CONFLICT (lead_id) WHERE kind='revival' DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END; $$;
REVOKE ALL ON FUNCTION public.draft_old_lead_revivals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.draft_old_lead_revivals() TO authenticated;
CREATE FUNCTION public.approve_chat_follow_up(p_id uuid,p_draft text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ DECLARE f public.follow_ups; l public.leads; BEGIN
 IF (auth.jwt()->>'email') IS DISTINCT FROM 'newdocuments1111@gmail.com' THEN RAISE EXCEPTION 'Owner access required'; END IF;
 SELECT * INTO f FROM public.follow_ups WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR f.status<>'pending' THEN RAISE EXCEPTION 'Draft is no longer pending'; END IF;
 IF f.send_after IS NOT NULL AND f.send_after>now() THEN RAISE EXCEPTION 'This follow-up is not due yet'; END IF;
 IF f.lead_id IS NOT NULL THEN
 SELECT * INTO l FROM public.leads WHERE id=f.lead_id FOR UPDATE;
 IF NOT FOUND OR l.stopped OR (f.kind='revival' AND NOT l.opted_in) THEN RAISE EXCEPTION 'Client has not agreed to contact or has stopped messages'; END IF;
 INSERT INTO public.chat_messages(lead_id,role,content,sent) VALUES(l.id,'ai',p_draft,true);
 UPDATE public.leads SET last_message_at=now() WHERE id=l.id;
 END IF;
 UPDATE public.follow_ups SET draft=p_draft,status='sent' WHERE id=p_id;
 END; $$;
REVOKE ALL ON FUNCTION public.approve_chat_follow_up(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_chat_follow_up(uuid,text) TO authenticated;