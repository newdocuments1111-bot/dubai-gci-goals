/**
 * The 15-step lead pipeline from the "Ads, funnel and CRM" plan.
 * The database holds the rulebook (lead_stages) and applies it on every change; leads move forward by
 * themselves from the app's own events (AI reply, viewing, follow-up, deal). This module only reads the
 * rulebook for display and keeps the small pure rules testable. Nothing here sends a message.
 */
import type { Database } from "@/integrations/supabase/types";

export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type StageRule = Database["public"]["Tables"]["lead_stages"]["Row"];
export type AdCampaign = Database["public"]["Tables"]["ad_campaigns"]["Row"];
export type LeadEvent = Database["public"]["Tables"]["lead_events"]["Row"];
export type LeadReport = Database["public"]["Views"]["lead_report"]["Row"];

export const STAGES = Array.from({ length: 15 }, (_, i) => i + 1);
export const TRACKS = ["ready", "offplan"] as const;
export const OUTCOMES = ["open", "not_now", "lost", "won"] as const;
export const AD_PLATFORMS = ["meta", "google", "portal", "other"] as const;
export const AD_STATUSES = ["draft", "testing", "winner", "stopped"] as const;
export const BUYER_TYPES = [
  "end_user",
  "investor",
  "seller",
  "landlord",
  "tenant",
  "other",
] as const;

/** The three rows of the plan. */
export const STAGE_GROUPS: { title: string; stages: number[] }[] = [
  { title: "3A. New lead to qualified", stages: [1, 2, 3, 4, 5] },
  { title: "3B. Viewing to deal agreed", stages: [6, 7, 8, 9, 10] },
  { title: "3C. Paperwork to closed deal", stages: [11, 12, 13, 14, 15] },
];

export const isParked = (outcome: string | null | undefined) =>
  outcome === "not_now" || outcome === "lost";

/** Off-plan leads use the off-plan rulebook only for steps 10–13. */
export const trackFor = (stage: number, track: string | null | undefined) =>
  track === "offplan" && stage >= 10 && stage <= 13 ? "offplan" : "ready";

