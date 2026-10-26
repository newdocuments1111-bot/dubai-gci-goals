import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) => getAccess(context.supabase, context.userId);

export type ManagerStats = {
  leadsBySource: Record<string, number>;
  scoreBySource: Record<string, Record<string, number>>;
  totals: { leads: number; viewings: number; valuations: number; offers: number };
  weekly: { leads: number; viewings: number };
  monthly: { leads: number; viewings: number };
  avgFirstReplyMinutes: number | null;
  realRates: { callsToTalks: number | null; talksToAppraisals: number | null; appraisalsToListings: number | null; listingsToDeals: number | null };
};

export const getManagerStats = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<ManagerStats> => {
  const { agencyId } = await guard(context);
  const [{ data: leads, error: e1 }, { data: viewings, error: e2 }, { data: messages, error: e3 }, { data: listings, error: e4 }, { data: alerts, error: e5 }] = await Promise.all([
    context.supabase.from('leads').select('id,source,score,created_at').eq('agency_id', agencyId),
    context.supabase.from('viewings').select('kind,status,created_at').eq('agency_id', agencyId),
    context.supabase.from('chat_messages').select('lead_id,role,created_at').eq('agency_id', agencyId).eq('role', 'ai').order('created_at'),
    context.supabase.from('listings').select('status').eq('agency_id', agencyId),
    context.supabase.from('alerts').select('message').eq('agency_id', agencyId).eq('kind', 'hot'),
  ]);
  if (e1 || e2 || e3 || e4 || e5) throw new Error('Could not load statistics.');

  const allLeads = leads ?? [];
  const leadsBySource: Record<string, number> = {};
  const scoreBySource: Record<string, Record<string, number>> = {};
  for (const l of allLeads) {
    leadsBySource[l.source] = (leadsBySource[l.source] ?? 0) + 1;
    scoreBySource[l.source] ??= {};
    scoreBySource[l.source]![l.score] = (scoreBySource[l.source]![l.score] ?? 0) + 1;
  }

  const allViewings = viewings ?? [];
  const weekAgo = Date.now() - 7 * 86400000, monthAgo = Date.now() - 30 * 86400000;
  const inWindow = (iso: string, since: number) => Date.parse(iso) >= since;

  // Average time from lead creation to the first AI reply.
  const firstReply = new Map<string, string>();
  for (const m of messages ?? []) if (!firstReply.has(m.lead_id)) firstReply.set(m.lead_id, m.created_at);
  const leadCreated = new Map(allLeads.map(l => [l.id, l.created_at]));
  const delays = [...firstReply].map(([id, at]) => (Date.parse(at) - Date.parse(leadCreated.get(id) ?? at)) / 60000).filter(d => d >= 0);
  const avgFirstReplyMinutes = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null;

  // Real funnel rates from recorded activity. Calls are not tracked, so callsToTalks stays manual.
  const talked = firstReply.size;
  const appraisals = allViewings.length;
  const listingCount = (listings ?? []).length;
  const deals = (listings ?? []).filter(l => l.status === 'Sold').length;
  const pct = (part: number, whole: number) => whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

  return {
    leadsBySource,
    scoreBySource,
    totals: {
      leads: allLeads.length,
      viewings: allViewings.filter(v => v.kind === 'viewing').length,
      valuations: allViewings.filter(v => v.kind === 'valuation').length,
      offers: (alerts ?? []).filter(a => a.message.toLowerCase().includes('offer')).length,
    },
    weekly: { leads: allLeads.filter(l => inWindow(l.created_at, weekAgo)).length, viewings: allViewings.filter(v => inWindow(v.created_at, weekAgo)).length },
    monthly: { leads: allLeads.filter(l => inWindow(l.created_at, monthAgo)).length, viewings: allViewings.filter(v => inWindow(v.created_at, monthAgo)).length },
    avgFirstReplyMinutes,
    realRates: {
      callsToTalks: null,
      talksToAppraisals: pct(appraisals, talked),
      appraisalsToListings: pct(listingCount, appraisals),
      listingsToDeals: pct(deals, listingCount),
    },
  };
});
