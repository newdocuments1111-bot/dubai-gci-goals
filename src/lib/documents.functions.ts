import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { deleteBlocked, documentPath, isLeadDocumentPath, leadFolder, SIGNED_URL_SECONDS } from './documents';
import { z } from 'zod';

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };

/**
 * The vault bucket has no direct access rules for app users. Every action comes through here:
 * the caller's own access rules must show the lead, and they must be its agency owner, its assigned agent or HQ.
 * Only then does the server touch the file, and every action is written to document_log.
 */
async function vaultLead(context: Ctx, leadId: string) {
  const { data: lead, error } = await context.supabase.from('leads').select('id,name,agency_id').eq('id', leadId).maybeSingle();
  if (error || !lead) throw new Error('Lead not found.');
  const { data: allowed, error: accessError } = await context.supabase.rpc('can_access_lead_documents', { _lead: leadId });
  if (accessError || allowed !== true) throw new Error('Only the agency owner, the assigned agent or HQ can open these documents.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return { lead, admin: supabaseAdmin, folder: leadFolder(lead.agency_id, lead.id) };
}

async function writeLog(v: Awaited<ReturnType<typeof vaultLead>>, path: string, action: 'uploaded' | 'viewed' | 'deleted') {
  const { error } = await v.admin.from('document_log').insert({ agency_id: v.lead.agency_id, lead_id: v.lead.id, client_name: v.lead.name || v.lead.id, path, action });
  if (error) throw new Error('Could not write the document log.');
}

async function findFile(v: Awaited<ReturnType<typeof vaultLead>>, path: string) {
  const name = path.slice(v.folder.length + 1);
  const { data, error } = await v.admin.storage.from('documents').list(v.folder, { limit: 10, search: name });
  if (error) throw new Error('Could not read the vault.');
  return (data ?? []).find(f => f.name === name) ?? null;
}

const leadInput = z.object({ leadId: z.string().uuid() });
const fileInput = leadInput.extend({ path: z.string().min(1).max(500) });

/** Files for one lead, newest first. Paths only — opening uses a short-lived signed link. */
export const listDocuments = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadInput).handler(async ({ data, context }) => {
    const v = await vaultLead(context, data.leadId);
    const { data: files, error } = await v.admin.storage.from('documents').list(v.folder, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw new Error('Could not list documents.');
    return (files ?? []).filter(f => f.id && f.name !== '.emptyFolderPlaceholder').map(f => ({ name: f.name, path: `${v.folder}/${f.name}`, created_at: f.created_at ?? null }));
  });

/** One-time upload link for one new file in this lead's folder (the browser cannot write to the vault directly). */
export const startDocumentUpload = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadInput.extend({ filename: z.string().min(1).max(250) })).handler(async ({ data, context }) => {
    const v = await vaultLead(context, data.leadId);
    const path = documentPath(v.lead.agency_id, v.lead.id, data.filename);
    const { data: signed, error } = await v.admin.storage.from('documents').createSignedUploadUrl(path);
    if (error || !signed) throw new Error('Could not prepare the upload.');
    return { path: signed.path, token: signed.token };
  });

/** After the upload: confirm the file is really there, then log it. */
export const finishDocumentUpload = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(fileInput).handler(async ({ data, context }) => {
    const v = await vaultLead(context, data.leadId);
    if (!isLeadDocumentPath(data.path, v.lead.agency_id, v.lead.id)) throw new Error('Invalid document.');
    if (!(await findFile(v, data.path))) throw new Error('The upload did not arrive.');
    await writeLog(v, data.path, 'uploaded');
    return { success: true };
  });

/** 10-minute signed link; the link is only returned once the view is logged. */
export const openDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(fileInput).handler(async ({ data, context }) => {
    const v = await vaultLead(context, data.leadId);
    if (!isLeadDocumentPath(data.path, v.lead.agency_id, v.lead.id)) throw new Error('Invalid document.');
    const { data: signed, error } = await v.admin.storage.from('documents').createSignedUrl(data.path, SIGNED_URL_SECONDS);
    if (error || !signed?.signedUrl) throw new Error('Could not open the document.');
    await writeLog(v, data.path, 'viewed');
    return { url: signed.signedUrl, expiresInSeconds: SIGNED_URL_SECONDS };
  });

/** Delete on request — blocked for records inside the legal retention period (upload time read from storage, not the browser). */
export const deleteDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(fileInput).handler(async ({ data, context }) => {
    const v = await vaultLead(context, data.leadId);
    if (!isLeadDocumentPath(data.path, v.lead.agency_id, v.lead.id)) throw new Error('Invalid document.');
    const file = await findFile(v, data.path);
    if (!file) throw new Error('Document not found.');
    const { data: settings } = await v.admin.from('app_settings').select('retention_years').eq('agency_id', v.lead.agency_id).maybeSingle();
    const years = settings?.retention_years ?? 5;
    if (deleteBlocked(file.created_at ?? '', years)) {
      return { error: `This record is inside the ${years}-year retention period the law requires us to keep. It cannot be deleted yet.` };
    }
    const { error } = await v.admin.storage.from('documents').remove([data.path]);
    if (error) throw new Error('Could not delete the document.');
    await writeLog(v, data.path, 'deleted');
    return { success: true };
  });

/** Log for the caller's agency: owners see all of it, agents only their own leads (enforced by the log's access rules). */
export const listDocumentLog = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data, error } = await context.supabase.from('document_log').select('*').eq('agency_id', access.agencyId).order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error('Could not load the document log.');
  return data;
});
