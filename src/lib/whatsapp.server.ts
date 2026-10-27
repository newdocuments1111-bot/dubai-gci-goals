import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import type { Tables } from '@/integrations/supabase/types';
import { amlRedFlags, timezoneFromPhone } from './leads-app';
import { mapMetaStatus } from './whatsapp-templates';
import { appIsSubscribed, connectionSummary, META_APP_ID, missingScopes, type ConnectionFindings, describeIncoming, isStopMessage, phoneDigits, sendBlockReason, splitWebhookPayload, stopConfirmation, truncateForWhatsApp } from './whatsapp';

const GRAPH = 'https://graph.facebook.com/v25.0';
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
type Admin = typeof supabaseAdmin;
type Settings = Tables<'whatsapp_settings'>;
type Event = Tables<'whatsapp_webhook_events'>;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

export class WhatsAppApiError extends Error {}

function accessToken() {
  const token = process.env['WHATSAPP_ACCESS_TOKEN'];
  if (!token) throw new WhatsAppApiError('WHATSAPP_ACCESS_TOKEN is not added yet.');
  return token;
}

async function graph(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${GRAPH}${path}`, { ...init, headers: { Authorization: `Bearer ${token ?? accessToken()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) {
    console.error(`WhatsApp Graph request failed [${res.status}]: ${text}`);
    let detail = text.slice(0, 300);
    try { const e = obj(obj(JSON.parse(text))['error']); detail = `${String(e['message'] ?? 'Error')}${e['code'] ? ` (code ${String(e['code'])})` : ''}`; } catch { /* keep raw */ }
    throw new WhatsAppApiError(`Meta refused the request [${res.status}]: ${detail}`.slice(0, 900));
  }
  return text ? JSON.parse(text) as Obj : {};
}

function sentId(body: Obj) {
  const id = String(obj((body['messages'] as unknown[] | undefined)?.[0])['id'] ?? '');
  if (!id) throw new WhatsAppApiError('Meta did not return a message id.');
  return id;
}

export async function sendText(phoneNumberId: string, to: string, body: string) {
  return sentId(await graph(`/${phoneNumberId}/messages`, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phoneDigits(to), type: 'text', text: { preview_url: true, body: truncateForWhatsApp(body) } }) }));
}

