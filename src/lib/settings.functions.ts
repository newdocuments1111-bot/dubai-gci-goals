import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { defaultSettings, settingsSchema } from './settings';

export const getSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data, error } = await context.supabase.from('app_settings').select('*').eq('id', 'owner').maybeSingle();
  if (error) throw new Error('Could not load settings.');
  return settingsSchema.parse({ ...defaultSettings, ...(data ?? {}), work_start: String(data?.work_start ?? defaultSettings.work_start).slice(0, 5), work_end: String(data?.work_end ?? defaultSettings.work_end).slice(0, 5) });
});

export const saveSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(settingsSchema).handler(async ({ data, context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { error } = await context.supabase.from('app_settings').upsert({ id: 'owner', ...data, updated_at: new Date().toISOString() });
  if (error) throw new Error('Could not save settings.');
  return { success: true };
});
