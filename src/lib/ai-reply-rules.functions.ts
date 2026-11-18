import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess, requireOwner } from './agency-access';
import { defaultReplyRules, defaultFees, replySettingsSchema } from './ai-reply-rules';

export const getReplySettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data, error } = await context.supabase.from('ai_reply_settings').select('agency_name,rules,fees').eq('agency_id', access.agencyId).maybeSingle();
  if (error) throw new Error('Could not load reply rules.');
  // Read on its own so the page still loads (switch off) before the voice_replies column exists.
  const { data: voice } = await context.supabase.from('ai_reply_settings').select('voice_replies').eq('agency_id', access.agencyId).maybeSingle();
  return replySettingsSchema.parse({ agency_name: data?.agency_name ?? '', rules: { ...defaultReplyRules, ...(data?.rules as object ?? {}) }, fees: { ...defaultFees, ...(data?.fees as object ?? {}) }, voice_replies: voice?.voice_replies === true });
});
export const saveReplySettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(replySettingsSchema).handler(async ({ data, context }) => {
  const access = await requireOwner(context.supabase, context.userId);
  const { voice_replies, ...rest } = data;
  const { error } = await context.supabase.from('ai_reply_settings').upsert({ agency_id: access.agencyId, ...rest, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' });
  if (error) throw new Error('Could not save reply rules.');
  // Saved on its own so the rules above are kept even if the voice_replies column does not exist yet.
  const { error: voiceError } = await context.supabase.from('ai_reply_settings').update({ voice_replies }).eq('agency_id', access.agencyId);
  if (voiceError && voice_replies) throw new Error('Rules saved, but Voice replies could not be switched on.');
  return { success: true };
});
