-- Document Vault: one folder per lead (<agency>/<lead>/<file>). No direct browser access to the bucket;
-- the server checks owner / assigned agent / HQ, hands out 10-minute signed links and writes every action to document_log.
ALTER TABLE public.document_log ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX document_log_lead_idx ON public.document_log(lead_id, created_at DESC);

CREATE FUNCTION public.can_access_lead_documents(_lead uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_hq_admin() OR public.can_access_lead(_lead) $$;
REVOKE ALL ON FUNCTION public.can_access_lead_documents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_lead_documents(uuid) TO authenticated, service_role;

-- The log is written only by the server and can no longer be edited or deleted by app users.
DROP POLICY IF EXISTS "agency manages document_log" ON public.document_log;
REVOKE INSERT, UPDATE, DELETE ON public.document_log FROM authenticated;
CREATE POLICY "document log read" ON public.document_log FOR SELECT TO authenticated
  USING (public.is_agency_owner(agency_id) OR (public.is_agency_member(agency_id) AND lead_id IS NOT NULL AND public.can_access_lead(lead_id)));

-- Storage: the documents bucket is removed from the shared app-files rules, so no signed-in user can list, read, upload or delete vault files directly.
CREATE OR REPLACE FUNCTION public.storage_path_access(_bucket text, _name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE parts text[] := string_to_array(_name, '/'); target uuid;
BEGIN
  IF _bucket = 'chat-media' THEN
    BEGIN target := parts[1]::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.can_access_lead(target);
  ELSIF _bucket IN ('listing-media','listing-photos') THEN
    IF array_length(parts, 1) >= 3 THEN
      BEGIN target := parts[2]::uuid; EXCEPTION WHEN others THEN RETURN false; END;
      RETURN public.is_agency_member(target);
    END IF;
    RETURN public.is_agency_member('de000000-0000-4000-8000-000000000001'::uuid);
  END IF;
  RETURN false;
END $$;
DROP POLICY IF EXISTS "agency members manage app files" ON storage.objects;
DROP POLICY IF EXISTS "hq reads app files" ON storage.objects;
CREATE POLICY "agency members manage app files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('chat-media','listing-media','listing-photos') AND public.storage_path_access(bucket_id, name))
  WITH CHECK (bucket_id IN ('chat-media','listing-media','listing-photos') AND public.storage_path_access(bucket_id, name));
CREATE POLICY "hq reads app files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('chat-media','listing-media','listing-photos') AND public.is_hq_admin());
