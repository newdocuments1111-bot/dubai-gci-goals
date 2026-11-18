/**
 * "Ask your CRM": a question picks one of eight ready-made reports and a time period.
 * Every number is computed here from the agency's own rows (browser-safe, tested); the AI,
 * when used at all, only chooses the report. It never writes data or invents a figure.
 */
import { dealMath, DEFAULT_SPLIT_PERCENT } from "./agency";

export const REPORTS = [
  { id: "ads", label: "Ads", ownerOnly: true, example: "Which ads brought viewings this month?" },
  {
    id: "sources",
    label: "Lead sources",
    ownerOnly: false,
    example: "Where did leads come from this month?",
  },
  { id: "missed", label: "Missed leads", ownerOnly: false, example: "Who missed leads this week?" },
  { id: "agents", label: "Agents", ownerOnly: true, example: "Which agent replies fastest?" },
  {
    id: "hot",
    label: "Hot leads with no viewing",
    ownerOnly: false,
    example: "Hot leads with no viewing",
  },
  { id: "stuck", label: "Stuck leads", ownerOnly: false, example: "Leads stuck on a step" },
  { id: "deals", label: "Deals", ownerOnly: false, example: "Deals closing this month" },
  { id: "find", label: "Find a lead", ownerOnly: false, example: "Find Sara" },
] as const;
export type ReportId = (typeof REPORTS)[number]["id"];
export const REPORT_IDS = REPORTS.map((r) => r.id) as [ReportId, ...ReportId[]];

export const PERIODS = [
  "today",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_7",
  "last_30",
] as const;
export type Period = (typeof PERIODS)[number];

const PERIOD_LABEL: Record<Period, string> = {
  today: "today",
  this_week: "this week",
  last_week: "last week",
  this_month: "this month",
  last_month: "last month",
  this_year: "this year",
  last_7: "in the last 7 days",
  last_30: "in the last 30 days",
};
export const periodLabel = (p: Period) => PERIOD_LABEL[p];

const DAY = 86_400_000;
const DUBAI = 4 * 3600_000; // UTC+4, no daylight saving

/** [start, end) of a period in Dubai time, as ISO strings. */
export function periodRange(period: Period, now: Date = new Date()): { from: string; to: string } {
  const local = new Date(now.getTime() + DUBAI); // read UTC fields as Dubai wall time
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const startOfToday = Date.UTC(y, m, local.getUTCDate()) - DUBAI;
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  const iso = (t: number) => new Date(t).toISOString();
  switch (period) {
    case "today":
      return { from: iso(startOfToday), to: iso(startOfToday + DAY) };
    case "this_week":
      return { from: iso(startOfToday - dow * DAY), to: iso(startOfToday + DAY) };
    case "last_week":
      return { from: iso(startOfToday - (dow + 7) * DAY), to: iso(startOfToday - dow * DAY) };
    case "this_month":
      return { from: iso(Date.UTC(y, m, 1) - DUBAI), to: iso(startOfToday + DAY) };
    case "last_month":
      return { from: iso(Date.UTC(y, m - 1, 1) - DUBAI), to: iso(Date.UTC(y, m, 1) - DUBAI) };
    case "this_year":
      return { from: iso(Date.UTC(y, 0, 1) - DUBAI), to: iso(startOfToday + DAY) };
    case "last_7":
      return { from: iso(now.getTime() - 7 * DAY), to: iso(now.getTime() + 1) };
    case "last_30":
      return { from: iso(now.getTime() - 30 * DAY), to: iso(now.getTime() + 1) };
  }
}

export type Parsed = { report: ReportId; period: Period; search: string };

function findPeriod(q: string): Period | null {
  if (/\btoday\b/.test(q)) return "today";
  if (/\blast week\b|\bprevious week\b/.test(q)) return "last_week";
  if (/\bthis week\b|\bweek\b/.test(q)) return "this_week";
  if (/\blast month\b|\bprevious month\b/.test(q)) return "last_month";
  if (/\bthis month\b|\bmonth\b/.test(q)) return "this_month";
  if (/\bthis year\b|\byear\b|\bytd\b/.test(q)) return "this_year";
  if (/\b(last|past) 7 days\b/.test(q)) return "last_7";
  if (/\b(last|past) 30 days\b/.test(q)) return "last_30";
  return null;
}

