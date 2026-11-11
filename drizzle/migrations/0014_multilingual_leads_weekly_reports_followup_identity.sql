ALTER TABLE public.leads ADD COLUMN language text NOT NULL DEFAULT 'en';
ALTER TABLE public.leads ADD CONSTRAINT leads_language_bucket CHECK (language IN ('en','ar','hi','ru'));
ALTER TABLE public.chat_messages ADD COLUMN translation_en text;
ALTER TABLE public.app_settings ADD COLUMN annual_gci_goal_aed numeric NOT NULL DEFAULT 0 CHECK (annual_gci_goal_aed >= 0);
ALTER TABLE public.viewings ADD COLUMN done_at timestamptz;
ALTER TABLE public.follow_ups ADD COLUMN viewing_id uuid REFERENCES public.viewings(id) ON DELETE CASCADE;
ALTER TABLE public.follow_ups ADD COLUMN sent_at timestamptz;
ALTER TABLE public.follow_ups ADD COLUMN chat_message_id uuid REFERENCES public.chat_messages(id);
CREATE UNIQUE INDEX followups_one_kind_per_viewing ON public.follow_ups(viewing_id,kind) WHERE viewing_id IS NOT NULL;
CREATE TABLE public.weekly_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
 week_start date NOT NULL,
 generated_at timestamptz NOT NULL DEFAULT now(),
 report jsonb NOT NULL,
 UNIQUE(agency_id,week_start)
);
GRANT SELECT ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner hq read weekly reports" ON public.weekly_reports FOR SELECT TO authenticated USING(public.is_agency_owner(agency_id) OR public.is_hq_admin());
CREATE FUNCTION public.stamp_viewing_done() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.status='done' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN NEW.done_at=now(); END IF; RETURN NEW; END $$;
CREATE TRIGGER viewing_done_timestamp BEFORE INSERT OR UPDATE OF status ON public.viewings FOR EACH ROW EXECUTE FUNCTION public.stamp_viewing_done();
COMMENT ON COLUMN public.viewings.done_at IS 'Exact completion timestamp for new transitions; legacy done rows remain null, never fabricated.';
COMMENT ON COLUMN public.weekly_reports.report IS 'Frozen real-row report source; calculations use generated_at, never current timestamps.';