/** Meta's built-in "hello_world" template, available on every test number. Used only by "Send test message". */
export async function sendHelloWorld(phoneNumberId: string, to: string) {
  return sentId(await graph(`/${phoneNumberId}/messages`, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', to: phoneDigits(to), type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } }) }));
}

/** Send an approved template; params fill {{1}}, {{2}}… in order. */
export async function sendTemplate(phoneNumberId: string, to: string, name: string, language: string, params: string[]) {
  return sentId(await graph(`/${phoneNumberId}/messages`, { method: 'POST', body: JSON.stringify({
    messaging_product: 'whatsapp', to: phoneDigits(to), type: 'template',
    template: { name, language: { code: language }, ...(params.length ? { components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] } : {}) },
  }) }));
}

/** Submit a new template to the WhatsApp Business Account for Meta review. */
export async function createMetaTemplate(wabaId: string, t: { name: string; language: string; category: string; metaBody: string; examples: string[] }) {
  const body = await graph(`/${wabaId}/message_templates`, { method: 'POST', body: JSON.stringify({
    name: t.name, language: t.language, category: t.category.toUpperCase(),
    components: [{ type: 'BODY', text: t.metaBody, ...(t.examples.length ? { example: { body_text: [t.examples] } } : {}) }],
  }) });
  const id = String(body['id'] ?? '');
  if (!id) throw new WhatsAppApiError('Meta did not return a template id.');
  return { id, status: mapMetaStatus(String(body['status'] ?? 'PENDING')) };
}

export type MetaTemplate = { id: string; name: string; language: string; status: string; rejected_reason: string };

/** Every template on the business account (up to 500). */
export async function listMetaTemplates(wabaId: string) {
  const out: MetaTemplate[] = [];
  let after = '';
  for (let page = 0; page < 5; page++) {
    const body = await graph(`/${wabaId}/message_templates?fields=id,name,language,status,rejected_reason&limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    for (const t of (body['data'] as unknown[] | undefined) ?? []) {
      const o = obj(t);
      out.push({ id: String(o['id'] ?? ''), name: String(o['name'] ?? ''), language: String(o['language'] ?? ''), status: String(o['status'] ?? ''), rejected_reason: String(o['rejected_reason'] ?? '') });
    }
    after = String(obj(obj(body['paging'])['cursors'])['after'] ?? '');
    if (!after || !obj(body['paging'])['next']) break;
  }
  return out;
}

/** Meta's reason codes ("NONE", "INVALID_FORMAT") → readable text, empty when there is no reason. */
export function rejectionText(reason: string) {
  const r = reason.trim();
  if (!r || r.toUpperCase() === 'NONE') return null;
  return r.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()).slice(0, 500);
}

/** message_template_status_update webhook: approve / reject / pause the matching template. */
async function applyTemplateStatus(admin: Admin, entryId: string, value: Obj) {
  const status = mapMetaStatus(String(value['event'] ?? ''));
  const metaId = String(value['message_template_id'] ?? '');
  const patch = { meta_status: status, rejection_reason: rejectionText(String(value['reason'] ?? '')), status_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (metaId) {
    const { data, error } = await admin.from('message_templates').update(patch).eq('meta_template_id', metaId).select('id');
    if (error) throw new Error(`Could not update the template: ${error.message}`);
    if (data?.length) return `Template ${String(value['message_template_name'] ?? '')} is now ${status}`;
  }
  const { data: settings } = await admin.from('whatsapp_settings').select('agency_id').eq('waba_id', entryId);
  const agencies = (settings ?? []).map(s => s.agency_id);
  if (!agencies.length) return 'No agency uses this business account';
  const { data, error } = await admin.from('message_templates').update({ ...patch, ...(metaId ? { meta_template_id: metaId } : {}) })
    .in('agency_id', agencies).eq('name', String(value['message_template_name'] ?? '')).eq('language', String(value['message_template_language'] ?? '')).select('id');
  if (error) throw new Error(`Could not update the template: ${error.message}`);
  return data?.length ? `Template ${String(value['message_template_name'] ?? '')} is now ${status}` : 'No matching template in the app';
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Could not reach Meta.').replace(/^Meta refused the request /, '').slice(0, 160);

/** Token permissions, app subscription (subscribes our app if missing) and number health — never returns any secret. */
export async function runConnectionChecks(phoneNumberId: string, wabaId: string) {
  const f: ConnectionFindings = { token: { valid: false, missing: [] }, subscription: { subscribed: false, fixedNow: false }, phone: { ok: false } };
  try {
    const secret = process.env['WHATSAPP_APP_SECRET'];
    let scopes: string[] = [];
    if (secret) {
      const d = obj((await graph(`/debug_token?input_token=${encodeURIComponent(accessToken())}`, {}, `${META_APP_ID}|${secret}`))['data']);
      f.token.valid = d['is_valid'] === true;
      f.token.expiresAt = typeof d['expires_at'] === 'number' ? d['expires_at'] : null;
      scopes = Array.isArray(d['scopes']) ? d['scopes'].map(String) : [];
      if (!f.token.valid) f.token.error = String(obj(d['error'])['message'] ?? 'Meta says the token is not valid');
    } else {
      const p = (await graph('/me/permissions'))['data'];
      f.token.valid = true;
      scopes = Array.isArray(p) ? p.filter(x => obj(x)['status'] === 'granted').map(x => String(obj(x)['permission'])) : [];
    }
    f.token.missing = missingScopes(scopes);
  } catch (e) { f.token.error = errText(e); }

  if (!wabaId) f.subscription.error = 'Add the WhatsApp Business Account ID first';
  else try {
    f.subscription.subscribed = appIsSubscribed(await graph(`/${wabaId}/subscribed_apps`));
    if (!f.subscription.subscribed) {
      await graph(`/${wabaId}/subscribed_apps`, { method: 'POST' });
      f.subscription.subscribed = appIsSubscribed(await graph(`/${wabaId}/subscribed_apps`));
      f.subscription.fixedNow = f.subscription.subscribed;
    }
  } catch (e) { f.subscription.error = errText(e); }

  try {
    const n = await graph(`/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status,account_mode`);
    f.phone = { ok: true, number: String(n['display_phone_number'] ?? ''), name: String(n['verified_name'] ?? ''), status: String(n['status'] ?? ''), quality: String(n['quality_rating'] ?? ''), mode: String(n['account_mode'] ?? '') };
  } catch (e) { f.phone = { ok: false, error: errText(e) }; }

  return connectionSummary(f);
}

/** Download incoming media with a hard size cap. The temporary Meta URL is never stored. */
async function downloadMedia(mediaId: string) {
  const meta = await graph(`/${encodeURIComponent(mediaId)}`);
  const url = String(meta['url'] ?? ''), mime = String(meta['mime_type'] ?? 'application/octet-stream');
  if (Number(meta['file_size'] ?? 0) > MAX_MEDIA_BYTES) throw new WhatsAppApiError('Media is larger than 8 MB.');
  if (!/^https:\/\//.test(url)) throw new WhatsAppApiError('Meta did not return a media link.');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken()}` } });
  if (!res.ok || !res.body) throw new WhatsAppApiError(`Could not download media [${res.status}].`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MEDIA_BYTES) { await reader.cancel(); throw new WhatsAppApiError('Media is larger than 8 MB.'); }
    chunks.push(value);
  }
  return { bytes: Buffer.concat(chunks), mime: mime.split(';')[0]!.trim() || mime };
}

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw body, app secret). */
export function verifyMetaSignature(raw: Buffer, header: string | null, secret: string) {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'), 'utf8');
  const given = Buffer.from(header.slice(7), 'utf8');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a).digest(), y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

