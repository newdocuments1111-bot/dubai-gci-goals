import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isOwnerEmail } from './owner';
import { z } from 'zod';

const guard = (email: string | undefined) => { if (!isOwnerEmail(email)) throw new Error('Owner access required.'); };

export const listFollowUps = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.from('follow_ups').select('*, leads(name)').order('created_at', { ascending: false });
  if (error) throw new Error('Could not load follow-ups.');
  return data;
});

/** Approve sends the message into the lead's chat, marked Sent (until WhatsApp is connected). */
export const approveFollowUp = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), draft: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { error } = await context.supabase.rpc('approve_chat_follow_up', { p_id: data.id, p_draft: data.draft });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const cancelFollowUp = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { error } = await context.supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', data);
    if (error) throw new Error('Could not cancel the follow-up.');
    return { success: true };
  });

export const draftOldLeadRevivals = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.rpc('draft_old_lead_revivals');
  if (error) throw new Error('Could not draft old-lead check-ins.');
  return { count: data };
});
