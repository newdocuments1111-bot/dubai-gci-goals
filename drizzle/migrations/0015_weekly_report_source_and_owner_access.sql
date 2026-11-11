CREATE FUNCTION public.weekly_report_source(p_agency uuid, p_as_of timestamptz DEFAULT now()) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' AND session_user NOT IN ('postgres','supabase_admin') AND NOT (public.is_agency_owner(p_agency) OR public.is_hq_admin()) THEN RAISE EXCEPTION 'Owner or HQ access required'; END IF;
 SELECT jsonb_build_object(
 'agency_name',a.name,'goal',coalesce((SELECT annual_gci_goal_aed FROM public.app_settings WHERE agency_id=a.id),0),'generated_at',p_as_of,
 'members',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'email',m.email,'split_percent',m.split_percent,'annual_gci_goal_aed',m.annual_gci_goal_aed,'role',m.role)) FROM public.agency_members m WHERE m.agency_id=a.id AND m.role IN ('owner','agent')),'[]'::jsonb),
 'leads',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'assigned_agent_id',l.assigned_agent_id,'created_at',l.created_at,'source',l.source,'language',l.language,'score',l.score)) FROM public.leads l WHERE l.agency_id=a.id AND l.created_at<=p_as_of),'[]'::jsonb),
 'messages',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'lead_id',m.lead_id,'role',m.role,'created_at',m.created_at,'sent',m.sent,'author_id',m.author_id,'wa_sent_at',m.wa_sent_at,'wa_status',m.wa_status)) FROM public.chat_messages m WHERE m.agency_id=a.id AND m.created_at<=p_as_of),'[]'::jsonb),
 'viewings',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'lead_id',v.lead_id,'created_at',v.created_at,'starts_at',v.starts_at,'status',v.status,'done_at',v.done_at)) FROM public.viewings v WHERE v.agency_id=a.id AND v.created_at<=p_as_of),'[]'::jsonb),
 'deals',coalesce((SELECT jsonb_agg(jsonb_build_object('agent_id',d.agent_id,'lead_id',d.lead_id,'price_aed',d.price_aed,'commission_percent',d.commission_percent,'status',d.status,'closed_at',d.closed_at,'created_at',d.created_at)) FROM public.deals d WHERE d.agency_id=a.id AND d.created_at<=p_as_of),'[]'::jsonb),
 'alerts',coalesce((SELECT jsonb_agg(jsonb_build_object('lead_id',x.lead_id,'kind',x.kind,'created_at',x.created_at)) FROM public.alerts x WHERE x.agency_id=a.id AND x.created_at<=p_as_of),'[]'::jsonb),
 'listings',coalesce((SELECT jsonb_agg(jsonb_build_object('last_checked',x.last_checked,'needs_check',x.needs_check,'status',x.status)) FROM public.listings x WHERE x.agency_id=a.id AND x.created_at<=p_as_of),'[]'::jsonb),
 'followups',coalesce((SELECT jsonb_agg(jsonb_build_object('lead_id',f.lead_id,'kind',f.kind,'viewing_id',f.viewing_id,'sent_at',f.sent_at,'chat_message_id',f.chat_message_id)) FROM public.follow_ups f WHERE f.agency_id=a.id AND f.created_at<=p_as_of),'[]'::jsonb),
 'usage',coalesce((SELECT jsonb_agg(jsonb_build_object('type',u.type,'created_at',u.created_at)) FROM public.usage_events u WHERE u.agency_id=a.id AND u.created_at<=p_as_of),'[]'::jsonb)
 ) INTO result FROM public.agencies a WHERE a.id=p_agency;
 IF result IS NULL THEN RAISE EXCEPTION 'Agency not found'; END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.weekly_report_source(uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.weekly_report_source(uuid,timestamptz) TO authenticated,service_role;