/** Store every change from one webhook delivery in the inbox (once per key) and return the rows still to process. */
export async function storeWebhook(admin: Admin, body: unknown) {
  const split = splitWebhookPayload(body);
  if (!split.length) return [] as string[];
  const phones = [...new Set(split.map(e => e.phone_number_id).filter(Boolean))];
  const { data: settings, error: settingsError } = phones.length ? await admin.from('whatsapp_settings').select('agency_id,phone_number_id').in('phone_number_id', phones) : { data: [], error: null };
  if (settingsError) throw new Error('Could not read WhatsApp settings.');
  const agencyFor = (p: string) => settings?.find(s => s.phone_number_id === p)?.agency_id ?? null;
  const rows = split.map(e => ({
    delivery_key: e.delivery_key ?? `other:${e.field}:${createHash('sha256').update(JSON.stringify(e.payload)).digest('hex')}`,
    kind: e.kind, phone_number_id: e.phone_number_id, wa_id: e.wa_id, agency_id: agencyFor(e.phone_number_id),
    payload: e.payload as never,
  }));
  const { error } = await admin.from('whatsapp_webhook_events').upsert(rows, { onConflict: 'delivery_key', ignoreDuplicates: true });
  if (error) throw new Error(`Could not store the webhook: ${error.message}`);
  if (phones.length) await admin.from('whatsapp_settings').update({ last_webhook_at: new Date().toISOString() }).in('phone_number_id', phones);
  const { data: pending, error: readError } = await admin.from('whatsapp_webhook_events').select('id').in('delivery_key', rows.map(r => r.delivery_key)).is('processed_at', null);
  if (readError) throw new Error('Could not read the stored webhook.');
  return (pending ?? []).map(r => r.id);
}

async function finish(admin: Admin, id: string, outcome: string) {
  const { error } = await admin.from('whatsapp_webhook_events').update({ processed_at: new Date().toISOString(), outcome: outcome.slice(0, 500), processing_error: null, claimed_until: null }).eq('id', id);
  if (error) throw new Error('Could not mark the event processed.');
}

async function postpone(admin: Admin, ev: Event, message: string) {
  const minutes = Math.min(240, 2 ** Math.max(0, ev.attempts));
  await admin.from('whatsapp_webhook_events').update({ processing_error: message.slice(0, 1000), next_attempt_at: new Date(Date.now() + minutes * 60_000).toISOString(), claimed_until: null }).eq('id', ev.id);
}

