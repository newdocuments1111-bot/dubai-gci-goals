/**
 * Reply speed: Property Finder's published SuperAgent rules, measured on the CRM's own leads.
 * Browser-safe pure functions over plain rows. The badge itself is decided by Property Finder.
 */

/** A lead must get its first reply within this many minutes. */
export const REPLY_LIMIT_MINUTES = 120;
/** At least this share of leads must be replied to within the limit. */
export const REPLY_RATE_TARGET_PERCENT = 80;
/** At least one closed deal is needed within this many days. */
export const DEAL_WINDOW_DAYS = 90;
/** Default look-back period for leads. */
export const DEFAULT_PERIOD_DAYS = 30;

export const REASON_REPLY_RATE = `Reply rate under ${REPLY_RATE_TARGET_PERCENT}%`;
export const REASON_NO_DEAL = `No deal in ${DEAL_WINDOW_DAYS} days`;
export const REASON_SLOW_REPLY = `Typical reply slower than ${REPLY_LIMIT_MINUTES / 60} hours`;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type ReplyLead = {
  id: string;
  name?: string | null;
  source?: string | null;
  created_at: string;
  /** First reply recorded on the lead by the CRM (AI or human, whichever came first). */
  first_reply_at: string | null;
  assigned_agent_id: string | null;
  /** "open" | "won" | "lost" | "not_now"; only used by the waiting list. */
  outcome?: string | null;
};
export type ReplyDeal = { agent_id: string; status: string; closed_at: string | null };
export type ReplyAgent = { user_id: string; name: string };

export type ReplyStatus = "on track" | "at risk";
export type AgentReplyRow = {
  userId: string;
  name: string;
  /** Leads created in the period and assigned to this agent. */
  leads: number;
  /** Replied within the limit. */
  repliedInTime: number;
  /** Replied after the limit, or still unanswered and already past the limit. */
  missed: number;
  /** Unanswered but still inside the limit: not counted in the rate yet. */
  stillInTime: number;
  /** Median minutes from lead creation to first reply, over replied leads; null when none. */
  medianReplyMinutes: number | null;
  /** repliedInTime / (repliedInTime + missed); null when nothing can be counted yet. */
  repliedInTimePercent: number | null;
  /** Whole days since the agent's last closed deal; null when they have none. */
  daysSinceLastDeal: number | null;
  status: ReplyStatus;
  reasons: string[];
};

export type WaitingLead = {
  id: string;
  name: string;
  source: string;
  agentId: string | null;
  minutesWaited: number;
  /** Minutes before the limit; negative once the limit has passed. */
  minutesLeft: number;
  overdue: boolean;
};

const ms = (iso: string) => new Date(iso).getTime();

