import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isOwnerEmail } from './owner';
import { isWorkingDay } from './settings';
import { z } from 'zod';

const guard = (email: string | undefined) => { if (!isOwnerEmail(email)) throw new Error('Owner access required.'); };

export const listViewings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.from('viewings').select('*, leads(name), listings(title)').order('starts_at');
  if (error) throw new Error('Could not load viewings.');
  return data;
});

/** Free slots over the next 14 days: working days/hours from Settings, skipping holidays and existing bookings. */
export const freeSlots = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data: s } = await context.supabase.from('app_settings').select('*').eq('id', 'owner').maybeSingle();
  const settings = {
    working_days: (s?.working_days ?? ['Monday','Tuesday','Wednesday','Thursday','Friday']) as string[],
    holidays: (s?.holidays ?? []) as string[],
    work_start: String(s?.work_start ?? '09:00').slice(0, 5), work_end: String(s?.work_end ?? '18:00').slice(0, 5),
    viewing_minutes: s?.viewing_minutes ?? 30,
  };
  const { data: booked } = await context.supabase.from('viewings').select('starts_at').eq('status', 'booked');
  const taken = new Set((booked ?? []).map(b => new Date(b.starts_at).getTime()));
  const slots: string[] = [];
  const now = Date.now();
  for (let d = 0; d < 14 && slots.length < 40; d++) {
    const day = new Date(now + d * 86400000);
    const date = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
    if (!isWorkingDay(date, settings)) continue;
    const [sh, sm] = settings.work_start.split(':').map(Number);
    const [eh, em] = settings.work_end.split(':').map(Number);
    for (let mins = sh! * 60 + sm!; mins + settings.viewing_minutes <= eh! * 60 + em!; mins += settings.viewing_minutes) {
      const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
      const slot = new Date(`${date}T${hh}:${mm}:00+04:00`);
      if (slot.getTime() > now + 3600000 && !taken.has(slot.getTime())) slots.push(slot.toISOString());
    }
  }
  return slots;
});

export const bookViewing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ lead_id: z.string().uuid().nullable(), listing_id: z.string().uuid().nullable(), kind: z.enum(['viewing', 'valuation']), starts_at: z.string().datetime({ offset: true }) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { data: clash } = await context.supabase.from('viewings').select('id').eq('status', 'booked').eq('starts_at', data.starts_at).maybeSingle();
    if (clash) return { error: 'That slot is already booked. Pick another.' };
    const { error } = await context.supabase.from('viewings').insert(data);
    if (error) throw new Error('Could not book the viewing.');
    return { success: true };
  });

export const setViewingStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(['done', 'no-show', 'cancelled']) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
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
