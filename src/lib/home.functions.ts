import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess, requireOwner } from './agency-access';
import { averageReplyMinutes, canSetOwnGoal, dubaiDay, gciSummary, goalProgress, hoursSaved, memberName, rankLeaderboard, DEFAULT_MINUTES_PER_AI_REPLY, type DealRow } from './agency';

const dubaiMidnight = (now = new Date()) => new Date(`${dubaiDay(now)}T00:00:00+04:00`);
const dubaiMonthStart = (now = new Date()) => new Date(`${dubaiDay(now).slice(0, 7)}-01T00:00:00+04:00`);
const dealRows = (rows: { agent_id: string; price_aed: number; commission_percent: number; status: string; closed_at: string | null; ai_handled: boolean }[]): DealRow[] =>
  rows.map(d => ({ ...d, price_aed: Number(d.price_aed), commission_percent: Number(d.commission_percent) }));

/** Agent home: my GCI, goal, hot leads, today's viewings, follow-ups due and the AI daily summary. */
export const getAgentHome = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  await context.supabase.rpc('check_missed_leads');
  const me = context.userId, today = dubaiDay(new Date()), midnight = dubaiMidnight().toISOString();
  const [leadsRes, dealsRes, viewingsRes, followRes, msgRes, alertRes] = await Promise.all([
    context.supabase.from('leads').select('id,name,score,created_at,ai_paused,flagged,stopped,next_step,area,budget,timing').eq('agency_id', access.agencyId).eq('assigned_agent_id', me),
    context.supabase.from('deals').select('agent_id,price_aed,commission_percent,status,closed_at,ai_handled').eq('agency_id', access.agencyId).eq('agent_id', me),
    context.supabase.from('viewings').select('id,lead_id,kind,starts_at,leads(name)').eq('agency_id', access.agencyId).eq('status', 'booked').gte('starts_at', midnight).lt('starts_at', new Date(Date.parse(midnight) + 86400000).toISOString()).order('starts_at'),
    context.supabase.from('follow_ups').select('id,lead_id,kind,send_after').eq('agency_id', access.agencyId).eq('status', 'pending'),
    context.supabase.from('chat_messages').select('lead_id,role,created_at').eq('agency_id', access.agencyId).gte('created_at', midnight),
    context.supabase.from('alerts').select('id,lead_id,kind,message').eq('agency_id', access.agencyId).eq('read', false).in('kind', ['missed', 'hot']),
  ]);
  if (leadsRes.error || dealsRes.error) throw new Error('Could not load your home page.');
  const leads = leadsRes.data ?? [];
  const mine = new Set(leads.map(l => l.id));
  const isMine = (id: string | null) => id !== null && mine.has(id);
  const gci = gciSummary(dealRows(dealsRes.data ?? []), [{ user_id: me, display_name: '', email: '', split_percent: access.splitPercent, annual_gci_goal_aed: access.goal, role: access.role }]);
  const myShare = gci.perAgent.get(me);
  const viewingsToday = (viewingsRes.data ?? []).filter(v => isMine(v.lead_id));
  const now = Date.now();
  const followUpsDue = (followRes.data ?? []).filter(f => isMine(f.lead_id) && (!f.send_after || Date.parse(f.send_after) <= now));
  const todayMsgs = (msgRes.data ?? []).filter(m => isMine(m.lead_id));
  const missed = (alertRes.data ?? []).filter(a => a.kind === 'missed' && isMine(a.lead_id));

  // Paused chats where the client spoke last are waiting on the agent.
  const paused = leads.filter(l => l.ai_paused && !l.stopped).map(l => l.id);
  const waitingOnMe = new Set<string>();
  if (paused.length) {
    const { data: last } = await context.supabase.from('chat_messages').select('lead_id,role').in('lead_id', paused).order('created_at', { ascending: false }).limit(500);
    const seen = new Set<string>();
    for (const m of last ?? []) { if (seen.has(m.lead_id)) continue; seen.add(m.lead_id); if (m.role === 'client') waitingOnMe.add(m.lead_id); }
  }
  const name = (id: string) => leads.find(l => l.id === id)?.name || 'A lead';
  const needsMe: { text: string; leadId?: string }[] = [
    ...missed.map(a => ({ text: a.message, leadId: a.lead_id ?? undefined })),
    ...[...waitingOnMe].map(id => ({ text: `Reply to ${name(id)} — you took over this chat.`, leadId: id })),
    ...leads.filter(l => l.flagged).map(l => ({ text: `Check ${l.name || 'a lead'} — the AI flagged a question for you.`, leadId: l.id })),
    ...(followUpsDue.length ? [{ text: `${followUpsDue.length} follow-up${followUpsDue.length === 1 ? ' is' : 's are'} ready for your approval.` }] : []),
    ...leads.filter(l => l.score === 'Hot' && l.next_step).slice(0, 5).map(l => ({ text: `${l.name || 'Hot lead'}: ${l.next_step}`, leadId: l.id })),
  ];
  return {
    access,
    canSetGoal: canSetOwnGoal(access.goalMode, access.isOwner),
    gci: { month: myShare?.month ?? 0, year: myShare?.year ?? 0, myShareYear: myShare?.agentShareYear ?? 0 },
    goal: access.goal, progress: goalProgress(myShare?.year ?? 0, access.goal),
    hotLeads: leads.filter(l => l.score === 'Hot' && !l.stopped).slice(0, 8),
    viewingsToday: viewingsToday.map(v => ({ id: v.id, kind: v.kind, starts_at: v.starts_at, leadName: (v.leads as { name: string } | null)?.name ?? '' })),
    followUpsDue: followUpsDue.length,
    summary: {
      day: today,
      newLeads: leads.filter(l => dubaiDay(l.created_at) === today).length,
      aiHandledChats: new Set(todayMsgs.filter(m => m.role === 'ai').map(m => m.lead_id)).size,
      needsMe,
    },
  };
});

