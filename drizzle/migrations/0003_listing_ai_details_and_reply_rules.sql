ALTER TABLE public.listings
 ADD COLUMN nearby_schools text NOT NULL DEFAULT '',
 ADD COLUMN nearby_parks text NOT NULL DEFAULT '',
 ADD COLUMN nearby_clinics text NOT NULL DEFAULT '',
 ADD COLUMN nearby_metro text NOT NULL DEFAULT '',
 ADD COLUMN nearby_malls text NOT NULL DEFAULT '',
 ADD COLUMN nearby_beach text NOT NULL DEFAULT '',
 ADD COLUMN nearby_supermarket text NOT NULL DEFAULT '',
 ADD COLUMN amenity_pool boolean,
 ADD COLUMN amenity_gym boolean,
 ADD COLUMN amenity_kids_play_area boolean,
 ADD COLUMN amenity_security boolean,
 ADD COLUMN parking_spaces integer,
 ADD COLUMN floor text NOT NULL DEFAULT '',
 ADD COLUMN view text NOT NULL DEFAULT '',
 ADD COLUMN furnishing text NOT NULL DEFAULT '',
 ADD COLUMN developer text NOT NULL DEFAULT '',
 ADD COLUMN payment_plan text NOT NULL DEFAULT '',
 ADD COLUMN construction_percent numeric,
 ADD COLUMN service_charge_aed_sqft_year numeric,
 ADD COLUMN video_tour_url text NOT NULL DEFAULT '',
 ADD COLUMN floor_plan text NOT NULL DEFAULT '',
 ADD COLUMN agent_highlights text NOT NULL DEFAULT '',
 ADD COLUMN do_not_mention text NOT NULL DEFAULT '';
CREATE TABLE public.ai_reply_settings (
 id text PRIMARY KEY DEFAULT 'owner' CHECK (id = 'owner'),
 agency_name text NOT NULL DEFAULT '',
 rules jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_reply_settings TO authenticated;
GRANT ALL ON public.ai_reply_settings TO service_role;
ALTER TABLE public.ai_reply_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages reply settings" ON public.ai_reply_settings FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com') WITH CHECK (lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com');
CREATE POLICY "Owner manages shareable photos" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'listing-photos' AND lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com') WITH CHECK (bucket_id = 'listing-photos' AND lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com');
ALTER TABLE public.listings ADD CONSTRAINT listing_ai_numeric_ranges CHECK ((parking_spaces IS NULL OR parking_spaces BETWEEN 0 AND 100) AND (construction_percent IS NULL OR construction_percent BETWEEN 0 AND 100) AND (service_charge_aed_sqft_year IS NULL OR service_charge_aed_sqft_year >= 0));