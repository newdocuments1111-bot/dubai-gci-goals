CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'owner' CHECK (id = 'owner'),
  agent_name text NOT NULL DEFAULT '',
  agency_name text NOT NULL DEFAULT '',
  rera_brn text NOT NULL DEFAULT '',
  working_days text[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  work_start time NOT NULL DEFAULT '09:00',
  work_end time NOT NULL DEFAULT '18:00',
  viewing_minutes integer NOT NULL DEFAULT 30 CHECK (viewing_minutes BETWEEN 10 AND 480),
  holidays date[] NOT NULL DEFAULT ARRAY['2026-01-01','2026-03-20','2026-03-21','2026-03-22','2026-05-27','2026-05-28','2026-06-26','2026-08-30','2026-12-01','2026-12-02','2026-12-03']::date[],
  compliance_email text NOT NULL DEFAULT '',
  retention_years integer NOT NULL DEFAULT 5 CHECK (retention_years BETWEEN 1 AND 30),
  mortgage_partner text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages settings" ON public.app_settings FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');
INSERT INTO public.app_settings (id) VALUES ('owner');

CREATE TABLE public.uae_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  fact text NOT NULL,
  source text NOT NULL DEFAULT '',
  last_verified date NOT NULL DEFAULT CURRENT_DATE,
  needs_verification boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uae_knowledge TO authenticated;
GRANT ALL ON public.uae_knowledge TO service_role;
ALTER TABLE public.uae_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages knowledge" ON public.uae_knowledge FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');
INSERT INTO public.uae_knowledge (topic, fact, source) VALUES
  ('Coverage', 'This covers Dubai. Abu Dhabi and other emirates have different rules; say so and hand the question to the agent.', 'Verify before going live'),
  ('DLD transfer fee', 'DLD transfer fee is 4% of the price, usually paid by the buyer, plus admin and trustee office fees. Amounts are editable in AI Reply Rules; always say they are approximate and the agent will confirm.', 'Verify before going live'),
  ('Resale steps', 'Resale steps: offer, then MOU (Form F) between buyer and seller, then deposit (often 10%, by cheque), then developer NOC, then transfer at a DLD Trustee office.', 'Verify before going live'),
  ('Off-plan', 'Off-plan is bought from the developer and registered with Oqood. Payment plans are set by the developer. The agent commission is usually paid by the developer.', 'Verify before going live'),
  ('Agency commission', 'Agency commission is market practice, not fixed by law: commonly 2% + VAT on resale, and commonly 5% of annual rent on rentals.', 'Verify before going live'),
  ('Agency agreements', 'Agency agreements: Form A (seller and agent), Form B (buyer and agent), Form I (agent to agent).', 'Verify before going live'),
  ('Advertising', 'Every property advertisement needs a valid DLD/RERA Trakheesi permit with its QR code.', 'Verify before going live'),
  ('Rentals', 'Tenancies are registered on Ejari. Rent changes need at least 90 days notice before the lease ends. Increases are limited by the official rental index. Eviction for sale or own use needs 12 months notarised notice.', 'Verify before going live'),
  ('Golden Visa', 'Property investment of AED 2M or more may qualify for a Golden Visa. The authorities decide; never promise it.', 'Verify before going live'),
  ('Data protection', 'Personal data is handled under UAE data protection law: consent, purpose, and access and deletion requests.', 'Verify before going live'),
  ('Anti-money laundering', 'Federal Decree-Law No. 10 of 2025. Cash of AED 55,000 or more on a freehold sale, or any virtual asset payment, must be reported by the agency (REAR via goAML).', 'Verify before going live');

CREATE TABLE public.market_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date date NOT NULL,
  area text NOT NULL,
  building text NOT NULL DEFAULT '',
  property_type text NOT NULL DEFAULT '',
  size_sqft numeric NOT NULL DEFAULT 0,
  price_aed numeric NOT NULL CHECK (price_aed >= 0),
  source text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_transactions_area_idx ON public.market_transactions (area, transaction_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_transactions TO authenticated;
GRANT ALL ON public.market_transactions TO service_role;
ALTER TABLE public.market_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages market data" ON public.market_transactions FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE TABLE public.document_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  path text NOT NULL,
  action text NOT NULL CHECK (action IN ('uploaded','viewed','deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.document_log TO authenticated;
GRANT ALL ON public.document_log TO service_role;
ALTER TABLE public.document_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads and writes document log" ON public.document_log FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK ((auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');

CREATE POLICY "owner manages document vault files" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'documents' AND (auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com') WITH CHECK (bucket_id = 'documents' AND (auth.jwt() ->> 'email') = 'newdocuments1111@gmail.com');