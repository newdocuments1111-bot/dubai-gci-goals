CREATE TABLE public.listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
 community text NOT NULL DEFAULT '', project text NOT NULL DEFAULT '',
 property_type text NOT NULL DEFAULT 'apartment' CHECK (property_type IN ('apartment','villa','townhouse')),
 bedrooms integer NOT NULL DEFAULT 0 CHECK (bedrooms BETWEEN 0 AND 30),
 size_sqft numeric NOT NULL DEFAULT 0 CHECK (size_sqft >= 0), price_aed numeric NOT NULL DEFAULT 0 CHECK (price_aed >= 0),
 completion text NOT NULL DEFAULT 'ready' CHECK (completion IN ('ready','off-plan')),
 handover_date date, status text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Reserved','Sold')),
 description text NOT NULL DEFAULT '', photos text[] NOT NULL DEFAULT '{}', videos text[] NOT NULL DEFAULT '{}',
 maps_url text NOT NULL DEFAULT '', permit_number text NOT NULL DEFAULT '',
 last_checked timestamptz NOT NULL DEFAULT now(), needs_check boolean NOT NULL DEFAULT false,
 is_sample boolean NOT NULL DEFAULT false, source text NOT NULL DEFAULT 'manual', external_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages listings" ON public.listings FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com') WITH CHECK (lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com');
CREATE UNIQUE INDEX listings_source_external_id ON public.listings(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX listings_fresh_available ON public.listings(status, last_checked);
CREATE POLICY "Owner manages private listing media" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'listing-media' AND lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com') WITH CHECK (bucket_id = 'listing-media' AND lower(auth.jwt()->>'email') = 'newdocuments1111@gmail.com');
CREATE FUNCTION public.refresh_listing_checks() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
 UPDATE public.listings SET needs_check = (last_checked < now() - interval '24 hours') WHERE needs_check IS DISTINCT FROM (last_checked < now() - interval '24 hours');
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_listing_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_listing_checks() TO service_role;
COMMENT ON FUNCTION public.refresh_listing_checks() IS 'Nightly inventory freshness entry point at 20:00 UTC (00:00 Dubai); future source sync can run before this function. Eligibility must always be derived from status and timestamp, never solely needs_check.';
INSERT INTO public.listings (title, community, project, property_type, bedrooms, size_sqft, price_aed, completion, handover_date, status, description, is_sample, source) VALUES
('Marina-view apartment', 'Dubai Marina', 'Sample Marina Residences', 'apartment', 2, 1250, 2400000, 'ready', NULL, 'Available', 'Sample listing — fictional property for testing. Two-bedroom apartment with balcony and marina views.', true, 'sample'),
('Garden townhouse', 'Dubai Hills Estate', 'Sample Park Townhouses', 'townhouse', 3, 2200, 3800000, 'off-plan', '2027-06-30', 'Reserved', 'Sample listing — fictional property for testing. Three-bedroom townhouse with private garden.', true, 'sample'),
('Family villa', 'Arabian Ranches', 'Sample Ranches Villas', 'villa', 4, 3600, 6500000, 'ready', NULL, 'Sold', 'Sample listing — fictional property for testing. Four-bedroom villa with landscaped garden.', true, 'sample');