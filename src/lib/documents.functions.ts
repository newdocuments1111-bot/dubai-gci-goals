import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { clientFolder, clientNameSchema, deleteBlocked, SIGNED_URL_SECONDS } from './documents';
import { z } from 'zod';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);

/** Files for one client folder, newest first. Paths only — opening uses a short-lived signed link. */
export const listDocuments = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(clientNameSchema).handler(async ({ data, context }) => {
    const access = await guard(context);
    const folder = clientFolder(access.agencyId, data);
    const { data: files, error } = await context.supabase.storage.from('documents').list(folder, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw new Error('Could not list documents.');
    return (files ?? []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({ name: f.name, path: `${folder}/${f.name}`, created_at: f.created_at ?? null }));
  });

/** Log an upload after the browser puts the file into the private bucket. */
export const logDocumentUpload = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ client: clientNameSchema, path: z.string().max(500) })).handler(async ({ data, context }) => {
    const access = await guard(context);
    if (!data.path.startsWith(`${access.agencyId}/`)) throw new Error('Invalid document.');
    const { error } = await context.supabase.from('document_log').insert({ client_name: data.client, path: data.path, action: 'uploaded' });
    if (error) throw new Error('Could not log the upload.');
    return { success: true };
  });

/** 10-minute signed link; every view is logged. */
export const openDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ client: clientNameSchema, path: z.string().max(500) })).handler(async ({ data, context }) => {
    const access = await guard(context);
    if (!data.path.startsWith(`${access.agencyId}/`)) throw new Error('Invalid document.');
    const { data: signed, error } = await context.supabase.storage.from('documents').createSignedUrl(data.path, SIGNED_URL_SECONDS);
    if (error || !signed?.signedUrl) throw new Error('Could not open the document.');
    await context.supabase.from('document_log').insert({ client_name: data.client, path: data.path, action: 'viewed' });
    return { url: signed.signedUrl, expiresInSeconds: SIGNED_URL_SECONDS };
  });

/** Delete on request — blocked for records inside the legal retention period. */
export const deleteDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ client: clientNameSchema, path: z.string().max(500), uploadedAt: z.string().nullable() })).handler(async ({ data, context }) => {
    const access = await guard(context);
    if (!data.path.startsWith(`${access.agencyId}/`)) throw new Error('Invalid document.');
    const { data: settings } = await context.supabase.from('app_settings').select('retention_years').eq('agency_id', access.agencyId).maybeSingle();
    const years = settings?.retention_years ?? 5;
    if (deleteBlocked(data.uploadedAt ?? '', years)) {
      return { error: `This record is inside the ${years}-year retention period the law requires us to keep. It cannot be deleted yet.` };
    }
    const { error } = await context.supabase.storage.from('documents').remove([data.path]);
    if (error) throw new Error('Could not delete the document.');
    await context.supabase.from('document_log').insert({ client_name: data.client, path: data.path, action: 'deleted' });
    return { success: true };
  });

export const listDocumentLog = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await guard(context);
  const { data, error } = await context.supabase.from('document_log').select('*').eq('agency_id', access.agencyId).order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error('Could not load the document log.');
  return data;
});
