/** Browser-safe WhatsApp rules shared by the webhook, agent replies and the settings page. */
import { clientScript, detectLanguage, t, type Language } from './reply-i18n';

export const PUBLIC_APP_URL = 'https://dubai-gci-goals.lovable.app';
export const WEBHOOK_PATH = '/api/public/whatsapp/webhook';
export const WEBHOOK_URL = `${PUBLIC_APP_URL}${WEBHOOK_PATH}`;
export const VERIFY_TOKEN_NAME = 'WHATSAPP_VERIFY_TOKEN';
export const SECRET_NAMES = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'] as const;
export const SERVICE_WINDOW_HOURS = 24;
export const WHATSAPP_TEXT_LIMIT = 4096;

/** Digits only, without a leading + or 00 (WhatsApp "wa_id" format). */
export function phoneDigits(phone: string) {
  return phone.replace(/\D/g, '').replace(/^00/, '');
}

/** Clean a typed safety list: digits only, 6–15 digits, no duplicates. */
export function normalizeRecipients(list: string[]) {
  const out: string[] = [];
  for (const raw of list) {
    const d = phoneDigits(raw);
    if (d.length >= 6 && d.length <= 15 && !out.includes(d)) out.push(d);
  }
  return out;
}

/** Free-form messages are allowed only within 24 hours of the buyer's last message. */
export function withinServiceWindow(lastInboundAt: string | null | undefined, now = new Date()) {
  if (!lastInboundAt) return false;
  const t = new Date(lastInboundAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < SERVICE_WINDOW_HOURS * 3600_000 && t <= now.getTime() + 60_000;
}

export function serviceWindowEndsAt(lastInboundAt: string | null | undefined) {
  if (!lastInboundAt) return null;
  return new Date(new Date(lastInboundAt).getTime() + SERVICE_WINDOW_HOURS * 3600_000);
}

const STOP_EXACT = ['stop', 'unsubscribe', 'stop all', 'stop please', 'please stop', 'توقف', 'إلغاء', 'الغاء', 'أوقف', 'اوقف', 'बंद करो', 'रुको', 'band karo', 'stop karo', 'message mat bhejo', 'стоп', 'отписаться', 'остановить', 'не пишите'];
/** STOP words: stop, unsubscribe, توقف, إلغاء — as the whole message, or "unsubscribe"/"stop messaging" anywhere. */
export function isStopMessage(text: string) {
  const t = text.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (STOP_EXACT.includes(t)) return true;
  if (/\bunsubscribe\b/.test(t)) return true;
  if (/\bstop (messaging|messages|texting|contacting|sending)\b/.test(t)) return true;
  if (/إلغاء الاشتراك|الغاء الاشتراك/.test(t)) return true;
  if (/(?:^|\s)(?:बंद करो|रुको|band karo|stop karo|message mat bhejo|стоп|отписаться|остановить|не пишите)(?:\s|$)/u.test(t)) return true;
  return false;
}

export function stopConfirmation(text: string, remembered: Language = 'en') {
  const lang = detectLanguage(text, remembered);
  return t(lang, 'stopped', {}, clientScript(text));
}

export type WhatsAppSettingsLike = { phone_number_id: string; test_mode: boolean; test_recipients: string[] };

/** Why a message may not be sent right now, or null when it is allowed. */
export function sendBlockReason(input: {
  settings: WhatsAppSettingsLike | null | undefined; to: string; stopped: boolean;
  lastInboundAt: string | null | undefined; template?: boolean; now?: Date;
}): string | null {
  const s = input.settings;
  if (!s || !s.phone_number_id) return 'WhatsApp is not set up for this agency yet.';
  const to = phoneDigits(input.to);
  if (to.length < 6) return 'This lead has no WhatsApp number.';
  if (input.stopped) return 'This client asked to stop. No more messages are sent.';
  if (s.test_mode && !normalizeRecipients(s.test_recipients).includes(to)) return 'Test mode is on: only numbers on the safety list can receive messages.';
  if (!input.template && !withinServiceWindow(input.lastInboundAt, input.now)) return 'The 24-hour WhatsApp window has closed. A free-form reply is only allowed within 24 hours of the client\'s last message.';
  return null;
}

export function truncateForWhatsApp(text: string) {
  return text.length <= WHATSAPP_TEXT_LIMIT ? text : `${text.slice(0, WHATSAPP_TEXT_LIMIT - 1)}…`;
}

export function waStatusLabel(status: string | null | undefined, error?: string | null) {
  switch (status) {
    case 'sending': return 'Sending… (not confirmed yet)';
    case 'accepted': return 'Sent to WhatsApp';
    case 'sent': return 'Sent';
    case 'delivered': return 'Delivered';
    case 'read': return 'Read';
    case 'failed': return `Not sent${error ? `: ${error}` : ''}`;
    default: return 'Saved';
  }
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

export type SplitEvent = { delivery_key: string | null; kind: 'message' | 'status' | 'other'; phone_number_id: string; wa_id: string; field: string; payload: Obj };

/** Split one Meta webhook body into one inbox row per message, per status, or per other change. */
export function splitWebhookPayload(body: unknown): SplitEvent[] {
  const out: SplitEvent[] = [];
  for (const entry of arr(obj(body)['entry'])) {
    for (const change of arr(obj(entry)['changes'])) {
      const c = obj(change), field = str(c['field']), value = obj(c['value']);
      const metadata = obj(value['metadata']);
      const phone = str(metadata['phone_number_id']).slice(0, 40);
      const messages = arr(value['messages']), statuses = arr(value['statuses']);
      const contacts = arr(value['contacts']);
      if (field === 'messages' && (messages.length || statuses.length)) {
        for (const m of messages) {
          const id = str(obj(m)['id']).slice(0, 200);
          if (!id) continue;
          const contact = contacts.find(x => str(obj(x)['wa_id']) === str(obj(m)['from'])) ?? contacts[0] ?? null;
          out.push({ delivery_key: `message:${id}`, kind: 'message', phone_number_id: phone, wa_id: id, field, payload: { metadata, contact, message: m } });
        }
        for (const s of statuses) {
          const id = str(obj(s)['id']).slice(0, 200), st = str(obj(s)['status']).slice(0, 30);
          if (!id || !st) continue;
          out.push({ delivery_key: `status:${id}:${st}`, kind: 'status', phone_number_id: phone, wa_id: id, field, payload: { metadata, status: s } });
        }
      } else {
        out.push({ delivery_key: null, kind: 'other', phone_number_id: phone, wa_id: '', field, payload: { entry_id: str(obj(entry)['id']), field, value } });
      }
    }
  }
  return out;
}

/** Turn a non-media incoming message into chat text. Media (audio/image) is handled on the server. */
export function describeIncoming(message: unknown): { kind: 'text' | 'audio' | 'image' | 'ignore' | 'unsupported'; content: string; mediaId?: string; mimeType?: string } {
  const m = obj(message), type = str(m['type']);
  if (type === 'text') return { kind: 'text', content: str(obj(m['text'])['body']).slice(0, 10000) };
  if (type === 'button') return { kind: 'text', content: str(obj(m['button'])['text']).slice(0, 1000) };
  if (type === 'interactive') {
    const i = obj(m['interactive']);
    const reply = obj(i['button_reply'] ?? i['list_reply']);
    return { kind: 'text', content: [str(reply['title']), str(reply['description'])].filter(Boolean).join(' — ').slice(0, 1000) };
  }
  if (type === 'location') {
    const l = obj(m['location']);
    const lat = Number(l['latitude']), lng = Number(l['longitude']);
    const label = [str(l['name']), str(l['address'])].filter(Boolean).join(', ');
    const link = Number.isFinite(lat) && Number.isFinite(lng) ? ` https://www.google.com/maps?q=${lat},${lng}` : '';
    return { kind: 'text', content: `Shared a location${label ? `: ${label}` : ''}.${link}`.slice(0, 1000) };
  }
  if (type === 'audio') { const a = obj(m['audio']); return { kind: 'audio', content: '', mediaId: str(a['id']), mimeType: str(a['mime_type']) }; }
  if (type === 'image') { const a = obj(m['image']); return { kind: 'image', content: str(a['caption']).slice(0, 1000), mediaId: str(a['id']), mimeType: str(a['mime_type']) }; }
  if (type === 'reaction' || type === 'system' || type === 'ephemeral') return { kind: 'ignore', content: '' };
  const label = type === 'document' ? 'a document' : type === 'video' ? 'a video' : type === 'sticker' ? 'a sticker' : type === 'contacts' ? 'a contact card' : 'a message type we cannot read';
  return { kind: 'unsupported', content: `[Client sent ${label}. It was not opened or kept. Ask them to type their question; never ask for documents in chat.]` };
}

/** Our Meta app ("Elite Visions"). It must be subscribed to each WhatsApp Business Account, or real messages never reach the webhook. */
export const META_APP_ID = '969605275709145';
export const REQUIRED_SCOPES = ['whatsapp_business_messaging', 'whatsapp_business_management'] as const;

export function missingScopes(granted: readonly string[]) {
  return REQUIRED_SCOPES.filter(s => !granted.includes(s));
}

/** True when the Graph `subscribed_apps` response lists the given app. */
export function appIsSubscribed(response: unknown, appId = META_APP_ID) {
  const list = (response as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(list)) return false;
  return list.some(item => {
    const app = (item as { whatsapp_business_api_data?: { id?: unknown }; id?: unknown } | null);
    return String(app?.whatsapp_business_api_data?.id ?? app?.id ?? '') === appId;
  });
}

export type ConnectionFindings = {
  token: { valid: boolean; missing: string[]; expiresAt?: number | null; error?: string };
  subscription: { subscribed: boolean; fixedNow: boolean; error?: string };
  phone: { ok: boolean; name?: string; number?: string; status?: string; quality?: string; mode?: string; error?: string };
};

/** One plain-language line for the Settings page (max 500 characters), and whether everything is ready. */
export function connectionSummary(f: ConnectionFindings) {
  const parts: string[] = [];
  if (!f.token.valid) parts.push(`Access token problem: ${f.token.error ?? 'not valid'}`);
  else if (f.token.missing.length) parts.push(`Access token is missing permission: ${f.token.missing.join(', ')}`);
  else parts.push(`Access token valid with messaging + management permissions${f.token.expiresAt === 0 ? ' (never expires)' : f.token.expiresAt ? ` (expires ${new Date(f.token.expiresAt * 1000).toISOString().slice(0, 10)})` : ''}`);
  if (f.subscription.error) parts.push(`App subscription problem: ${f.subscription.error}`);
  else if (f.subscription.subscribed) parts.push(f.subscription.fixedNow ? 'App was not subscribed to the business account — subscribed it now' : 'App is subscribed to the business account');
  else parts.push('App is NOT subscribed to the business account, so incoming messages cannot arrive');
  if (f.phone.ok) parts.push(`Number ${[f.phone.number, f.phone.name && `"${f.phone.name}"`].filter(Boolean).join(' ')}: ${[f.phone.status, f.phone.quality && `quality ${f.phone.quality}`, f.phone.mode].filter(Boolean).join(', ')}`);
  else parts.push(`Number check failed: ${f.phone.error ?? 'unknown error'}`);
  const ok = f.token.valid && f.token.missing.length === 0 && f.subscription.subscribed && !f.subscription.error && f.phone.ok;
  return { ok, detail: parts.join(' · ').slice(0, 500) };
}
