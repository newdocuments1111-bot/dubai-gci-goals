import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { z } from 'zod';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);

export const listViewings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await guard(context);
  const { data, error } = await context.supabase.from('viewings').select('*, leads(name), listings(title)').eq('agency_id', access.agencyId).order('starts_at');
  if (error) throw new Error('Could not load viewings.');
  return data;
});

/** Free slots over the next 14 days: working days/hours from Settings, skipping holidays and existing bookings. */
export const freeSlots = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await guard(context);
  const { availableViewingSlots } = await import('./viewings.server');
  return availableViewingSlots(context.supabase, access.agencyId);
});

export const bookViewing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ lead_id: z.string().uuid().nullable(), listing_id: z.string().uuid().nullable(), kind: z.enum(['viewing', 'valuation']), starts_at: z.string().datetime({ offset: true }) }))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: booked } = await context.supabase.rpc('agency_booked_times');
    if ((booked ?? []).some(t => Date.parse(String(t)) === Date.parse(data.starts_at))) return { error: 'That slot is already booked. Pick another.' };
    const { error } = await context.supabase.from('viewings').insert(data);
    if (error?.code === '23505') return { error: 'That slot is already booked. Pick another.' };
    if (error) throw new Error('Could not book the viewing.');
    return { success: true };
  });

export const setViewingStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(['done', 'no-show', 'cancelled']) }))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from('viewings').update({ status: data.status }).eq('id', data.id);
    if (error) throw new Error('Could not update the viewing.');
    if (data.status === 'done') {
      // Next-morning follow-up at 10am in the client's time zone is scheduled by the nightly job;
      // queue the draft now so it is waiting on the Follow-ups page.
      const { data: v } = await context.supabase.from('viewings').select('lead_id').eq('id', data.id).single();
      if (v?.lead_id) {
        await context.supabase.from('follow_ups').insert({
          lead_id: v.lead_id, kind: 'follow-up',
          draft: 'Good morning! How was the viewing yesterday? Did you get a feel for the neighbourhood?',
          send_after: new Date(Date.now() + 86400000).toISOString(),
        });
      }
    }
    return { success: true };
  });
