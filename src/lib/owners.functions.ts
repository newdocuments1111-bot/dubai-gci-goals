import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { z } from 'zod';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);

export const ownerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().max(50),
  agreed_to_updates: z.boolean(),
  handover_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  kind: z.enum(['owner', 'investor']),
  update_frequency: z.enum(['quarterly', 'monthly']),
  area: z.string().trim().max(200),
  building: z.string().trim().max(200),
  lease_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export type OwnerInput = z.infer<typeof ownerSchema>;
export const emptyOwner = (): OwnerInput => ({ name: '', phone: '', agreed_to_updates: false, handover_date: null, kind: 'owner', update_frequency: 'quarterly', area: '', building: '', lease_end: null });

export const listOwners = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await guard(context);
  const { data, error } = await context.supabase.from('owners').select('*').eq('agency_id', access.agencyId).order('created_at', { ascending: false });
  if (error) throw new Error('Could not load owners.');
  return data;
});

export const saveOwner = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(ownerSchema.extend({ id: z.string().uuid().optional() })).handler(async ({ data, context }) => {
    await guard(context);
    const { id, ...fields } = data;
    const { error } = id
      ? await context.supabase.from('owners').update(fields).eq('id', id)
      : await context.supabase.from('owners').insert(fields);
    if (error) throw new Error('Could not save the owner.');
    return { success: true };
  });

export const deleteOwner = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from('owners').delete().eq('id', data);
    if (error) throw new Error('Could not delete the owner.');
    return { success: true };
  });