/** Minutes from lead creation to first reply (never negative); null when not replied. */
export function replyMinutes(lead: Pick<ReplyLead, "created_at" | "first_reply_at">) {
  if (!lead.first_reply_at) return null;
  const diff = ms(lead.first_reply_at) - ms(lead.created_at);
  return Number.isFinite(diff) ? Math.max(0, diff) / MINUTE_MS : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export type LeadReplyState = "in time" | "missed" | "still in time";

/** A reply exactly at the limit is in time; an unanswered lead is missed once it is older than the limit. */
export function leadReplyState(
  lead: Pick<ReplyLead, "created_at" | "first_reply_at">,
  now: Date = new Date(),
): LeadReplyState {
  const replied = replyMinutes(lead);
  if (replied !== null) return replied <= REPLY_LIMIT_MINUTES ? "in time" : "missed";
  const waited = (now.getTime() - ms(lead.created_at)) / MINUTE_MS;
  return waited > REPLY_LIMIT_MINUTES ? "missed" : "still in time";
}

/** Whole days since the agent's most recent closed deal, or null when there is none. */
export function daysSinceLastDeal(deals: ReplyDeal[], agentId: string, now: Date = new Date()) {
  const last = lastDealMs(deals, agentId, now);
  return last === null ? null : Math.floor((now.getTime() - last) / DAY_MS);
}

function lastDealMs(deals: ReplyDeal[], agentId: string, now: Date) {
  let last: number | null = null;
  for (const d of deals) {
    if (d.agent_id !== agentId || d.status !== "closed" || !d.closed_at) continue;
    const at = ms(d.closed_at);
    if (!Number.isFinite(at) || at > now.getTime()) continue;
    if (last === null || at > last) last = at;
  }
  return last;
}

/** One row per agent. Leads are those created in the last `periodDays`; deals are looked at over all time. */
export function agentReplyRows(
  agents: ReplyAgent[],
  leads: ReplyLead[],
  deals: ReplyDeal[],
  now: Date = new Date(),
  periodDays: number = DEFAULT_PERIOD_DAYS,
): AgentReplyRow[] {
  const since = now.getTime() - periodDays * DAY_MS;
  const inPeriod = leads.filter((l) => {
    const at = ms(l.created_at);
    return at >= since && at <= now.getTime();
  });
  return agents
    .map((a) => {
      const own = inPeriod.filter((l) => l.assigned_agent_id === a.user_id);
      let repliedInTime = 0,
        missed = 0,
        stillInTime = 0;
      const minutes: number[] = [];
      for (const l of own) {
        const state = leadReplyState(l, now);
        if (state === "in time") repliedInTime++;
        else if (state === "missed") missed++;
        else stillInTime++;
        const m = replyMinutes(l);
        if (m !== null) minutes.push(m);
      }
      const counted = repliedInTime + missed;
      const medianReplyMinutes = median(minutes);
      const repliedInTimePercent = counted ? (repliedInTime / counted) * 100 : null;
      const last = lastDealMs(deals, a.user_id, now);

      const reasons: string[] = [];
      if (repliedInTimePercent !== null && repliedInTimePercent < REPLY_RATE_TARGET_PERCENT)
        reasons.push(REASON_REPLY_RATE);
      if (last === null || now.getTime() - last > DEAL_WINDOW_DAYS * DAY_MS)
        reasons.push(REASON_NO_DEAL);
      if (medianReplyMinutes !== null && medianReplyMinutes > REPLY_LIMIT_MINUTES)
        reasons.push(REASON_SLOW_REPLY);

      const row: AgentReplyRow = {
        userId: a.user_id,
        name: a.name,
        leads: own.length,
        repliedInTime,
        missed,
        stillInTime,
        medianReplyMinutes,
        repliedInTimePercent,
        daysSinceLastDeal: last === null ? null : Math.floor((now.getTime() - last) / DAY_MS),
        status: reasons.length ? "at risk" : "on track",
        reasons,
      };
      return row;
    })
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length || b.leads - a.leads || a.name.localeCompare(b.name),
    );
}

/** Open leads with no first reply yet, least time left first (overdue leads come first). */
export function waitingLeads(leads: ReplyLead[], now: Date = new Date()): WaitingLead[] {
  return leads
    .filter((l) => !l.first_reply_at && (l.outcome ?? "open") === "open")
    .map((l) => {
      const minutesWaited = Math.max(0, Math.floor((now.getTime() - ms(l.created_at)) / MINUTE_MS));
      const minutesLeft = REPLY_LIMIT_MINUTES - minutesWaited;
      return {
        id: l.id,
        name: l.name?.trim() || "Unnamed lead",
        source: l.source ?? "",
        agentId: l.assigned_agent_id,
        minutesWaited,
        minutesLeft,
        overdue: (now.getTime() - ms(l.created_at)) / MINUTE_MS > REPLY_LIMIT_MINUTES,
      };
    })
    .sort((a, b) => a.minutesLeft - b.minutesLeft);
}

/** "42 min", "2 h 5 min", "3 d 4 h". */
export function minutesText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 1440) return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
  const h = Math.floor((m % 1440) / 60);
  return h ? `${Math.floor(m / 1440)} d ${h} h` : `${Math.floor(m / 1440)} d`;
}
