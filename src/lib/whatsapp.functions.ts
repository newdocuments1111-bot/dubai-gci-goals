import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess, requireHq } from './agency-access';
import { normalizeRecipients, phoneDigits, SECRET_NAMES } from './whatsapp';

export const getWhatsAppSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data: settings, error } = await context.supabase.from('whatsapp_settings').select('*').eq('agency_id', access.agencyId).maybeSingle();
  if (error) throw new Error('Could not load WhatsApp settings.');
  const canManage = access.isOwner || access.isHq;
  const { data: events } = canManage
    ? await context.supabase.from('whatsapp_webhook_events').select('id,kind,received_at,processed_at,outcome,processing_error,attempts').eq('agency_id', access.agencyId).order('received_at', { ascending: false }).limit(15)
    : { data: [] };
  return {
    settings,
    agencyName: access.agencyName,
    canEdit: access.isHq,
    canTest: canManage,
    // Only whether each secret has been added — never any part of its value.
    secrets: Object.fromEntries(SECRET_NAMES.map(n => [n, Boolean(process.env[n])])) as Record<(typeof SECRET_NAMES)[number], boolean>,
    events: events ?? [],
  };
});

const settingsInput = z.object({
  phone_number_id: z.string().trim().regex(/^\d{0,30}$/, 'Phone number ID must be digits only.'),
  waba_id: z.string().trim().regex(/^\d{0,30}$/, 'Business account ID must be digits only.'),
  display_number: z.string().trim().max(40),
  test_mode: z.boolean(),
  test_recipients: z.array(z.string().max(30)).max(20),
});

/** Elite Visions HQ connects numbers for agencies; each agency gets its own row. */
export const saveWhatsAppSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(settingsInput).handler(async ({ data, context }) => {
    await requireHq(context.supabase);
    const access = await getAccess(context.supabase, context.userId);
    const { data: current } = await context.supabase.from('whatsapp_settings').select('phone_number_id').eq('agency_id', access.agencyId).maybeSingle();
    const changedNumber = current?.phone_number_id !== data.phone_number_id;
    const { error } = await context.supabase.from('whatsapp_settings').upsert({
      agency_id: access.agencyId, ...data, test_recipients: normalizeRecipients(data.test_recipients), updated_at: new Date().toISOString(),
      ...(changedNumber ? { status: 'not_checked', status_detail: '', checked_at: null } : {}),
    }, { onConflict: 'agency_id' });
    if (error) throw new Error(error.message.includes('unique') ? 'Another agency already uses this phone number ID.' : 'Could not save WhatsApp settings.');
    return { success: true };
  });

async function managerSettings(context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) {
  const access = await getAccess(context.supabase, context.userId);
  if (!access.isOwner && !access.isHq) throw new Error('Only the agency owner can do this.');
  const { data } = await context.supabase.from('whatsapp_settings').select('*').eq('agency_id', access.agencyId).maybeSingle();
  if (!data?.phone_number_id) throw new Error('Add the phone number ID first.');
  return { access, settings: data };
}

/** Checks the token's permissions, subscribes our Meta app to the business account if missing, and reads the number's health. */
export const checkWhatsAppConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { settings } = await managerSettings(context);
  const { runConnectionChecks } = await import('./whatsapp.server');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await runConnectionChecks(settings.phone_number_id, settings.waba_id ?? '');
  await supabaseAdmin.from('whatsapp_settings').update({ status: result.ok ? 'connected' : 'error', status_detail: result.detail, checked_at: new Date().toISOString() }).eq('id', settings.id);
  return result;
});

/** Sends Meta's "hello_world" template — only ever to a number on the safety list. */
export const sendWhatsAppTestMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ to: z.string().max(30) })).handler(async ({ data, context }) => {
    const { access, settings } = await managerSettings(context);
    const to = phoneDigits(data.to);
    if (!normalizeRecipients(settings.test_recipients).includes(to)) throw new Error('Test messages can only go to a number on the safety list.');
    const { sendHelloWorld } = await import('./whatsapp.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    try {
      const id = await sendHelloWorld(settings.phone_number_id, to);
      await supabaseAdmin.from('usage_events').insert({ agency_id: access.agencyId, type: 'whatsapp_message' });
      return { ok: true, detail: `Meta accepted the test message (id ${id.slice(-12)}). It should arrive in a few seconds.` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : 'Could not send.' };
    }
  });
