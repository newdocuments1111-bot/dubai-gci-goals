import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import {
  canApprove, canCancel, canEditVariables, cleanParam, consentRecordOk, DEFAULT_MARKETING_GAP_DAYS, ensureStopLine, initialQueueStatus,
  missingValues, outboxDecision, QUEUE_PURPOSES, QUEUE_STATUSES, renderTemplate, TEMPLATE_LANGUAGES, templateNameFrom, templateProblems,
  templateTokens, toMetaBody,
} from './whatsapp-templates';

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };
const admin = async () => (await import('@/integrations/supabase/client.server')).supabaseAdmin;

async function requireManager(context: Ctx) {
  const access = await getAccess(context.supabase, context.userId);
  if (!access.isOwner && !access.isHq) throw new Error('Only the agency owner or HQ can manage templates.');
  return access;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Could not reach Meta.').replace(/^Meta refused the request /, 'Meta said ');

// ---------- Templates (owner + HQ manage; every member can read approved ones) ----------

export const listTemplates = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data, error } = await context.supabase.from('message_templates').select('*').eq('agency_id', access.agencyId).order('created_at', { ascending: false });
  if (error) throw new Error('Could not load templates.');
  const { data: settings } = await context.supabase.from('whatsapp_settings').select('waba_id').eq('agency_id', access.agencyId).maybeSingle();
  return { templates: data ?? [], canManage: access.isOwner || access.isHq, hasWaba: Boolean(settings?.waba_id) };
});

const templateInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(100),
  category: z.enum(['marketing', 'utility']),
  language: z.enum(TEMPLATE_LANGUAGES.map(l => l.code) as [string, ...string[]]),
  body: z.string().max(1100),
  examples: z.record(z.string().max(30), z.string().max(200)),
});

/** Save a draft. The STOP line is added to marketing templates and blanks are mapped to Meta's numbered blanks. */
export const saveTemplate = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(templateInput).handler(async ({ data, context }) => {
    const access = await requireManager(context);
    const problems = templateProblems(data);
    if (problems.length) return { error: problems.join(' ') };
    const body = ensureStopLine(data.body, data.category);
    const { metaBody, variables } = toMetaBody(body);
    const examples = Object.fromEntries([...new Set(variables)].map(t => [t, cleanParam(data.examples[t])]));
    const db = await admin();
    if (data.id) {
      const { data: current } = await context.supabase.from('message_templates').select('id,meta_status,agency_id').eq('id', data.id).maybeSingle();
      if (!current || current.agency_id !== access.agencyId) throw new Error('Template not found.');
      if (current.meta_status !== 'draft') return { error: 'This template was already sent to Meta, so it cannot be changed. Write a new one instead.' };
      const { error } = await db.from('message_templates').update({ label: data.label, category: data.category, language: data.language, body, meta_body: metaBody, variables, examples, updated_at: new Date().toISOString() }).eq('id', data.id);
      if (error) throw new Error('Could not save the template.');
      return { id: data.id };
    }
    // Meta names must be unique per language: add _2, _3… when needed.
    const base = templateNameFrom(data.label);
    const { data: taken } = await db.from('message_templates').select('name').eq('agency_id', access.agencyId).eq('language', data.language).like('name', `${base}%`);
    const names = new Set((taken ?? []).map(t => t.name));
    let name = base;
    for (let i = 2; names.has(name); i++) name = `${base}_${i}`;
    const { data: row, error } = await db.from('message_templates').insert({
      agency_id: access.agencyId, label: data.label, name, category: data.category, language: data.language, body, meta_body: metaBody, variables, examples, created_by: context.userId,
    }).select('id').single();
    if (error || !row) throw new Error('Could not save the template.');
    return { id: row.id };
  });

export const deleteTemplate = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    const access = await requireManager(context);
    const db = await admin();
    const { error } = await db.from('message_templates').delete().eq('id', data.id).eq('agency_id', access.agencyId).eq('meta_status', 'draft');
    if (error) throw new Error('Could not delete the template.');
    return { success: true };
  });