/** Plain-words parsing that covers most questions without any AI call; null when unsure. */
export function parseQuestion(raw: string): Parsed | null {
  const q = raw
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return null;
  const period = findPeriod(q) ?? "this_month";
  const find = /^(find|search|search for|look up|lookup|where is|open)\s+(.+)$/.exec(q);
  if (find?.[2])
    return { report: "find", period, search: find[2].replace(/^(lead|client)\s+/, "").trim() };
  const phone = /\+?\d[\d\s-]{6,}\d/.exec(raw);
  if (phone && q.replace(/[\d\s+-]/g, "").length < 4)
    return { report: "find", period, search: phone[0] };
  const has = (re: RegExp) => re.test(q);
  let report: ReportId | null = null;
  if (has(/\bhot\b/)) report = "hot";
  else if (has(/\bmiss(ed|ing)?\b|\bwaiting\b|\bwaited\b|\bno reply\b|\bunanswered\b|\bignored\b/))
    report = "missed";
  else if (has(/\bstuck\b|\boverdue\b|\blate\b|\bbehind\b|\bnext step\b/)) report = "stuck";
  else if (has(/\bads?\b|\bcampaigns?\b|\bcost per\b|\bspend\b|\bbudget\b/)) report = "ads";
  else if (
    has(
      /\bagents?\b|\bteam\b|\bfastest\b|\bslowest\b|\bleaderboard\b|\bwho (replies|closes|sold)\b/,
    )
  )
    report = "agents";
  else if (has(/\bsources?\b|\bcame from\b|\bcome from\b|\bportals?\b|\bwhere did\b/))
    report = "sources";
  else if (
    has(
      /\bdeals?\b|\bclosing\b|\bclosed\b|\boffers?\b|\bforecast\b|\bgci\b|\bcommission\b|\brevenue\b/,
    )
  )
    report = "deals";
  return report ? { report, period, search: "" } : null;
}

// ---- rows the server reads (agency-scoped, the caller's own access rules) ----
export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  source: string;
  area: string;
  score: string;
  outcome: string;
  stage: number;
  stage_name: string | null;
  next_action: string | null;
  next_action_at: string | null;
  created_at: string;
  first_reply_at: string | null;
  assigned_agent_id: string | null;
  ad_campaign_id: string | null;
};
export type ViewingRow = { lead_id: string; status: string; starts_at: string };
export type DealRow = {
  id: string;
  lead_id: string | null;
  agent_id: string;
  status: string;
  price_aed: number;
  commission_percent: number;
  closed_at: string | null;
  created_at: string;
};
export type MemberRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  split_percent?: number;
};
export type CampaignRow = {
  id: string;
  name: string;
  platform: string;
  spend_to_date_aed: number;
  status: string;
};

export type ReportRow = { cells: string[]; leadId?: string };
export type ReportResult = {
  report: ReportId;
  title: string;
  answer: string;
  columns: string[];
  rows: ReportRow[];
  note?: string;
};

const inRange = (iso: string | null | undefined, r: { from: string; to: string }) =>
  !!iso && iso >= r.from && iso < r.to;
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const aed = (x: number) => `AED ${n(x)}`;
const who = (members: MemberRow[], id: string | null) => {
  const m = members.find((x) => x.user_id === id);
  return m ? m.display_name || m.email || "Agent" : id ? "Former member" : "Pool";
};
const mins = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60_000;
const waitText = (m: number) =>
  m < 60
    ? `${Math.round(m)} min`
    : m < 1440
      ? `${Math.round(m / 60)} h`
      : `${Math.round(m / 1440)} d`;
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

