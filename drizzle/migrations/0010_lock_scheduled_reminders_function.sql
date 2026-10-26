-- Only the hourly scheduler (database owner) runs reminder drafting.
REVOKE ALL ON FUNCTION public.draft_scheduled_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.draft_scheduled_reminders() TO service_role;