/** Claim and process this delivery's rows plus a few overdue ones. Returns false if any of `ids` failed. */
export async function processEvents(admin: Admin, ids: string[], extra: number) {
  const { data: claimed, error } = await admin.rpc('claim_whatsapp_events', { p_ids: ids, p_extra: extra });
  if (error) throw new Error(`Could not claim webhook rows: ${error.message}`);
  let ok = true;
  for (const ev of claimed ?? []) {
    try {
      const outcome = await processEvent(admin, ev);
      if (outcome === null) await postpone(admin, ev, 'Waiting for the matching sent message.');
      else await finish(admin, ev.id, outcome);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('WhatsApp event failed', ev.delivery_key, message);
      await postpone(admin, ev, message);
      if (ids.includes(ev.id)) ok = false;
    }
  }
  return ok;
}

/** Returns an outcome note, or null to retry later (status for a message not saved yet). */
async function processEvent(admin: Admin, ev: Event): Promise<string | null> {
  const payload = obj(ev.payload);
  if (ev.kind === 'other') {
    if (payload['field'] === 'message_template_status_update') return applyTemplateStatus(admin, String(payload['entry_id'] ?? ''), obj(payload['value']));
    return `Stored (${String(payload['field'] ?? 'unknown')})`;
  }
  if (ev.kind === 'status') {
    const s = obj(payload['status']);
    const errors = (s['errors'] as unknown[] | undefined) ?? [];
    const e = obj(errors[0]);
    const errorText = errors.length ? `${String(e['title'] ?? e['message'] ?? 'Failed')}${e['code'] ? ` (code ${String(e['code'])})` : ''}` : null;
    const at = new Date(Number(s['timestamp'] ?? 0) * 1000 || Date.now()).toISOString();
    const { data: found, error } = await admin.rpc('apply_whatsapp_status', { p_wa_id: ev.wa_id, p_status: String(s['status'] ?? ''), p_at: at, p_error: errorText ?? '' });
    if (error) throw new Error(`Could not apply status: ${error.message}`);
    if (found) return `Status ${String(s['status'])} applied`;
    // A message sent outside this app (e.g. from Meta's dashboard) never matches; stop retrying after 30 minutes.
    return Date.now() - new Date(ev.received_at).getTime() > 30 * 60_000 ? 'No matching message in the app' : null;
  }
  return processMessage(admin, ev, payload);
}

async function settingsFor(admin: Admin, phoneNumberId: string) {
  const { data, error } = await admin.from('whatsapp_settings').select('*').eq('phone_number_id', phoneNumberId).maybeSingle();
  if (error) throw new Error('Could not read WhatsApp settings.');
  return data;
}

async function findOrCreateLead(admin: Admin, agencyId: string, from: string, profileName: string) {
  const tail = from.slice(-9);
  const { data: candidates, error } = await admin.from('leads').select('*').eq('agency_id', agencyId).ilike('phone', `%${tail}%`).order('created_at');
  if (error) throw new Error('Could not look up the lead.');
  const existing = (candidates ?? []).find(l => phoneDigits(l.phone) === from);
  if (existing) {
    if (!existing.name && profileName) await admin.from('leads').update({ name: profileName }).eq('id', existing.id);
    return { ...existing, name: existing.name || profileName };
  }
  const phone = `+${from}`;
  const { data: created, error: createError } = await admin.from('leads').insert({
    agency_id: agencyId, name: profileName.slice(0, 200), phone, source: 'WhatsApp', type: 'buyer', timezone: timezoneFromPhone(phone), assigned_agent_id: null,
  }).select('*').single();
  if (createError || !created) throw new Error(`Could not create the lead: ${createError?.message}`);
  return created;
}