export function reportAds(
  campaigns: CampaignRow[],
  leads: LeadRow[],
  viewings: ViewingRow[],
  deals: DealRow[],
  period: Period,
  now = new Date(),
): ReportResult {
  const r = periodRange(period, now);
  const rows = campaigns
    .map((c) => {
      const ls = leads.filter((l) => l.ad_campaign_id === c.id && inRange(l.created_at, r));
      const ids = new Set(ls.map((l) => l.id));
      const vs = viewings.filter((v) => ids.has(v.lead_id) && v.status !== "cancelled");
      const attended = vs.filter((v) => v.status === "done").length;
      const won = deals.filter(
        (d) => d.lead_id && ids.has(d.lead_id) && d.status === "closed",
      ).length;
      const spend = Number(c.spend_to_date_aed) || 0;
      return {
        c,
        leads: ls.length,
        viewings: vs.length,
        attended,
        won,
        perViewing: vs.length ? spend / vs.length : null,
      };
    })
    .filter((x) => x.leads > 0 || x.c.status === "active")
    .sort((a, b) => b.viewings - a.viewings || b.leads - a.leads);
  const best = rows[0];
  const answer =
    !best || best.leads === 0
      ? `No leads came from your ads ${periodLabel(period)}.`
      : `${best.c.name} brought the most viewings ${periodLabel(period)}: ${best.viewings}${best.perViewing != null ? `, at ${aed(best.perViewing)} each` : ""}.` +
        (rows[1] && rows[1].leads > 0 ? ` Next: ${rows[1].c.name} with ${rows[1].viewings}.` : "");
  return {
    report: "ads",
    title: `Ads ${periodLabel(period)}`,
    answer,
    columns: ["Campaign", "Leads", "Viewings", "AED per viewing", "Deals"],
    rows: rows.map((x) => ({
      cells: [
        x.c.name,
        n(x.leads),
        n(x.viewings),
        x.perViewing == null ? "—" : n(x.perViewing),
        n(x.won),
      ],
    })),
    note: "AED per viewing uses the campaign's spend to date from the Ads page.",
  };
}

export function reportSources(
  leads: LeadRow[],
  viewings: ViewingRow[],
  deals: DealRow[],
  period: Period,
  now = new Date(),
): ReportResult {
  const r = periodRange(period, now);
  const ls = leads.filter((l) => inRange(l.created_at, r));
  const by = new Map<string, LeadRow[]>();
  for (const l of ls) by.set(l.source, [...(by.get(l.source) ?? []), l]);
  const rows = [...by.entries()]
    .map(([source, group]) => {
      const ids = new Set(group.map((l) => l.id));
      return {
        source,
        leads: group.length,
        replied: group.filter((l) => l.first_reply_at).length,
        viewings: viewings.filter((v) => ids.has(v.lead_id) && v.status !== "cancelled").length,
        won: deals.filter((d) => d.lead_id && ids.has(d.lead_id) && d.status === "closed").length,
      };
    })
    .sort((a, b) => b.leads - a.leads);
  const top = rows[0];
  return {
    report: "sources",
    title: `Lead sources ${periodLabel(period)}`,
    answer: top
      ? `${plural(ls.length, "lead")} ${periodLabel(period)}. Most came from ${top.source} (${top.leads}, ${Math.round((top.leads / ls.length) * 100)}%).`
      : `No new leads ${periodLabel(period)}.`,
    columns: ["Source", "Leads", "Replied", "Viewings", "Deals"],
    rows: rows.map((x) => ({
      cells: [
        x.source,
        n(x.leads),
        `${Math.round((x.replied / x.leads) * 100)}%`,
        n(x.viewings),
        n(x.won),
      ],
    })),
  };
}