/** Rule for a stage; a plain fallback keeps the board readable before the rulebook loads. */
export function ruleFor(rules: StageRule[], stage: number, track?: string | null): StageRule {
  const t = trackFor(stage, track);
  return (
    rules.find((r) => r.stage === stage && r.track === t) ??
    rules.find((r) => r.stage === stage && r.track === "ready") ?? {
      track: t,
      stage,
      name: `Step ${stage}`,
      who: "",
      next_action: null,
      next_action_offset: null,
      checklist: [],
      template: null,
    }
  );
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
export const checklistOf = (rule: Pick<StageRule, "checklist">) => strings(rule.checklist);
export const doneItems = (lead: Pick<Lead, "checklist_done">) => strings(lead.checklist_done);
export const toggleItem = (done: string[], item: string) =>
  done.includes(item) ? done.filter((d) => d !== item) : [...done, item];

export const isOverdue = (lead: Pick<Lead, "outcome" | "next_action_at">, now = new Date()) =>
  lead.outcome === "open" && !!lead.next_action_at && new Date(lead.next_action_at) < now;

/** The database refuses a lost lead without a reason; the form says so before saving. */
export const lostNeedsReason = (outcome: string, reason: string | null | undefined) =>
  outcome === "lost" && !(reason ?? "").trim();

export const aed = (n: number | null | undefined) =>
  n == null ? "—" : `AED ${Math.round(Number(n)).toLocaleString("en-US")}`;
export function minutes(m: number | null | undefined) {
  if (m == null) return "—";
  const n = Number(m);
  if (n < 60) return `${Math.round(n)} min`;
  if (n < 60 * 24) return `${(n / 60).toFixed(1)} h`;
  return `${(n / 60 / 24).toFixed(1)} d`;
}

/** Fill a step's message with the lead's own details. Unknown fields stay as "…". */
export function fillTemplate(
  template: string | null | undefined,
  lead: Pick<Lead, "name" | "area" | "source_detail">,
  extra: { agent?: string | null; viewingAt?: string | null; options?: string[] } = {},
) {
  if (!template) return "";
  const first = (lead.name ?? "").trim().split(" ")[0] || "there";
  const map: Record<string, string> = {
    name: first,
    area: lead.area || "…",
    offer: lead.source_detail || "the details",
    agent: extra.agent || "our agent",
    viewing_at: extra.viewingAt
      ? new Date(extra.viewingAt).toLocaleString("en-GB", {
          timeZone: "Asia/Dubai",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "…",
    options: extra.options?.length ? extra.options.join("; ") : "…",
  };
  return template.replace(/\{(\w+)\}/g, (_, k: string) => map[k] ?? `{${k}}`);
}

export type Totals = {
  leads: number;
  repliedPct: number;
  avgReplyMinutes: number | null;
  outOfHours: number;
  qualified: number;
  booked: number;
  attended: number;
  won: number;
  spend: number;
  overdue: number;
  costPerViewing: number | null;
};

/** Sum the per-source rows into the owner's strip. */
export function totals(rows: LeadReport[]): Totals {
  const n = (v: number | null | undefined) => Number(v ?? 0);
  const leads = rows.reduce((a, r) => a + n(r.leads), 0);
  const replied = rows.reduce((a, r) => a + n(r.replied), 0);
  const weighted = rows.reduce(
    (a, r) =>
      r.avg_first_reply_minutes == null ? a : a + n(r.avg_first_reply_minutes) * n(r.replied),
    0,
  );
  const spend = rows.reduce((a, r) => a + n(r.spend), 0);
  const adViewings = rows
    .filter((r) => r.spend != null)
    .reduce((a, r) => a + n(r.viewings_attended), 0);
  return {
    leads,
    repliedPct: leads ? Math.round((100 * replied) / leads) : 0,
    avgReplyMinutes: replied ? weighted / replied : null,
    outOfHours: rows.reduce((a, r) => a + n(r.leads_out_of_hours), 0),
    qualified: rows.reduce((a, r) => a + n(r.qualified), 0),
    booked: rows.reduce((a, r) => a + n(r.viewings_booked), 0),
    attended: rows.reduce((a, r) => a + n(r.viewings_attended), 0),
    won: rows.reduce((a, r) => a + n(r.won), 0),
    spend,
    overdue: rows.reduce((a, r) => a + n(r.overdue), 0),
    costPerViewing: spend && adViewings ? Math.round(spend / adViewings) : null,
  };
}

/** Rank paid ads: cheapest attended viewing first, then most qualified leads. Portals have no spend and are left out. */
export const rankAds = (rows: LeadReport[]) =>
  [...rows]
    .filter((r) => r.spend != null)
    .sort((a, b) => {
      const ca = a.cost_per_attended_viewing ?? Infinity,
        cb = b.cost_per_attended_viewing ?? Infinity;
      return ca !== cb ? ca - cb : Number(b.qualified ?? 0) - Number(a.qualified ?? 0);
    });

export type AdDecision = { name: string; action: "keep" | "stop" | "wait"; reason: string };

/** Day-14 rule from the plan: after 14 days, keep the winner and stop the worst two; younger ads wait. */
export function adDecisions(
  ads: AdCampaign[],
  rows: LeadReport[],
  today = new Date(),
): AdDecision[] {
  const byName = new Map(rows.map((r) => [r.source, r]));
  const running = ads.filter((a) => a.status === "testing" || a.status === "winner");
  const days = (a: AdCampaign) =>
    a.started_at
      ? Math.floor((today.getTime() - new Date(a.started_at).getTime()) / 86_400_000)
      : 0;
  const ready = running.filter((a) => days(a) >= 14),
    early = running.filter((a) => days(a) < 14);
  const ranked = rankAds(ready.map((a) => byName.get(a.name)).filter((r): r is LeadReport => !!r));
  const out: AdDecision[] = ranked.map((r, i) => {
    const cost = r.cost_per_attended_viewing;
    if (i === 0 && cost != null)
      return {
        name: r.source ?? "",
        action: "keep",
        reason: `Lowest cost per attended viewing (${aed(cost)}). Make 2 new versions of this one.`,
      };
    if (cost == null)
      return {
        name: r.source ?? "",
        action: "stop",
        reason: `${aed(r.spend)} spent, no attended viewing.`,
      };
    if (i >= ranked.length - 2 && ranked.length >= 3)
      return {
        name: r.source ?? "",
        action: "stop",
        reason: `Among the worst two: ${aed(cost)} per attended viewing.`,
      };
    return {
      name: r.source ?? "",
      action: "keep",
      reason: `${aed(cost)} per attended viewing. Keep running, watch the number.`,
    };
  });
  for (const a of early)
    out.push({
      name: a.name,
      action: "wait",
      reason: `Day ${days(a)} of 14. Don't change it yet.`,
    });
  return out;
}

export function describeEvent(e: LeadEvent, name: (stage: number) => string) {
  if (e.note) return e.note;
  if (e.to_outcome && e.to_outcome !== e.from_outcome && e.to_outcome !== "open")
    return `Marked ${e.to_outcome.replace("_", " ")}`;
  if (e.to_stage != null && e.to_stage !== e.from_stage)
    return `Moved to ${e.to_stage}. ${name(e.to_stage)}`;
  return "Updated";
}