async function processMessage(admin: Admin, ev: Event, payload: Obj): Promise<string> {
  const message = obj(payload['message']);
  const settings = await settingsFor(admin, ev.phone_number_id);
  if (!settings) return 'No agency uses this WhatsApp number';
  const incoming = describeIncoming(message);
  if (incoming.kind === 'ignore') return `Ignored ${String(message['type'])}`;
  const from = phoneDigits(String(message['from'] ?? ''));
  if (from.length < 6) return 'No sender number';
  const profileName = String(obj(obj(payload['contact'])['profile'])['name'] ?? '').trim();
  let lead = await findOrCreateLead(admin, settings.agency_id, from, profileName);
  const sentAt = new Date(Number(message['timestamp'] ?? 0) * 1000 || Date.now()).toISOString();

  // 1. Save the client's message once (dedupe by WhatsApp message id).
  const { data: existingInbound } = await admin.from('chat_messages').select('id,content').eq('wa_message_id', ev.wa_id).maybeSingle();
  let content = existingInbound?.content ?? '';
  let privacyRejected = false;
  if (!existingInbound) {
    let mediaPath: string | null = null, mediaKind: 'audio' | 'image' | null = null;
    content = incoming.content;
    if ((incoming.kind === 'audio' || incoming.kind === 'image') && incoming.mediaId) {
      const media = await downloadMedia(incoming.mediaId);
      const ext = incoming.kind === 'audio' ? (media.mime.includes('ogg') ? 'ogg' : media.mime.split('/')[1] ?? 'audio') : (media.mime.split('/')[1] ?? 'jpg');
      const file = new File([media.bytes], `whatsapp.${ext}`, { type: media.mime });
      const { inspectMedia } = await import('./media.server');
      const info = await inspectMedia(file);
      if (info.sensitive) {
        privacyRejected = true;
        content = '[Private document image removed]';
      } else {
        const path = `${lead.id}/${crypto.randomUUID()}`;
        const { error: uploadError } = await admin.storage.from('chat-media').upload(path, file, { contentType: media.mime });
        if (uploadError) throw new Error('Could not save the media.');
        mediaPath = path; mediaKind = info.kind;
        content = incoming.kind === 'image' && incoming.content ? `${info.content}\nCaption: ${incoming.content}` : info.content;
      }
    }
    if (!content.trim()) content = '[Empty message]';
    const { error: insertError } = await admin.from('chat_messages').insert({
      lead_id: lead.id, role: 'client', content, sent: true, channel: 'whatsapp', wa_message_id: ev.wa_id, media_path: mediaPath, media_kind: mediaKind, created_at: sentAt,
    });
    if (insertError && insertError.code !== '23505') throw new Error(`Could not save the message: ${insertError.message}`);
    if (!insertError) {
      const flags = amlRedFlags(content);
      if (flags.length) await admin.from('alerts').insert({ lead_id: lead.id, kind: 'aml', message: `AML red flags from ${lead.name || 'this lead'}: ${flags.join('; ')}. Report via REAR on goAML if required.` });
    }
  } else if (content === '[Private document image removed]') privacyRejected = true;
  const last = lead.whatsapp_last_inbound_at && lead.whatsapp_last_inbound_at > sentAt ? lead.whatsapp_last_inbound_at : sentAt;
  await admin.from('leads').update({ last_message_at: new Date().toISOString(), whatsapp_last_inbound_at: last }).eq('id', lead.id);
  lead = { ...lead, whatsapp_last_inbound_at: last };

  // 2. Already answered? Finish sending if needed, never generate twice.
  const { data: answered } = await admin.from('chat_messages').select('id,wa_status').eq('in_reply_to', ev.wa_id).maybeSingle();
  if (answered) {
    if (!answered.wa_status) await deliverChatMessage(admin, answered.id, { allowStopped: true });
    return 'Reply already handled';
  }

  // 3. STOP words: stop for good and confirm once.
  if (isStopMessage(content)) {
    if (lead.stopped) return 'Client already stopped';
    await admin.from('leads').update({ stopped: true, opted_in: false }).eq('id', lead.id);
    await admin.from('consent_log').insert({ lead_id: lead.id, agreed_to: 'Stopped all messages', how: 'Client sent a STOP word on WhatsApp' });
    const { data: note, error } = await admin.from('chat_messages').insert({ lead_id: lead.id, role: 'system', content: stopConfirmation(content), sent: false, channel: 'whatsapp', in_reply_to: ev.wa_id }).select('id').single();
    if (error || !note) throw new Error('Could not save the STOP confirmation.');
    await deliverChatMessage(admin, note.id, { allowStopped: true });
    return 'Client stopped messages; confirmed once';
  }
  if (lead.stopped) return 'Client has stopped messages; no reply';
  if (privacyRejected) {
    const { data: note, error } = await admin.from('chat_messages').insert({ lead_id: lead.id, role: 'ai', content: 'For your privacy, this document has not been kept in the chat. A secure upload link will be shared. Please do not send identity documents here.', sent: false, channel: 'whatsapp', in_reply_to: ev.wa_id }).select('id').single();
    if (error || !note) throw new Error('Could not save the privacy notice.');
    await deliverChatMessage(admin, note.id, {});
    return 'Identity document not kept; privacy notice sent';
  }
  if (lead.ai_paused) return 'Agent has taken over; AI did not reply';
  if (lead.flagged) return 'Chat is flagged for the agent; AI did not reply';
  const block = sendBlockReason({ settings, to: from, stopped: false, lastInboundAt: last });
  if (block) return `No AI reply: ${block}`;

  // 4. Same AI brain as Test Chat, then send.
  const { generateLeadReply } = await import('./ai-reply.server');
  const result = await generateLeadReply(admin, lead, { channel: 'whatsapp', where: 'WhatsApp', inReplyTo: ev.wa_id, privileged: true });
  const sent = await deliverChatMessage(admin, result.id, { allowStopped: result.stopped });
  return sent.ok ? 'AI replied on WhatsApp' : `AI reply saved but not sent: ${sent.reason}`;
}

