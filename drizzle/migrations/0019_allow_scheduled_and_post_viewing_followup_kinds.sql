ALTER TABLE public.follow_ups DROP CONSTRAINT follow_ups_kind_check;
ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_kind_check CHECK(kind IN ('follow-up','payment-reminder','milestone-update','value-update','anniversary','lease-reminder','revival','viewing_followup','viewing_2day','viewing_reminder','lease_reminder','anniversary_reminder','payment_reminder'));
ALTER TABLE public.follow_ups DROP CONSTRAINT follow_ups_status_check;
ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_status_check CHECK(status IN ('pending','approved','cancelled','sent','sending','blocked'));