/** Send a draft to Meta for review through the agency's WhatsApp Business Account. */
export const submitTemplate = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    const access = await requireManager(context);
    const db = await admin();
    const [{ data: t }, { data: settings }] = await Promise.all([
      db.from('message_templates').select('*').eq('id', data.id).eq('agency_id', access.agencyId).maybeSingle(),
      db.from('whatsapp_settings').select('waba_id').eq('agency_id', access.agencyId).maybeSingle(),
    ]);
    if (!t) throw new Error('Template not found.');
    if (t.meta_status !== 'draft') return { error: 'This template was already sent to Meta.' };
    if (!settings?.waba_id) return { error: 'Add the WhatsApp Business Account ID in Settings → WhatsApp first.' };
    const problems = templateProblems({ label: t.label, body: t.body, category: t.category as 'marketing', examples: t.examples as Record<string, string> });
    if (problems.length) return { error: problems.join(' ') };
    const { createMetaTemplate } = await import('./whatsapp.server');
    try {
      const examples = t.variables.map(v => cleanParam((t.examples as Record<string, string>)[v]));
      const created = await createMetaTemplate(settings.waba_id, { name: t.name, language: t.language, category: t.category, metaBody: t.meta_body, examples });
      const now = new Date().toISOString();
      await db.from('message_templates').update({ meta_template_id: created.id, meta_status: created.status, submitted_at: now, status_checked_at: now, rejection_reason: null, updated_at: now }).eq('id', t.id);
      return { status: created.status };
    } catch (e) {
      return { error: errMsg(e) };
    }
  });

/** Read every template's review status from Meta. */
export const syncTemplates = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await requireManager(context);
  const db = await admin();
  const { data: settings } = await db.from('whatsapp_settings').select('waba_id').eq('agency_id', access.agencyId).maybeSingle();
  if (!settings?.waba_id) return { error: 'Add the WhatsApp Business Account ID in Settings → WhatsApp first.' };
  const { listMetaTemplates, rejectionText } = await import('./whatsapp.server');
  const { mapMetaStatus } = await import('./whatsapp-templates');
  let remote;
  try { remote = await listMetaTemplates(settings.waba_id); } catch (e) { return { error: errMsg(e) }; }
  const { data: local } = await db.from('message_templates').select('id,name,language,meta_template_id,meta_status').eq('agency_id', access.agencyId).neq('meta_status', 'draft');
  let updated = 0;
  const now = new Date().toISOString();
  for (const t of local ?? []) {
    const m = remote.find(r => (t.meta_template_id && r.id === t.meta_template_id) || (r.name === t.name && r.language === t.language));
    if (!m) continue;
    const status = mapMetaStatus(m.status);
    await db.from('message_templates').update({ meta_template_id: m.id, meta_status: status, rejection_reason: status === 'rejected' ? rejectionText(m.rejected_reason) : null, status_checked_at: now }).eq('id', t.id);
    if (status !== t.meta_status) updated++;
  }
  return { checked: local?.length ?? 0, updated };
});

// ---------- Send queue (owner sees the agency; agents only their own leads) ----------

export const getQueue = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.enum(QUEUE_STATUSES as [string, ...string[]]).optional(), purpose: z.enum(QUEUE_PURPOSES).optional() }))
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    let q = context.supabase.from('whatsapp_outbox')
      .select('*, leads(name,phone), chat_messages(wa_status,wa_error,wa_delivered_at,wa_read_at)')
      .eq('agency_id', access.agencyId).order('created_at', { ascending: false }).limit(200);
    if (data.status) q = q.eq('status', data.status);
    if (data.purpose) q = q.eq('purpose', data.purpose);
    const [{ data: items, error }, { data: settings }, { data: templates }] = await Promise.all([
      q,
      context.supabase.from('whatsapp_settings').select('send_mode,marketing_gap_days,test_mode').eq('agency_id', access.agencyId).maybeSingle(),
      context.supabase.from('message_templates').select('id,body,variables').eq('agency_id', access.agencyId),
    ]);
    if (error) throw new Error('Could not load the queue.');
    return {
      items: (items ?? []).map(i => ({ ...i, template_body: templates?.find(t => t.id === i.template_id)?.body ?? null, template_variables: templates?.find(t => t.id === i.template_id)?.variables ?? [] })),
      settings: { send_mode: settings?.send_mode ?? 'approve', marketing_gap_days: settings?.marketing_gap_days ?? DEFAULT_MARKETING_GAP_DAYS, test_mode: settings?.test_mode ?? true },
      isManager: access.isOwner || access.isHq,
    };
  });

