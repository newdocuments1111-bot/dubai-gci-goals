import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { leadSchema, amlRedFlags } from './leads-app';
import { requireHq, requireOwner } from './agency-access';
import { sendBlockReason } from './whatsapp';
import { z } from 'zod';
import { clientScript, detectLanguage, normaliseLanguage } from './reply-i18n';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);

export const listLeads = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await guard(context);
  const { data, error } = await context.supabase.from('leads').select('*').eq('agency_id', access.agencyId).order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error('Could not load leads.');
  const order = { Hot: 0, Warm: 1, Cold: 2 };
  return data.sort((a, b) => order[a.score as keyof typeof order] - order[b.score as keyof typeof order]);
});

export const createLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadSchema).handler(async ({ data, context }) => {
    await guard(context);
    const { data: lead, error } = await context.supabase.from('leads').insert(data).select('id').single();
    if (error) throw new Error('Could not create the lead.');
    return lead;
  });

export const updateLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadSchema.partial().extend({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    await guard(context);
    const { id, ...fields } = data;
    const clean: { name?: string; phone?: string; type?: string; source?: string; timezone?: string } = {};
    if (fields.name !== undefined) clean.name = fields.name;
    if (fields.phone !== undefined) clean.phone = fields.phone;
    if (fields.type !== undefined) clean.type = fields.type;
    if (fields.source !== undefined) clean.source = fields.source;
    if (fields.timezone !== undefined) clean.timezone = fields.timezone;
    const { error } = await context.supabase.from('leads').update(clean).eq('id', id);
    if (error) throw new Error('Could not update the lead.');
    return { success: true };
  });

export const getLeadThread = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    await guard(context);
    const [{ data: lead, error }, { data: messages }] = await Promise.all([
      context.supabase.from('leads').select('*').eq('id', data).single(),
      context.supabase.from('chat_messages').select('*').eq('lead_id', data).order('created_at'),
    ]);
    if (error || !lead) throw new Error('Lead not found.');
    const resolved = await Promise.all((messages ?? []).map(async m => {
      if (!m.media_path) return { ...m, media_url: null };
      const { data: link } = await context.supabase.storage.from('chat-media').createSignedUrl(m.media_path, 600);
      return { ...m, media_url: link?.signedUrl ?? null };
    }));
    return { lead, messages: resolved };
  });

/** Pause or resume the AI on a conversation. The AI never replies while paused. */
export const setAiPaused = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), paused: z.boolean() })).handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from('leads').update({ ai_paused: data.paused }).eq('id', data.id);
    if (error) throw new Error('Could not update the conversation.');
    return { success: true };
  });

/** Owner plays the client in Test Chat: stores the message, then the AI replies unless paused or stopped. */
export const sendClientMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid(), content: z.string().trim().min(1).max(10000), languageHint: z.enum(['en','ar','hi','ru']).optional(), media: z.object({ path: z.string().max(200), kind: z.enum(['audio','image']) }).optional() }))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: lead, error: leadError } = await context.supabase.from('leads').select('*').eq('id', data.leadId).single();
    if (leadError || !lead) throw new Error('Lead not found.');
    if (lead.whatsapp_last_inbound_at) throw new Error('This is a real WhatsApp conversation, so you can only reply as yourself.');

    if (data.media && !data.media.path.startsWith(`${lead.id}/`)) throw new Error('Invalid attachment.');
    const language = detectLanguage(data.content, data.languageHint ?? normaliseLanguage(lead.language));
    const { error: messageError } = await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'client', content: data.content, language, sent: true, media_path: data.media?.path ?? null, media_kind: data.media?.kind ?? null });
    if (messageError) throw new Error('Could not save the message.');
    await context.supabase.from('leads').update({ last_message_at: new Date().toISOString(), language }).eq('id', data.leadId);

    // AML red flags — private, never shown to the client. The AI never accepts payments.
    const flags = amlRedFlags(data.content);
    if (flags.length) {
      await context.supabase.from('alerts').insert({ lead_id: data.leadId, kind: 'aml', message: `AML red flags from ${lead.name || 'this lead'}: ${flags.join('; ')}. Report via REAR on goAML if required.` });
    }
    if (lead.ai_paused || lead.stopped) return { replied: false };
    const { generateLeadReply } = await import('./ai-reply.server');
    const result = await generateLeadReply(context.supabase, { ...lead, language }, { channel: 'app', where: 'Test Chat', languageHint: data.languageHint });
    return { replied: Boolean(result.reply) };
  });

