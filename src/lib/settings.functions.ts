import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess, requireOwner } from './agency-access';
import { defaultSettings, settingsSchema } from './settings';
import { z } from 'zod';

export const getSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data, error } = await context.supabase.from('app_settings').select('*').eq('agency_id', access.agencyId).maybeSingle();
  if (error) throw new Error('Could not load settings.');
  const settings = settingsSchema.parse({
    ...defaultSettings, ...(data ?? {}),
    work_start: String(data?.work_start ?? defaultSettings.work_start).slice(0, 5), work_end: String(data?.work_end ?? defaultSettings.work_end).slice(0, 5),
    minutes_per_ai_reply: Number(data?.minutes_per_ai_reply ?? defaultSettings.minutes_per_ai_reply),
  });
  return { settings, goalMode: access.goalMode, isOwner: access.isOwner };
});

export const saveSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(settingsSchema).handler(async ({ data, context }) => {
  const access = await requireOwner(context.supabase, context.userId);
  const { error } = await context.supabase.from('app_settings').upsert({ agency_id: access.agencyId, ...data, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' });
  if (error) throw new Error('Could not save settings.');
  return { success: true };
});

export const saveGoalMode = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.enum(['agent', 'owner', 'both'])).handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.rpc('set_goal_setting_mode', { _mode: data });
    if (error) throw new Error(error.message);
    return { success: true };
  });
