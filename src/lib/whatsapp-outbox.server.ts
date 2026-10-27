import type { supabaseAdmin } from '@/integrations/supabase/client.server';
import type { Tables } from '@/integrations/supabase/types';
import { cleanParam, consentRecordOk, DEFAULT_MARKETING_GAP_DAYS, missingValues, outboxDecision, renderTemplate } from './whatsapp-templates';

type Admin = typeof supabaseAdmin;
type Item = Tables<'whatsapp_outbox'>;
const MAX_ATTEMPTS = 5;

export type OutboxRunResult = { sent: number; scheduled: number; blocked: number; failed: number; retry: number };

/** Claim due queue items (all, or just `ids`) and send each one only if every rule still passes. */
export async function processOutbox(admin: Admin, ids: string[] | null, limit: number): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { sent: 0, scheduled: 0, blocked: 0, failed: 0, retry: 0 };
  const { data: claimed, error } = await admin.rpc('claim_whatsapp_outbox', { p_ids: ids as string[], p_limit: limit });
  if (error) throw new Error(`Could not claim queue items: ${error.message}`);
  for (const item of claimed ?? []) {
    try {
      result[await processItem(admin, item)]++;
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
      console.error('WhatsApp queue item failed', item.id, message);
      const giveUp = item.attempts >= MAX_ATTEMPTS;
      await admin.from('whatsapp_outbox').update({ claimed_until: null, error: message, updated_at: new Date().toISOString(), ...(giveUp ? { status: 'failed' } : {}) }).eq('id', item.id);
      result[giveUp ? 'failed' : 'retry']++;
    }
  }
  return result;
}

async function update(admin: Admin, id: string, patch: Partial<Item>) {
  const { error } = await admin.from('whatsapp_outbox').update({ ...patch, claimed_until: null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`Could not update the queue item: ${error.message}`);
}

async function processItem(admin: Admin, item: Item): Promise<keyof OutboxRunResult> {
  // An earlier attempt got as far as sending: never send blindly again.
  if (item.chat_message_id) {
    const { data: msg } = await admin.from('chat_messages').select('wa_message_id,wa_status,wa_error').eq('id', item.chat_message_id).maybeSingle();
    if (msg?.wa_message_id) { await update(admin, item.id, { status: 'sent', sent_at: item.sent_at ?? new Date().toISOString(), wa_message_id: msg.wa_message_id }); return 'sent'; }
    await update(admin, item.id, { status: 'failed', error: msg?.wa_status === 'failed' ? msg.wa_error : 'Send outcome unknown — check the chat on WhatsApp before queueing it again.' });
    return 'failed';
  }

  const [{ data: lead }, { data: template }, { data: consent }] = await Promise.all([
    admin.from('leads').select('id,agency_id,phone,stopped,opted_in').eq('id', item.lead_id).maybeSingle(),
    item.template_id ? admin.from('message_templates').select('*').eq('id', item.template_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('consent_log').select('agreed_to').eq('lead_id', item.lead_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!lead) { await update(admin, item.id, { status: 'blocked', block_reason: 'The lead no longer exists.' }); return 'blocked'; }
  const { data: settings } = await admin.from('whatsapp_settings').select('*').eq('agency_id', lead.agency_id).maybeSingle();
  const { data: lastMarketing } = await admin.from('whatsapp_outbox').select('sent_at').eq('lead_id', lead.id).eq('status', 'sent').eq('category', 'marketing').neq('id', item.id)
    .order('sent_at', { ascending: false }).limit(1).maybeSingle();

  const values = (item.variables ?? {}) as Record<string, string>;
  const decision = outboxDecision({
    lead, consentOk: consentRecordOk(consent?.agreed_to), template: template && template.agency_id === lead.agency_id ? template : null,
    settings, lastMarketingSentAt: lastMarketing?.sent_at ?? null, gapDays: settings?.marketing_gap_days ?? DEFAULT_MARKETING_GAP_DAYS,
    missing: template ? missingValues(template.variables, values) : [],
  });
  if (decision.action === 'block') { await update(admin, item.id, { status: 'blocked', block_reason: decision.reason.slice(0, 500) }); return 'blocked'; }
  if (decision.action === 'schedule') { await update(admin, item.id, { status: 'scheduled', send_after: decision.at.toISOString(), block_reason: null }); return 'scheduled'; }

  const t = template!, s = settings!;
  const preview = renderTemplate(t.body, values).slice(0, 2000);
  // 1. Record the message in the lead's chat first, so the send can never be lost or repeated.
  const { data: msg, error: msgError } = await admin.from('chat_messages').insert({
    lead_id: lead.id, role: 'owner', author_id: item.approved_by ?? item.created_by, content: preview, sent: false, channel: 'whatsapp', wa_status: 'sending',
  }).select('id').single();
  if (msgError || !msg) throw new Error(`Could not save the message: ${msgError?.message}`);
  await update(admin, item.id, { chat_message_id: msg.id, preview, block_reason: null });

  // 2. Send through Meta.
  const { sendTemplate, reconcileStatuses } = await import('./whatsapp.server');
  let wamid: string;
  try {
    wamid = await sendTemplate(s.phone_number_id, lead.phone, t.name, t.language, t.variables.map(v => cleanParam(values[v])));
  } catch (e) {
    const reason = (e instanceof Error ? e.message : 'Send failed').slice(0, 1000);
    await admin.from('chat_messages').update({ wa_status: 'failed', wa_error: reason, wa_failed_at: new Date().toISOString() }).eq('id', msg.id);
    await update(admin, item.id, { status: 'failed', error: reason });
    return 'failed';
  }
  // 3. Store the WhatsApp id (delivery ticks match on it; the usage meter counts it).
  const now = new Date().toISOString();
  const { error: saveError } = await admin.from('chat_messages').update({ wa_message_id: wamid, wa_status: 'accepted', sent: true }).eq('id', msg.id);
  if (saveError) console.error('Template sent but its id could not be saved on the chat message', msg.id, saveError.message);
  await update(admin, item.id, { status: 'sent', sent_at: now, wa_message_id: wamid, error: null });
  await admin.from('leads').update({ last_message_at: now }).eq('id', lead.id);
  await reconcileStatuses(admin, wamid);
  return 'sent';
}
