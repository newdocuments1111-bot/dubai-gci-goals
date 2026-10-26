import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { defaultReplyRules, defaultFees, replySettingsSchema } from './ai-reply-rules';

export const getReplySettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data, error } = await context.supabase.from('ai_reply_settings').select('agency_name,rules,fees').eq('id', 'owner').maybeSingle();
  if (error) throw new Error('Could not load reply rules.');
  return replySettingsSchema.parse({ agency_name: data?.agency_name ?? '', rules: { ...defaultReplyRules, ...(data?.rules as object ?? {}) }, fees: { ...defaultFees, ...(data?.fees as object ?? {}) } });
});
export const saveReplySettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(replySettingsSchema).handler(async ({ data, context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { error } = await context.supabase.from('ai_reply_settings').upsert({ id: 'owner', ...data, updated_at: new Date().toISOString() });
  if (error) throw new Error('Could not save reply rules.');
  return { success: true };
});