/** Owner's or agent's own message while taking over. On a WhatsApp conversation it is also sent to the buyer on WhatsApp. */
export const sendOwnerMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid(), content: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { data: lead, error: leadError } = await context.supabase.from('leads').select('id,phone,stopped,whatsapp_last_inbound_at').eq('id', data.leadId).single();
    if (leadError || !lead) throw new Error('Lead not found.');
    const onWhatsApp = Boolean(lead.whatsapp_last_inbound_at);
    if (onWhatsApp) {
      const { data: settings } = await context.supabase.from('whatsapp_settings').select('phone_number_id,test_mode,test_recipients').eq('agency_id', access.agencyId).maybeSingle();
      const block = sendBlockReason({ settings, to: lead.phone, stopped: lead.stopped, lastInboundAt: lead.whatsapp_last_inbound_at });
      if (block) throw new Error(`Not sent: ${block}`);
    }
    const { data: saved, error } = await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'owner', author_id: context.userId, content: data.content, sent: !onWhatsApp, channel: onWhatsApp ? 'whatsapp' : 'app' }).select('id').single();
    if (error || !saved) throw new Error('Could not send the message.');
    await context.supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', data.leadId);
    if (onWhatsApp) {
      // The caller has been checked against this lead by their own access rules above; the send itself uses server access.
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { deliverChatMessage } = await import('./whatsapp.server');
      const result = await deliverChatMessage(supabaseAdmin, saved.id, {});
      if (!result.ok) throw new Error(`Saved in the app but not sent on WhatsApp: ${result.reason}`);
    }
    return { success: true, whatsapp: onWhatsApp };
  });

export const saveLeadToHubSpot = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    await guard(context);
    // HubSpot is Elite Visions' own connected account, so only HQ may push contacts into it.
    await requireHq(context.supabase);
    const { data: lead } = await context.supabase.from('leads').select('*').eq('id', data).single();
    if (!lead) throw new Error('Lead not found.');
    const { data: messages } = await context.supabase.from('chat_messages').select('role,content').eq('lead_id', data).order('created_at').limit(30);
    const summary = (messages ?? []).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 5000) || '(no messages yet)';
    const { saveContactToHubSpot } = await import('./chat.server');
    const id = await saveContactToHubSpot({ name: lead.name || 'Unnamed lead', phone: lead.phone, note: `Dubai AI GCI chat summary (${lead.type}, ${lead.score}):\n${summary}`, existingId: lead.hubspot_id });
    await context.supabase.from('leads').update({ hubspot_id: id }).eq('id', data);
    return { success: true };
  });

export const listAlerts = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await guard(context);
  const { data, error } = await context.supabase.from('alerts').select('*').eq('agency_id', access.agencyId).order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error('Could not load alerts.');
  return data;
});

export const markAlertRead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    await guard(context);
    await context.supabase.from('alerts').update({ read: true }).eq('id', data);
    return { success: true };
  });

export const recordContactConsent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), agreed: z.boolean() })).handler(async ({ data, context }) => {
    await guard(context);
    const { error: logError } = await context.supabase.from('consent_log').insert({ lead_id: data.id, agreed_to: data.agreed ? 'Agreed to future property check-ins' : 'Withdrew future property check-in consent', how: 'Owner recorded client agreement' });
    if (logError) throw new Error('Could not record consent.');
    const { error } = await context.supabase.from('leads').update({ opted_in: data.agreed }).eq('id', data.id);
    if (error) throw new Error('Could not update consent.');
    return { success: true };
  });

/** Owner assigns a lead to an agent in the same agency (the database rejects anyone else). */
export const assignLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), agentId: z.string().uuid() })).handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from('leads').update({ assigned_agent_id: data.agentId }).eq('id', data.id);
    if (error) throw new Error(error.message.includes('agent') ? error.message : 'Could not assign the lead.');
    return { success: true };
  });

/** "Coach me": the AI reviews the agent's own replies and suggests 2–3 better ones. */
export const coachChat = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    await guard(context);
    const { data: messages, error } = await context.supabase.from('chat_messages').select('role,content,created_at').eq('lead_id', data).order('created_at', { ascending: false }).limit(40);
    if (error) throw new Error('Could not read this conversation.');
    const history = (messages ?? []).reverse();
    if (!history.some(m => m.role === 'owner')) return { summary: 'There are no agent-written replies in this chat yet. Take over and reply yourself, then ask for coaching.', suggestions: [] as { instead_of: string; try: string; why: string }[] };
    const { coachReplies } = await import('./coach.server');
    try {
      return await coachReplies(history.map(m => ({ role: m.role === 'owner' ? 'agent' : m.role === 'client' ? 'client' : 'ai', content: m.content.slice(0, 2000) })));
    } catch (e) {
      console.error(e);
      throw new Error('Coaching is not available right now. Please try again.');
    }
  });
