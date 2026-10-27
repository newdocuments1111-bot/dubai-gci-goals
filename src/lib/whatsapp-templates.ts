/** Browser-safe rules for WhatsApp message templates and the send queue (shared by pages, server functions and the send job). */
import { phoneDigits, sendBlockReason, type WhatsAppSettingsLike } from './whatsapp';

export const SUGGESTED_TOKENS = ['name', 'property', 'area', 'price'] as const;
export const STOP_LINE = 'Reply STOP to stop.';
export const TEMPLATE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'ar', label: 'Arabic' },
] as const;
export const TEMPLATE_BODY_LIMIT = 1024;
export const MAX_TOKENS = 10;
export const DEFAULT_MARKETING_GAP_DAYS = 7;
export const SEND_START_HOUR = 9;
export const SEND_END_HOUR = 20;
const DUBAI_OFFSET_MS = 4 * 3600_000; // Dubai is UTC+4 all year (no daylight saving).

export type TemplateCategory = 'marketing' | 'utility';
export type MetaStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
export type QueueStatus = 'pending_approval' | 'approved' | 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'blocked';
export const QUEUE_STATUSES: QueueStatus[] = ['pending_approval', 'approved', 'scheduled', 'sent', 'failed', 'cancelled', 'blocked'];
export const QUEUE_PURPOSES = ['manual', 'listing_match', 'launch', 'renewal', 'referral'] as const;

const TOKEN_RE = /\{\{\s*([a-z][a-z0-9_]{0,29})\s*\}\}/g;

/** Named blanks in the order they appear, e.g. "Hi {{name}}" → ["name"]. Repeats are kept (each fills its own Meta position). */
export function templateTokens(body: string) {
  return [...body.matchAll(TOKEN_RE)].map(m => m[1]!);
}

/** Marketing templates must end with "Reply STOP to stop" — added automatically when missing. */
export function ensureStopLine(body: string, category: TemplateCategory) {
  const text = body.trim();
  if (category !== 'marketing') return text;
  if (/reply stop to stop\.?$/i.test(text)) return text;
  return `${text}\n\n${STOP_LINE}`;
}

/** Meta template names: lowercase letters, digits and underscores. */
export function templateNameFrom(label: string) {
  const name = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  return name || 'template';
}

/** Named blanks → Meta's numbered blanks: "Hi {{name}} in {{area}}" → "Hi {{1}} in {{2}}", variables ["name","area"]. */
export function toMetaBody(body: string) {
  const variables: string[] = [];
  const metaBody = body.replace(TOKEN_RE, (_m, token: string) => { variables.push(token); return `{{${variables.length}}}`; });
  return { metaBody, variables };
}

/** Plain-language problems that Meta would reject, or an empty list when the template is fine to submit. */
export function templateProblems(input: { label: string; body: string; category: TemplateCategory; examples: Record<string, string> }) {
  const problems: string[] = [];
  const body = ensureStopLine(input.body, input.category);
  if (!input.label.trim()) problems.push('Give the template a name.');
  if (!input.body.trim()) problems.push('Write the message.');
  if (body.length > TEMPLATE_BODY_LIMIT) problems.push(`The message is too long (${body.length} of ${TEMPLATE_BODY_LIMIT} characters).`);
  const withoutTokens = body.replace(TOKEN_RE, ' ');
  if (/\{\{|\}\}/.test(withoutTokens)) problems.push('Blanks must look like {{name}} — lowercase letters only, no spaces.');
  const tokens = templateTokens(body);
  if (tokens.length > MAX_TOKENS) problems.push(`Use at most ${MAX_TOKENS} blanks.`);
  if (tokens.length) {
    if (/^\s*\{\{/.test(body)) problems.push('The message cannot start with a blank. Add a word first, e.g. "Hi {{name}}".');
    if (/\}\}\s*[.!?]?\s*$/.test(body)) problems.push('The message cannot end with a blank. Add a few words after it.');
    if (/\}\}\s*\{\{/.test(body)) problems.push('Two blanks cannot sit next to each other. Put words between them.');
    const words = withoutTokens.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
    if (words < tokens.length * 3 + 2) problems.push('Add more words around the blanks — Meta rejects short messages with many blanks.');
    const missing = [...new Set(tokens)].filter(t => !(input.examples[t] ?? '').trim());
    if (missing.length) problems.push(`Add an example value for: ${missing.join(', ')}.`);
  }
  return problems;
}

/** Fill the blanks for a preview; empty blanks show as [token]. */
export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(TOKEN_RE, (_m, token: string) => (values[token] ?? '').trim() || `[${token}]`);
}

/** Meta refuses parameters with new lines, tabs or more than 4 spaces in a row. */
export function cleanParam(value: string | undefined) {
  return (value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 500);
}

export function missingValues(tokens: string[], values: Record<string, string>) {
  return [...new Set(tokens)].filter(t => !cleanParam(values[t]));
}

