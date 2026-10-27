import { supabaseAdmin as admin } from '@/integrations/supabase/client.server';
const { data: lead } = await admin.from('leads').insert({ agency_id: 'de000000-0000-4000-8000-000000000001', name: 'Status Sim', phone: '+971500000918', source: 'WhatsApp' }).select('id').single();
const wamid = 'wamid.STATUS' + Date.now();
const { data: m } = await admin.from('chat_messages').insert({ lead_id: lead!.id, role: 'ai', content: 'x', channel: 'whatsapp', wa_status: 'accepted', wa_message_id: wamid }).select('id').single();
for (const [s, t] of [['read', '2026-10-27T08:03:00Z'], ['sent', '2026-10-27T08:01:00Z'], ['delivered', '2026-10-27T08:02:00Z'], ['read', '2026-10-27T09:00:00Z']] as const) {
  await admin.rpc('apply_whatsapp_status', { p_wa_id: wamid, p_status: s, p_at: t, p_error: '' });
}
const { data: after } = await admin.from('chat_messages').select('wa_status,wa_sent_at,wa_delivered_at,wa_read_at').eq('id', m!.id).single();
console.log(after);
await admin.from('chat_messages').delete().eq('lead_id', lead!.id);
await admin.from('leads').delete().eq('id', lead!.id);
await admin.from('usage_events').delete().eq('agency_id', 'de000000-0000-4000-8000-000000000001').in('type', ['whatsapp_message', 'ai_reply']).gte('created_at', new Date(Date.now() - 120000).toISOString());