/** Send one saved chat message to the lead on WhatsApp, after every safety check. Never sends the same row twice. */
export async function deliverChatMessage(admin: Admin, messageId: string, opts: { allowStopped?: boolean }) {
  const { data: msg, error } = await admin.from('chat_messages').select('id,lead_id,content,wa_status').eq('id', messageId).single();
  if (error || !msg) throw new Error('Message not found.');
  if (msg.wa_status) return { ok: msg.wa_status !== 'failed', reason: 'Already handled' };
  const { data: lead, error: leadError } = await admin.from('leads').select('id,agency_id,phone,stopped,whatsapp_last_inbound_at').eq('id', msg.lead_id).single();
  if (leadError || !lead) throw new Error('Lead not found.');
  const { data: settings } = await admin.from('whatsapp_settings').select('*').eq('agency_id', lead.agency_id).maybeSingle();
  // Claim the row so a retry or a second delivery can never send it again.
  const { data: claimed } = await admin.from('chat_messages').update({ wa_status: 'sending', channel: 'whatsapp' }).eq('id', msg.id).is('wa_status', null).select('id');
  if (!claimed?.length) return { ok: false, reason: 'Already being sent' };
  const block = sendBlockReason({ settings, to: lead.phone, stopped: lead.stopped && !opts.allowStopped, lastInboundAt: lead.whatsapp_last_inbound_at });
  if (block) {
    await admin.from('chat_messages').update({ wa_status: 'failed', wa_error: block, wa_failed_at: new Date().toISOString() }).eq('id', msg.id);
    return { ok: false, reason: block };
  }
  let wamid: string;
  try {
    wamid = await sendText((settings as Settings).phone_number_id, lead.phone, msg.content);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Send failed';
    await admin.from('chat_messages').update({ wa_status: 'failed', wa_error: reason.slice(0, 1000), wa_failed_at: new Date().toISOString() }).eq('id', msg.id);
    return { ok: false, reason };
  }
  const { error: saveError } = await admin.from('chat_messages').update({ wa_message_id: wamid, wa_status: 'accepted', sent: true }).eq('id', msg.id);
  if (saveError) console.error('WhatsApp message sent but its id could not be saved', msg.id, saveError.message);
  await reconcileStatuses(admin, wamid);
  return { ok: true, reason: '' };
}

/** Apply status callbacks that arrived before the sent message id was saved. */
export async function reconcileStatuses(admin: Admin, wamid: string) {
  const { data } = await admin.from('whatsapp_webhook_events').select('id').eq('kind', 'status').eq('wa_id', wamid).is('processed_at', null);
  if (data?.length) await processEvents(admin, data.map(r => r.id), 0);
}
