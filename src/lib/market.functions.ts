import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isOwnerEmail } from './owner';
import { marketRowSchema } from './market';
import { z } from 'zod';

const guard = (email: string | undefined) => { if (!isOwnerEmail(email)) throw new Error('Owner access required.'); };

export const listMarketTransactions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.from('market_transactions').select('*').order('transaction_date', { ascending: false }).limit(500);
  if (error) throw new Error('Could not load market data.');
  return data;
});

export const importMarketData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ source: z.string().trim().max(200), rows: z.array(marketRowSchema).min(1).max(5000) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { error } = await context.supabase.from('market_transactions').insert(data.rows.map(r => ({ ...r, source: data.source })));
    if (error) throw new Error('Could not import the transactions.');
    return { success: true, count: data.rows.length };
  });