export const saveSendSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ send_mode: z.enum(['approve', 'auto']), marketing_gap_days: z.number().int().min(1).max(90) }))
  .handler(async ({ data, context }) => {
    const access = await requireManager(context);
    const db = await admin();
    const { data: rows, error } = await db.from('whatsapp_settings').update({ ...data, updated_at: new Date().toISOString() }).eq('agency_id', access.agencyId).select('id');
    if (error) throw new Error('Could not save.');
    if (!rows?.length) return { error: 'WhatsApp is not set up for this agency yet.' };
    return { success: true };
  });

const variablesInput = z.record(z.string().max(30), z.string().max(500));

/** Rules that can be checked now (consent, STOP, approval, safety list, 7-day gap); the send job checks them all again. */
async function precheck(itemLead: { id: string; agency_id: string; phone: string; stopped: boolean; opted_in: boolean }, template: { id: string; meta_status: string; category: string; variables: string[] }, values: Record<string, string>) {
  const db = await admin();
  const [{ data: consent }, { data: settings }, { data: lastMarketing }] = await Promise.all([
    db.from('consent_log').select('agreed_to').eq('lead_id', itemLead.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('whatsapp_settings').select('*').eq('agency_id', itemLead.agency_id).maybeSingle(),
    db.from('whatsapp_outbox').select('sent_at').eq('lead_id', itemLead.id).eq('status', 'sent').eq('category', 'marketing').order('sent_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return outboxDecision({
    lead: itemLead, consentOk: consentRecordOk(consent?.agreed_to), template, settings, lastMarketingSentAt: lastMarketing?.sent_at ?? null,
    gapDays: settings?.marketing_gap_days ?? DEFAULT_MARKETING_GAP_DAYS, missing: missingValues(template.variables, values),
  });
}

/** "Send template" from a lead page: the message goes into the queue (approval first, unless the agency sends automatically). */
export const queueTemplate = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid(), templateId: z.string().uuid(), variables: variablesInput }))
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    // The caller's own access rules must allow this lead (agents: only their assigned leads).
    const { data: lead } = await context.supabase.from('leads').select('id,agency_id,phone,stopped,opted_in').eq('id', data.leadId).maybeSingle();
    if (!lead || lead.agency_id !== access.agencyId) throw new Error('Lead not found.');
    const { data: allowed } = await context.supabase.rpc('can_access_lead', { _lead: lead.id });
    if (allowed !== true) throw new Error('Only the agency owner or the assigned agent can message this lead.');
    const { data: template } = await context.supabase.from('message_templates').select('*').eq('id', data.templateId).eq('agency_id', access.agencyId).maybeSingle();
    if (!template) throw new Error('Template not found.');
    if (template.meta_status !== 'approved') return { error: 'Choose a template that Meta has approved.' };
    const values = Object.fromEntries([...new Set(templateTokens(template.body))].map(t => [t, cleanParam(data.variables[t])]));
    const db = await admin();
    const { data: settings } = await db.from('whatsapp_settings').select('send_mode').eq('agency_id', lead.agency_id).maybeSingle();
    const decision = await precheck(lead, template, values);
    const status = decision.action === 'block' ? 'blocked' : initialQueueStatus(settings?.send_mode ?? 'approve');
    const auto = status === 'approved';
    const { data: row, error } = await db.from('whatsapp_outbox').insert({
      lead_id: lead.id, agency_id: lead.agency_id, template_id: template.id, template_name: template.name, category: template.category, variables: values,
      preview: renderTemplate(template.body, values).slice(0, 2000), purpose: 'manual', status,
      block_reason: decision.action === 'block' ? decision.reason : null, created_by: context.userId,
      ...(auto ? { approved_at: new Date().toISOString() } : {}),
    }).select('id').single();
    if (error || !row) throw new Error('Could not add the message to the queue.');
    if (auto) {
      const { processOutbox } = await import('./whatsapp-outbox.server');
      await processOutbox(db, [row.id], 1);
    }
    const { data: after } = await db.from('whatsapp_outbox').select('status,block_reason,send_after,error').eq('id', row.id).single();
    return { id: row.id, ...after };
  });

