import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess, requireHq } from './agency-access';
import { marketRowSchema } from './market';
import { z } from 'zod';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);
/** Shared reference data: every agency reads it, only Elite Visions HQ changes it. */
const hqGuard = (context: { supabase: Parameters<typeof getAccess>[0] }) => requireHq(context.supabase);

export const listMarketTransactions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await guard(context);
  const { data, error } = await context.supabase.from('market_transactions').select('*').order('transaction_date', { ascending: false }).limit(500);
  if (error) throw new Error('Could not load market data.');
  return data;
});

export const importMarketData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ source: z.string().trim().max(200), rows: z.array(marketRowSchema).min(1).max(5000) }))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from('market_transactions').insert(data.rows.map(r => ({ ...r, source: data.source })));
    if (error) throw new Error('Could not import the transactions.');
    return { success: true, count: data.rows.length };
  });
