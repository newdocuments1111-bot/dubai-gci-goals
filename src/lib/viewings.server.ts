import type { supabase as browserClient } from '@/integrations/supabase/client';
import { defaultSettings } from './settings';
import { calculateFreeSlots } from './viewing-slots';

export async function availableViewingSlots(supabase: typeof browserClient) {
  const [{ data: s, error: settingsError }, { data: booked, error: bookedError }] = await Promise.all([
    supabase.from('app_settings').select('*').eq('id', 'owner').maybeSingle(),
    supabase.from('viewings').select('starts_at').eq('status', 'booked'),
  ]);
  if (settingsError || bookedError) throw new Error('Could not check appointment times.');
  return calculateFreeSlots({
    working_days: s?.working_days ?? defaultSettings.working_days,
    holidays: s?.holidays ?? defaultSettings.holidays,
    work_start: String(s?.work_start ?? defaultSettings.work_start).slice(0, 5),
    work_end: String(s?.work_end ?? defaultSettings.work_end).slice(0, 5),
    viewing_minutes: s?.viewing_minutes ?? defaultSettings.viewing_minutes,
  }, (booked ?? []).map(b => b.starts_at));
}