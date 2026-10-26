import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { knowledgeSchema } from './knowledge';
import { z } from 'zod';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);

export const listKnowledge = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await guard(context);
  const { data, error } = await context.supabase.from('uae_knowledge').select('*').order('created_at');
  if (error) throw new Error('Could not load UAE knowledge.');
  return data;
});

export const addKnowledge = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(knowledgeSchema).handler(async ({ data, context }) => {
  await guard(context);
  const { error } = await context.supabase.from('uae_knowledge').insert({ ...data, last_verified: new Date().toISOString().slice(0, 10), needs_verification: false });
  if (error) throw new Error('Could not add the fact.');
  return { success: true };
});

export const updateKnowledge = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(knowledgeSchema.extend({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    await guard(context);
    const { id, ...fields } = data;
    const { error } = await context.supabase.from('uae_knowledge').update({ ...fields, last_verified: new Date().toISOString().slice(0, 10), needs_verification: false }).eq('id', id);
    if (error) throw new Error('Could not update the fact.');
    return { success: true };
  });

export const deleteKnowledge = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from('uae_knowledge').delete().eq('id', data);
    if (error) throw new Error('Could not delete the fact.');
    return { success: true };
  });