async function queueItemFor(context: Ctx, id: string) {
  const access = await getAccess(context.supabase, context.userId);
  // Visible only when the caller may see the lead (RLS), and only inside their own agency.
  const { data: item } = await context.supabase.from('whatsapp_outbox').select('*').eq('id', id).eq('agency_id', access.agencyId).maybeSingle();
  if (!item) throw new Error('Queue item not found.');
  const { data: allowed } = await context.supabase.rpc('can_access_lead', { _lead: item.lead_id });
  if (allowed !== true) throw new Error('Only the agency owner or the assigned agent can do this.');
  return item;
}

/** Approve (or retry a blocked item): every rule is checked again, then it sends now or waits for 9am Dubai. */
export const approveQueueItem = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    const item = await queueItemFor(context, data.id);
    if (!canApprove(item.status)) return { error: 'This message can no longer be approved.' };
    const db = await admin();
    const { data: rows } = await db.from('whatsapp_outbox').update({ status: 'approved', approved_by: context.userId, approved_at: new Date().toISOString(), block_reason: null, error: null, send_after: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', item.id).in('status', ['pending_approval', 'blocked']).select('id');
    if (!rows?.length) return { error: 'This message changed meanwhile. Refresh and try again.' };
    const { processOutbox } = await import('./whatsapp-outbox.server');
    await processOutbox(db, [item.id], 1);
    const { data: after } = await db.from('whatsapp_outbox').select('status,block_reason,send_after,error').eq('id', item.id).single();
    return { ...after };
  });

export const editQueueVariables = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), variables: variablesInput })).handler(async ({ data, context }) => {
    const item = await queueItemFor(context, data.id);
    if (!canEditVariables(item.status)) return { error: 'This message can no longer be changed.' };
    const { data: template } = item.template_id ? await context.supabase.from('message_templates').select('body').eq('id', item.template_id).maybeSingle() : { data: null };
    if (!template) return { error: 'The template no longer exists.' };
    const values = Object.fromEntries([...new Set(templateTokens(template.body))].map(t => [t, cleanParam(data.variables[t])]));
    const db = await admin();
    const { error } = await db.from('whatsapp_outbox').update({ variables: values, preview: renderTemplate(template.body, values).slice(0, 2000), updated_at: new Date().toISOString() })
      .eq('id', item.id).in('status', ['pending_approval', 'approved', 'scheduled', 'blocked']);
    if (error) throw new Error('Could not save the changes.');
    return { success: true };
  });

export const cancelQueueItem = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    const item = await queueItemFor(context, data.id);
    if (!canCancel(item.status)) return { error: 'This message can no longer be cancelled.' };
    const db = await admin();
    const { data: rows } = await db.from('whatsapp_outbox').update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', item.id).in('status', ['pending_approval', 'approved', 'scheduled', 'blocked']).is('chat_message_id', null).select('id');
    if (!rows?.length) return { error: 'This message is already being sent.' };
    return { success: true };
  });

/** Approved templates + the lead's prefilled blanks for the lead page "Send template" panel. */
export const getSendTemplateOptions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid() })).handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const [{ data: templates }, { data: recent }, { data: settings }] = await Promise.all([
      context.supabase.from('message_templates').select('id,label,category,language,body,variables').eq('agency_id', access.agencyId).eq('meta_status', 'approved').order('label'),
      context.supabase.from('whatsapp_outbox').select('id,status,preview,block_reason,send_after,sent_at,created_at').eq('lead_id', data.leadId).order('created_at', { ascending: false }).limit(5),
      context.supabase.from('whatsapp_settings').select('send_mode').eq('agency_id', access.agencyId).maybeSingle(),
    ]);
    return { templates: templates ?? [], recent: recent ?? [], sendMode: settings?.send_mode ?? 'approve' };
  });