/** Meta's template status → ours. */
export function mapMetaStatus(status: string): Exclude<MetaStatus, 'draft'> {
  switch (status.toUpperCase()) {
    case 'APPROVED': return 'approved';
    case 'REJECTED': return 'rejected';
    case 'PAUSED': return 'paused';
    case 'DISABLED': case 'DELETED': case 'PENDING_DELETION': case 'ARCHIVED': case 'LIMIT_EXCEEDED': return 'disabled';
    default: return 'pending';
  }
}

/** Is it 9am–8pm in Dubai? If not, when is the next 9am? */
export function dubaiSendWindow(now = new Date()) {
  const local = new Date(now.getTime() + DUBAI_OFFSET_MS);
  const hour = local.getUTCHours();
  const open = hour >= SEND_START_HOUR && hour < SEND_END_HOUR;
  if (open) return { open, nextOpen: now };
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + (hour >= SEND_END_HOUR ? 86_400_000 : 0);
  return { open, nextOpen: new Date(day + SEND_START_HOUR * 3600_000 - DUBAI_OFFSET_MS) };
}

/** The latest consent record must be an agreement (not a withdrawal or STOP). */
export function consentRecordOk(latestAgreedTo: string | null | undefined) {
  return !!latestAgreedTo && !/^(withdr|stop)/i.test(latestAgreedTo.trim());
}

export function initialQueueStatus(sendMode: string): QueueStatus {
  return sendMode === 'auto' ? 'approved' : 'pending_approval';
}

export const canApprove = (s: string) => s === 'pending_approval' || s === 'blocked';
export const canEditVariables = (s: string) => ['pending_approval', 'approved', 'scheduled', 'blocked'].includes(s);
export const canCancel = (s: string) => ['pending_approval', 'approved', 'scheduled', 'blocked'].includes(s);

export type OutboxDecision = { action: 'send' } | { action: 'block'; reason: string } | { action: 'schedule'; at: Date };

const dubaiDay = (d: Date) => new Date(d.getTime() + DUBAI_OFFSET_MS).toISOString().slice(0, 10);

/** Every rule re-checked right before each send. */
export function outboxDecision(input: {
  lead: { phone: string; stopped: boolean; opted_in: boolean };
  consentOk: boolean;
  template: { meta_status: string; category: string } | null;
  settings: WhatsAppSettingsLike | null | undefined;
  lastMarketingSentAt: string | null | undefined;
  gapDays: number;
  missing?: string[];
  now?: Date;
}): OutboxDecision {
  const now = input.now ?? new Date();
  const t = input.template;
  if (!t) return { action: 'block', reason: 'The template no longer exists.' };
  if (t.meta_status !== 'approved') return { action: 'block', reason: `The template is not approved by Meta (status: ${t.meta_status}).` };
  if (input.lead.stopped) return { action: 'block', reason: 'This client asked to stop. No more messages are sent.' };
  if (!input.lead.opted_in || !input.consentOk) return { action: 'block', reason: 'No recorded consent. Tick "Client agreed to future property check-ins" on the lead page first.' };
  if (phoneDigits(input.lead.phone).length < 6) return { action: 'block', reason: 'This lead has no WhatsApp number.' };
  const safety = sendBlockReason({ settings: input.settings, to: input.lead.phone, stopped: false, lastInboundAt: null, template: true, now });
  if (safety) return { action: 'block', reason: safety };
  if (input.missing?.length) return { action: 'block', reason: `Fill in: ${input.missing.join(', ')}.` };
  if (t.category === 'marketing' && input.lastMarketingSentAt) {
    const last = new Date(input.lastMarketingSentAt);
    const next = new Date(last.getTime() + input.gapDays * 86_400_000);
    if (now < next) return { action: 'block', reason: `A marketing message already went to this client on ${dubaiDay(last)}. Only one every ${input.gapDays} days (next allowed ${dubaiDay(next)}).` };
  }
  const w = dubaiSendWindow(now);
  if (!w.open) return { action: 'schedule', at: w.nextOpen };
  return { action: 'send' };
}

export function queueStatusLabel(s: string) {
  switch (s) {
    case 'pending_approval': return 'Waiting for approval';
    case 'approved': return 'Approved — sending soon';
    case 'scheduled': return 'Scheduled';
    case 'sent': return 'Sent';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    case 'blocked': return 'Blocked';
    default: return s;
  }
}

export function metaStatusLabel(s: string) {
  switch (s) {
    case 'draft': return 'Draft — not sent to Meta';
    case 'pending': return 'Waiting for Meta review';
    case 'approved': return 'Approved by Meta';
    case 'rejected': return 'Rejected by Meta';
    case 'paused': return 'Paused by Meta';
    case 'disabled': return 'Disabled by Meta';
    default: return s;
  }
}
