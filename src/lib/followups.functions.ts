import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { z } from 'zod';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);

export const listFollowUps = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await guard(context);
  const { data, error } = await context.supabase.from('follow_ups').select('*, leads(name)').eq('agency_id', access.agencyId).order('created_at', { ascending: false });
  if (error) throw new Error('Could not load follow-ups.');
  return data;
});

/** Approve sends the message into the lead's chat, marked Sent (until WhatsApp is connected). */
export const approveFollowUp = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), draft: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    await guard(context);
    const {data:follow,error:readError}=await context.supabase.from('follow_ups').select('kind,lead_id').eq('id',data.id).single();
    if(readError||!follow) throw new Error('Draft not found.');
    if(['viewing_followup','viewing_2day'].includes(follow.kind)) {
      const {data:messageId,error}=await context.supabase.rpc('claim_viewing_followup',{p_id:data.id,p_draft:data.draft});
      if(error||!messageId) throw new Error(error?.message??'Could not approve this draft.');
      const {data:message}=await context.supabase.from('chat_messages').select('channel').eq('id',messageId).single();
      if(message?.channel==='whatsapp') {
        const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
        const {deliverChatMessage}=await import('./whatsapp.server');
        const result=await deliverChatMessage(supabaseAdmin,messageId,{});
        const {error:statusError}=await context.supabase.from('follow_ups').update({status:result.ok?'sent':'blocked',sent_at:result.ok?new Date().toISOString():null}).eq('id',data.id);
        if(statusError) throw new Error('Reply delivery was checked, but follow-up status could not be saved.');
        if(!result.ok) throw new Error(`Not sent: ${result.reason}`);
      }
      return {success:true};
    }
    const { error } = await context.supabase.rpc('approve_chat_follow_up', { p_id: data.id, p_draft: data.draft });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const cancelFollowUp = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', data);
    if (error) throw new Error('Could not cancel the follow-up.');
    return { success: true };
  });

export const draftOldLeadRevivals = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await guard(context);
  const { data, error } = await context.supabase.rpc('draft_old_lead_revivals');
  if (error) throw new Error('Could not draft old-lead check-ins.');
  return { count: data };
});