export function reportMissed(
  leads: LeadRow[],
  members: MemberRow[],
  missedMinutes: number,
  period: Period,
  now = new Date(),
): ReportResult {
  const r = periodRange(period, now);
  const rows = leads
    .filter((l) => inRange(l.created_at, r))
    .map((l) => ({
      l,
      wait: mins(l.created_at, l.first_reply_at ?? now.toISOString()),
      open: !l.first_reply_at,
    }))
    .filter((x) => x.wait > missedMinutes)
    .sort((a, b) => Number(b.open) - Number(a.open) || b.wait - a.wait);
  const stillWaiting = rows.filter((x) => x.open).length;
  return {
    report: "missed",
    title: `Missed leads ${periodLabel(period)}`,
    answer: rows.length
      ? `${plural(rows.length, "lead")} waited more than ${missedMinutes} min for a first reply ${periodLabel(period)}${stillWaiting ? `; ${stillWaiting} still ${stillWaiting === 1 ? "has" : "have"} no reply` : ""}.`
      : `No missed leads ${periodLabel(period)}: every lead got a reply within ${missedMinutes} min.`,
    columns: ["Lead", "Source", "Agent", "Waited"],
    rows: rows.slice(0, 50).map((x) => ({
      cells: [
        x.l.name || "Unnamed lead",
        x.l.source,
        who(members, x.l.assigned_agent_id),
        `${waitText(x.wait)}${x.open ? ", no reply yet" : ""}`,
      ],
      leadId: x.l.id,
    })),
  };
}

export function reportAgents(
  members: MemberRow[],
  leads: LeadRow[],
  viewings: ViewingRow[],
  deals: DealRow[],
  period: Period,
  now = new Date(),
): ReportResult {
  const r = periodRange(period, now);
  const rows = members
    .map((m) => {
      const ls = leads.filter((l) => l.assigned_agent_id === m.user_id && inRange(l.created_at, r));
      const replies = ls
        .filter((l) => l.first_reply_at)
        .map((l) => mins(l.created_at, l.first_reply_at as string));
      const ids = new Set(leads.filter((l) => l.assigned_agent_id === m.user_id).map((l) => l.id));
      const vs = viewings.filter(
        (v) => ids.has(v.lead_id) && inRange(v.starts_at, r) && v.status !== "cancelled",
      ).length;
      const gci = deals
        .filter((d) => d.agent_id === m.user_id && d.status === "closed" && inRange(d.closed_at, r))
        .reduce(
          (s, d) =>
            s +
            dealMath({
              price: Number(d.price_aed),
              commissionPercent: Number(d.commission_percent),
              splitPercent: m.split_percent ?? DEFAULT_SPLIT_PERCENT,
            }).gci,
          0,
        );
      const avg = replies.length ? replies.reduce((a, b) => a + b, 0) / replies.length : null;
      return { m, leads: ls.length, avg, viewings: vs, gci };
    })
    .sort((a, b) => b.gci - a.gci || (a.avg ?? 1e9) - (b.avg ?? 1e9));
  const fastest = [...rows]
    .filter((x) => x.avg != null)
    .sort((a, b) => (a.avg as number) - (b.avg as number))[0];
  const top = rows[0];
  return {
    report: "agents",
    title: `Agents ${periodLabel(period)}`,
    answer:
      rows.length === 0
        ? "No agents yet."
        : `${top && top.gci > 0 ? `${who(members, top.m.user_id)} leads on GCI (${aed(top.gci)}). ` : ""}${fastest ? `Fastest first reply: ${who(members, fastest.m.user_id)}, ${waitText(fastest.avg as number)} on average.` : `No replies recorded ${periodLabel(period)}.`}`,
    columns: ["Agent", "New leads", "Avg first reply", "Viewings", "GCI"],
    rows: rows.map((x) => ({
      cells: [
        who(members, x.m.user_id),
        n(x.leads),
        x.avg == null ? "—" : waitText(x.avg),
        n(x.viewings),
        aed(x.gci),
      ],
    })),
  };
}

