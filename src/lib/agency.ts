/** Browser-safe agency rules: roles, login limits, goal setting, GCI shares and simple performance maths. */

export type AgencyRole = 'owner' | 'agent';
export type GoalMode = 'agent' | 'owner' | 'both';

export type Membership = {
  userId: string;
  agencyId: string;
  agencyName: string;
  role: AgencyRole;
  isOwner: boolean;
  isHq: boolean;
  displayName: string;
  splitPercent: number;
  goal: number | null;
  goalMode: GoalMode;
};

export const DEMO_AGENCY_ID = 'de000000-0000-4000-8000-000000000001';
export const DEFAULT_SPLIT_PERCENT = 50;
export const DEFAULT_MISSED_LEAD_MINUTES = 15;
export const DEFAULT_MINUTES_PER_AI_REPLY = 2;

export const goalModeLabels: Record<GoalMode, string> = {
  agent: 'Agents set their own goals',
  owner: 'Owner sets every goal',
  both: 'Both agents and owner can set goals',
};

/** Can this person change their own yearly goal? */
export function canSetOwnGoal(mode: GoalMode, isOwner: boolean) {
  return isOwner || mode !== 'owner';
}
/** Can the owner change another member's yearly goal? */
export function canOwnerSetOthersGoal(mode: GoalMode) {
  return mode !== 'agent';
}

export function loginLimitMessage(planLogins: number) {
  return `Your plan has ${planLogins} logins. Contact Elite Visions to add more.`;
}
/** Owner + agent logins already used must be below the plan to invite one more. */
export function canInvite(used: number, planLogins: number) {
  return used < planLogins;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** GCI = price × commission %; agent share = GCI × split %; agency share = GCI − agent share. */
export function dealMath(input: { price: number; commissionPercent: number; splitPercent: number }) {
  const gci = round2((input.price * input.commissionPercent) / 100);
  const agentShare = round2((gci * input.splitPercent) / 100);
  return { gci, agentShare, agencyShare: round2(gci - agentShare) };
}

/** Hours saved estimate = AI replies × minutes per reply. */
export function hoursSaved(aiReplies: number, minutesPerReply: number) {
  return Math.round(((aiReplies * minutesPerReply) / 60) * 10) / 10;
}

export function goalProgress(gciThisYear: number, goal: number | null | undefined) {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((gciThisYear / goal) * 100)));
}

const dubaiParts = (date: Date) => {
  const [y, m, d] = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }).split('-').map(Number);
  return { y: y!, m: m!, d: d! };
};
export const dubaiDay = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
export function inDubaiMonth(iso: string | null | undefined, now = new Date()) {
  if (!iso) return false;
  const a = dubaiParts(new Date(iso)), b = dubaiParts(now);
  return a.y === b.y && a.m === b.m;
}
export function inDubaiYear(iso: string | null | undefined, now = new Date()) {
  if (!iso) return false;
  return dubaiParts(new Date(iso)).y === dubaiParts(now).y;
}

export type DealRow = { agent_id: string; price_aed: number; commission_percent: number; status: string; closed_at: string | null; ai_handled: boolean };
export type MemberRow = { user_id: string; display_name: string; email: string; split_percent: number; annual_gci_goal_aed: number | null; role: string };

/** Closed-deal GCI for the month and year, with agent/agency shares and a per-agent breakdown. */
export function gciSummary(deals: DealRow[], members: MemberRow[], now = new Date()) {
  const split = new Map(members.map(m => [m.user_id, Number(m.split_percent)]));
  const closed = deals.filter(d => d.status === 'closed');
  const totals = { month: 0, year: 0, agencyMonth: 0, agencyYear: 0, aiHandledDeals: 0, aiHandledGciYear: 0 };
  const perAgent = new Map<string, { month: number; year: number; agentShareYear: number; deals: number }>();
  for (const d of closed) {
    const m = dealMath({ price: Number(d.price_aed), commissionPercent: Number(d.commission_percent), splitPercent: split.get(d.agent_id) ?? DEFAULT_SPLIT_PERCENT });
    const row = perAgent.get(d.agent_id) ?? { month: 0, year: 0, agentShareYear: 0, deals: 0 };
    if (inDubaiYear(d.closed_at, now)) {
      totals.year += m.gci; totals.agencyYear += m.agencyShare; row.year += m.gci; row.agentShareYear += m.agentShare; row.deals += 1;
      if (d.ai_handled) { totals.aiHandledDeals += 1; totals.aiHandledGciYear += m.gci; }
    }
    if (inDubaiMonth(d.closed_at, now)) { totals.month += m.gci; totals.agencyMonth += m.agencyShare; row.month += m.gci; }
    perAgent.set(d.agent_id, row);
  }
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] = round2(totals[k]);
  return { ...totals, perAgent };
}

type Msg = { lead_id: string; role: string; created_at: string };

/** Average minutes between a client message and the next reply (AI or person), per lead set. */
export function averageReplyMinutes(messages: Msg[]) {
  const byLead = new Map<string, Msg[]>();
  for (const m of messages) byLead.set(m.lead_id, [...(byLead.get(m.lead_id) ?? []), m]);
  const delays: number[] = [];
  for (const list of byLead.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    let waitingSince: string | null = null;
    for (const m of list) {
      if (m.role === 'client') { waitingSince ??= m.created_at; continue; }
      if (waitingSince) { delays.push((Date.parse(m.created_at) - Date.parse(waitingSince)) / 60000); waitingSince = null; }
    }
  }
  return delays.length ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10 : null;
}

/** A lead is missed when its newest client message has had no reply for longer than the limit. */
export function isMissedLead(messages: Omit<Msg, 'lead_id'>[], minutes: number, now = new Date()) {
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const last = sorted.at(-1);
  if (!last || last.role !== 'client') return false;
  return now.getTime() - Date.parse(last.created_at) > minutes * 60000;
}

export type LeaderRow = { userId: string; name: string; gciYear: number; avgReplyMinutes: number | null; viewings: number };
/** Rank by GCI (high first), then faster average reply, then more viewings. */
export function rankLeaderboard(rows: LeaderRow[]) {
  return [...rows].sort((a, b) => b.gciYear - a.gciYear
    || (a.avgReplyMinutes ?? Infinity) - (b.avgReplyMinutes ?? Infinity)
    || b.viewings - a.viewings);
}

export const memberName = (m: { display_name: string; email: string } | undefined) => m ? (m.display_name || m.email || 'Agent') : 'Unassigned';