/** Owner home: agency GCI, shares, per-agent GCI, AI-handled deals, viewings kept vs no-shows, problems, leaderboard, usage and hours saved. */
export const getOwnerHome = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await requireOwner(context.supabase, context.userId);
  await context.supabase.rpc('check_missed_leads');
  const a = access.agencyId, monthStart = dubaiMonthStart().toISOString(), since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0);
  const [membersRes, dealsRes, leadsRes, viewingsRes, msgsRes, alertsRes, settingsRes, aiMonth, waMonth, needsCheck, overdue] = await Promise.all([
    context.supabase.from('agency_members').select('user_id,display_name,email,split_percent,annual_gci_goal_aed,role').eq('agency_id', a).in('role', ['owner', 'agent']),
    context.supabase.from('deals').select('agent_id,price_aed,commission_percent,status,closed_at,ai_handled').eq('agency_id', a),
    context.supabase.from('leads').select('id,name,assigned_agent_id,flagged,score').eq('agency_id', a),
    context.supabase.from('viewings').select('lead_id,status,starts_at').eq('agency_id', a).gte('starts_at', since30),
    context.supabase.from('chat_messages').select('lead_id,role,created_at').eq('agency_id', a).gte('created_at', since30).limit(10000),
    context.supabase.from('alerts').select('id,lead_id,kind,message,created_at').eq('agency_id', a).eq('read', false).in('kind', ['missed', 'aml']).order('created_at', { ascending: false }).limit(50),
    context.supabase.from('app_settings').select('minutes_per_ai_reply,missed_lead_minutes').eq('agency_id', a).maybeSingle(),
    count(context.supabase.from('usage_events').select('id', { count: 'exact', head: true }).eq('agency_id', a).eq('type', 'ai_reply').gte('created_at', monthStart)),
    count(context.supabase.from('usage_events').select('id', { count: 'exact', head: true }).eq('agency_id', a).eq('type', 'whatsapp_message').gte('created_at', monthStart)),
    count(context.supabase.from('listings').select('id', { count: 'exact', head: true }).eq('agency_id', a).eq('needs_check', true)),
    count(context.supabase.from('follow_ups').select('id', { count: 'exact', head: true }).eq('agency_id', a).eq('status', 'pending').lt('send_after', new Date(Date.now() - 86400000).toISOString())),
  ]);
  if (membersRes.error || dealsRes.error || leadsRes.error) throw new Error('Could not load the owner home page.');
  const members = membersRes.data ?? [];
  const uniqueMembers = [...new Map(members.map(m => [m.user_id, m])).values()];
  const leads = leadsRes.data ?? [];
  const gci = gciSummary(dealRows(dealsRes.data ?? []), uniqueMembers.map(m => ({ ...m, split_percent: Number(m.split_percent), annual_gci_goal_aed: m.annual_gci_goal_aed === null ? null : Number(m.annual_gci_goal_aed) })));
  const leadOwner = new Map(leads.map(l => [l.id, l.assigned_agent_id]));
  const viewings = viewingsRes.data ?? [];
  const thisMonth = viewings.filter(v => v.starts_at >= monthStart);
  const msgs = msgsRes.data ?? [];
  const minutesPerReply = Number(settingsRes.data?.minutes_per_ai_reply ?? DEFAULT_MINUTES_PER_AI_REPLY);

  const leaderboard = rankLeaderboard(uniqueMembers.map(m => ({
    userId: m.user_id, name: memberName(m),
    gciYear: gci.perAgent.get(m.user_id)?.year ?? 0,
    avgReplyMinutes: averageReplyMinutes(msgs.filter(x => leadOwner.get(x.lead_id) === m.user_id)),
    viewings: viewings.filter(v => v.lead_id && leadOwner.get(v.lead_id) === m.user_id && v.status !== 'cancelled').length,
  })));

  const problems: { text: string; leadId?: string; kind: string }[] = [
    ...(alertsRes.data ?? []).map(x => ({ text: x.kind === 'aml' ? `⚠️ ${x.message}` : x.message, leadId: x.lead_id ?? undefined, kind: x.kind })),
    ...leads.filter(l => l.flagged).map(l => ({ text: `Flagged chat: ${l.name || 'a lead'} asked something the AI should not answer alone.`, leadId: l.id, kind: 'flagged' })),
    ...leads.filter(l => !l.assigned_agent_id).map(l => ({ text: `${l.name || 'A lead'} has no agent assigned.`, leadId: l.id, kind: 'unassigned' })),
    ...(needsCheck ? [{ text: `${needsCheck} listing${needsCheck === 1 ? ' needs' : 's need'} checking before the AI can offer ${needsCheck === 1 ? 'it' : 'them'}.`, kind: 'listings' }] : []),
    ...(overdue ? [{ text: `${overdue} follow-up${overdue === 1 ? ' has' : 's have'} waited more than a day for approval.`, kind: 'followups' }] : []),
  ];

  return {
    access,
    gci: { month: gci.month, year: gci.year, agencyMonth: gci.agencyMonth, agencyYear: gci.agencyYear, aiHandledDeals: gci.aiHandledDeals, aiHandledGciYear: gci.aiHandledGciYear },
    perAgent: uniqueMembers.map(m => ({ userId: m.user_id, name: memberName(m), month: gci.perAgent.get(m.user_id)?.month ?? 0, year: gci.perAgent.get(m.user_id)?.year ?? 0 })).sort((x, y) => y.year - x.year),
    viewingsMonth: { kept: thisMonth.filter(v => v.status === 'done').length, noShows: thisMonth.filter(v => v.status === 'no-show').length, booked: thisMonth.filter(v => v.status === 'booked').length },
    problems, leaderboard,
    usageMonth: { aiReplies: aiMonth, whatsappMessages: waMonth },
    hoursSavedEstimate: hoursSaved(aiMonth, minutesPerReply), minutesPerReply,
    missedLeadMinutes: settingsRes.data?.missed_lead_minutes ?? 15,
  };
});