export function reportHot(
  leads: LeadRow[],
  viewings: ViewingRow[],
  members: MemberRow[],
): ReportResult {
  const booked = new Set(viewings.filter((v) => v.status !== "cancelled").map((v) => v.lead_id));
  const rows = leads
    .filter((l) => l.score === "Hot" && l.outcome === "open" && !booked.has(l.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    report: "hot",
    title: "Hot leads with no viewing",
    answer: rows.length
      ? `${plural(rows.length, "hot lead")} ${rows.length === 1 ? "has" : "have"} no viewing booked. Oldest first below.`
      : "Every hot lead has a viewing booked.",
    columns: ["Lead", "Area", "Agent", "Step"],
    rows: rows.slice(0, 50).map((l) => ({
      cells: [
        l.name || "Unnamed lead",
        l.area || "—",
        who(members, l.assigned_agent_id),
        l.stage_name ?? `Step ${l.stage}`,
      ],
      leadId: l.id,
    })),
  };
}

export function reportStuck(
  leads: LeadRow[],
  members: MemberRow[],
  now = new Date(),
): ReportResult {
  const rows = leads
    .filter((l) => l.outcome === "open" && l.next_action_at && l.next_action_at < now.toISOString())
    .map((l) => ({ l, late: mins(l.next_action_at as string, now.toISOString()) }))
    .sort((a, b) => b.late - a.late);
  const byStep = new Map<string, number>();
  for (const x of rows) {
    const k = x.l.stage_name ?? `Step ${x.l.stage}`;
    byStep.set(k, (byStep.get(k) ?? 0) + 1);
  }
  const worst = [...byStep.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    report: "stuck",
    title: "Leads overdue on a step",
    answer: rows.length
      ? `${plural(rows.length, "lead")} ${rows.length === 1 ? "is" : "are"} past the due time of ${rows.length === 1 ? "its" : "their"} next step. Most are at "${worst?.[0]}" (${worst?.[1]}).`
      : "No lead is overdue. Every next step is on time.",
    columns: ["Lead", "Step", "Next action", "Late by", "Agent"],
    rows: rows.slice(0, 50).map((x) => ({
      cells: [
        x.l.name || "Unnamed lead",
        x.l.stage_name ?? `Step ${x.l.stage}`,
        x.l.next_action ?? "—",
        waitText(x.late),
        who(members, x.l.assigned_agent_id),
      ],
      leadId: x.l.id,
    })),
  };
}

export function reportDeals(
  deals: DealRow[],
  leads: LeadRow[],
  members: MemberRow[],
  period: Period,
  now = new Date(),
): ReportResult {
  const r = periodRange(period, now);
  const gciOf = (d: DealRow) =>
    dealMath({
      price: Number(d.price_aed),
      commissionPercent: Number(d.commission_percent),
      splitPercent: DEFAULT_SPLIT_PERCENT,
    }).gci;
  const closed = deals.filter((d) => d.status === "closed" && inRange(d.closed_at, r));
  const open = deals.filter((d) => d.status === "under offer");
  const closedGci = closed.reduce((s, d) => s + gciOf(d), 0);
  const openGci = open.reduce((s, d) => s + gciOf(d), 0);
  const name = (d: DealRow) => leads.find((l) => l.id === d.lead_id)?.name || "Client";
  const rows = [...open, ...closed].map((d) => ({
    cells: [
      name(d),
      d.status === "closed" ? "Closed" : "Under offer",
      aed(Number(d.price_aed)),
      aed(gciOf(d)),
      who(members, d.agent_id),
    ],
    ...(d.lead_id ? { leadId: d.lead_id } : {}),
  }));
  return {
    report: "deals",
    title: `Deals ${periodLabel(period)}`,
    answer: `${plural(closed.length, "deal")} closed ${periodLabel(period)} (${aed(closedGci)} GCI). ${plural(open.length, "deal")} under offer could add ${aed(openGci)}.`,
    columns: ["Client", "Status", "Price", "GCI", "Agent"],
    rows,
  };
}

export function reportFind(leads: LeadRow[], members: MemberRow[], search: string): ReportResult {
  const q = search.toLowerCase().trim();
  const digits = q.replace(/\D/g, "");
  const rows = q
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.area.toLowerCase().includes(q) ||
          (digits.length >= 4 && l.phone.replace(/\D/g, "").includes(digits)),
      )
    : [];
  return {
    report: "find",
    title: `Leads matching "${search}"`,
    answer: rows.length ? `Found ${plural(rows.length, "lead")}.` : `No lead matches "${search}".`,
    columns: ["Lead", "Phone", "Area", "Step", "Agent"],
    rows: rows.slice(0, 50).map((l) => ({
      cells: [
        l.name || "Unnamed lead",
        l.phone || "—",
        l.area || "—",
        l.stage_name ?? `Step ${l.stage}`,
        who(members, l.assigned_agent_id),
      ],
      leadId: l.id,
    })),
  };
}
