import { createHmac } from 'node:crypto';
import { supabaseAdmin as admin } from '@/integrations/supabase/client.server';
import { storeWebhook, processEvents, verifyMetaSignature } from '@/lib/whatsapp.server';

const start = new Date().toISOString();
const FROM = '971500000917';
const PHONE_ID = '1429713293548712';
const msg = (id: string, body: string) => ({ object: 'whatsapp_business_account', entry: [{ id: '1135797042296710', changes: [{ field: 'messages', value: {
  messaging_product: 'whatsapp', metadata: { display_phone_number: '15551729366', phone_number_id: PHONE_ID },
  contacts: [{ wa_id: FROM, profile: { name: 'Sim Tester' } }],
  messages: [{ id, from: FROM, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body } }],
} }] }] });

async function run(body: unknown) { const ids = await storeWebhook(admin, body); const ok = await processEvents(admin, ids, 0); return { ids, ok }; }

const raw = Buffer.from(JSON.stringify(msg('x', 'y')));
console.log('signature good:', verifyMetaSignature(raw, 'sha256=' + createHmac('sha256', 'fake').update(raw).digest('hex'), 'fake'), 'bad:', verifyMetaSignature(raw, 'sha256=00', 'fake'));
console.log('AI key present:', Boolean(process.env['LOVABLE_API_KEY']));

const id1 = 'wamid.SIM' + Date.now();
console.log('first:', await run(msg(id1, "Hi, I'm looking for a 2 bedroom in Dubai Marina to buy, budget around 2.5 million, moving in 3 months")));
console.log('duplicate:', await run(msg(id1, 'ignored duplicate')));
const status = { entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: PHONE_ID }, statuses: [{ id: 'wamid.UNKNOWN' + Date.now(), status: 'delivered', timestamp: '1761559200', recipient_id: FROM }] } }] }] };
console.log('unmatched status:', await run(status));
const id2 = 'wamid.SIM2' + Date.now();
console.log('stop:', await run(msg(id2, 'STOP')));
const id3 = 'wamid.SIM3' + Date.now();
console.log('after stop:', await run(msg(id3, 'hello again?')));

const { data: lead } = await admin.from('leads').select('id,name,phone,source,score,area,budget,timing,stopped,whatsapp_last_inbound_at,agency_id').like('phone', `%${FROM}`).single();
console.log('lead:', lead);
const { data: msgs } = await admin.from('chat_messages').select('role,channel,content,wa_status,wa_error,in_reply_to,wa_message_id').eq('lead_id', lead!.id).order('created_at');
for (const m of msgs ?? []) console.log(' -', m.role, m.channel, m.wa_status, '|', m.content.slice(0, 120), '|', m.wa_error ?? '');
const { data: evs } = await admin.from('whatsapp_webhook_events').select('id,kind,outcome,processing_error,processed_at,delivery_key').gte('received_at', start).order('received_at');
for (const e of evs ?? []) console.log(' event', e.kind, e.processed_at ? 'done' : 'pending', '|', e.outcome || e.processing_error);
const { count } = await admin.from('usage_events').select('id', { count: 'exact', head: true }).eq('agency_id', lead!.agency_id).eq('type', 'whatsapp_message').gte('created_at', start);
console.log('whatsapp_message usage rows:', count);

// Clean up everything this simulation created.
await admin.from('alerts').delete().eq('lead_id', lead!.id);
await admin.from('consent_log').delete().eq('lead_id', lead!.id);
await admin.from('viewings').delete().eq('lead_id', lead!.id);
await admin.from('chat_messages').delete().eq('lead_id', lead!.id);
await admin.from('leads').delete().eq('id', lead!.id);
await admin.from('whatsapp_webhook_events').delete().in('id', (evs ?? []).map(e => e.id));
await admin.from('usage_events').delete().eq('agency_id', lead!.agency_id).in('type', ['whatsapp_message', 'ai_reply']).gte('created_at', start);
console.log('cleaned up');
