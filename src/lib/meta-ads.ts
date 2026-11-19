/**
 * Meta ads results: browser-safe and tested.
 * Turns synced Meta insights plus the agency's own leads, viewings and deals into one row per
 * campaign / ad set / ad with a plain verdict. The CRM only reads from Meta: it never changes,
 * pauses or creates ads, so every suggestion here is something the owner does in Ads Manager.
 */
import { dubaiDay } from "./agency";

export type MetaLevel = "campaign" | "adset" | "ad";
export type Verdict = "keep" | "watch" | "waste";

/** Days synced and shown by default. Meta keeps changing recent numbers, so every sync re-reads them. */
export const META_SYNC_DAYS = 30;
/** Longest period the CRM asks Meta for in one sync. */
export const META_MAX_SYNC_DAYS = 90;
/** A manual "Sync now" is refused when the last one started less than this many minutes ago. */
export const META_SYNC_GAP_MINUTES = 5;

// Verdict rules. Money amounts are in AED and are applied only when the ad account is in AED.
/** No deal and at least this much spent in the period → Wasting money. */
export const WASTE_MIN_SPEND_AED = 3000;
/** At least one deal and at least this much GCI back for every 1 spent → Keep. */
export const KEEP_MIN_MONEY_BACK = 5;
/** Below this share of leads replying, leads are "cheap leads, no buyers". */
export const LOW_REPLY_RATE_PCT = 50;
/** Reply rate is judged only from this many leads up. */
export const MIN_LEADS_TO_JUDGE_REPLIES = 5;
/** Cost per lead at or under this is fine. */
export const GOOD_CPL_AED = 150;
/** Cost per lead above this is expensive. */
export const HIGH_CPL_AED = 400;
/** Under this spend with no deal the ad is too new to judge. */
export const MIN_SPEND_TO_JUDGE_AED = 500;

export const VERDICT_LABELS: Record<Verdict, string> = {
  keep: "Keep",
  watch: "Watch",
  waste: "Wasting money",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------------------------
// Input checks
// ---------------------------------------------------------------------------------------------

/** "act_123", "123" or " act_123 " → "act_123"; anything else → null. */
export function normaliseAdAccountId(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().replace(/^act_/i, "");
  return /^\d{1,30}$/.test(s) ? `act_${s}` : null;
}

/** A Meta access token: one word of 20–2000 letters, digits and the few symbols Meta uses. */
export function isValidMetaToken(raw: string | null | undefined): boolean {
  return /^[A-Za-z0-9_\-.|]{20,2000}$/.test((raw ?? "").trim());
}

/**
 * A Meta id (ad, ad set, campaign) as digits, or null.
 * A JSON number is accepted only when it is a safe integer: Meta ids are often longer than
 * JavaScript can hold exactly, and a rounded id would match the wrong ad.
 */
export function metaId(v: unknown): string | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? String(v) : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^\d{1,30}$/.test(s) ? s : null;
}

export type MetaAdIds = {
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
};

/** Meta ids sent to the lead intake (Meta lead webhook / Zapier names), or null when there are none. */
export function parseMetaAdIds(body: unknown): MetaAdIds | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const id = metaId(b[k]);
      if (id) return id;
    }
    return null;
  };
  const ids = {
    ad_id: first("meta_ad_id", "ad_id"),
    adset_id: first("meta_adset_id", "adset_id", "ad_set_id"),
    campaign_id: first("meta_campaign_id", "campaign_id"),
  };
  return ids.ad_id || ids.adset_id || ids.campaign_id ? ids : null;
}

// ---------------------------------------------------------------------------------------------
// Graph API answers
// ---------------------------------------------------------------------------------------------

/** The period to sync: the last `days` Dubai days up to and including today. */
export function syncRange(now: Date = new Date(), days = META_SYNC_DAYS) {
  const n = Math.min(META_MAX_SYNC_DAYS, Math.max(1, Math.floor(days)));
  const until = dubaiDay(now);
  const since = dubaiDay(new Date(now.getTime() - (n - 1) * 86_400_000));
  return { since, until };
}

/** Days from `since` to `until`, both included. */
export function daysInRange(since: string, until: string) {
  const ms = Date.parse(`${until}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 86_400_000) + 1) : 1;
}

/** Leads Meta counted for a row: the total "lead" action, else the grouped on-Facebook form leads. */
export function metaLeadCount(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  const by = new Map<string, number>();
  for (const a of actions) {
    if (!a || typeof a !== "object") continue;
    const r = a as Record<string, unknown>;
    const n = Number(r["value"]);
    if (typeof r["action_type"] === "string" && Number.isFinite(n))
      by.set(r["action_type"], (by.get(r["action_type"]) ?? 0) + n);
  }
  return Math.round(
    by.get("lead") ?? by.get("onsite_conversion.lead_grouped") ?? by.get("leadgen_grouped") ?? 0,
  );
}

export type InsightRow = {
  date: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  meta_leads: number;
};

/** One row of `/{act}/insights?level=ad&time_increment=1`, or null when it is not usable. */
export function parseInsightRow(raw: unknown): InsightRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ad_id = metaId(r["ad_id"]);
  const date = typeof r["date_start"] === "string" ? r["date_start"] : "";
  if (!ad_id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const text = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    date,
    campaign_id: metaId(r["campaign_id"]) ?? "",
    campaign_name: text(r["campaign_name"]),
    adset_id: metaId(r["adset_id"]) ?? "",
    adset_name: text(r["adset_name"]),
    ad_id,
    ad_name: text(r["ad_name"]),
    spend: round2(num(r["spend"])),
    impressions: Math.round(num(r["impressions"])),
    clicks: Math.round(num(r["clicks"])),
    meta_leads: metaLeadCount(r["actions"]),
  };
}

export type GraphError = { status: number; code?: number; subcode?: number; message?: string };

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80004]);

/** A Graph API failure in words an owner can act on. */
export function graphErrorMessage(e: GraphError): string {
  const code = e.code ?? 0;
  const msg = (e.message ?? "").toLowerCase();
  if (code === 190 || e.status === 401)
    return "Meta says the access token has expired or was removed. Make a new system-user token in Meta Business Settings and connect again.";
  if (code === 10 || (code >= 200 && code <= 299) || e.status === 403)
    return "The token is not allowed to read this ad account. In Meta Business Settings, give the system user the ads_read permission and assign it to the ad account.";
  if (RATE_LIMIT_CODES.has(code) || e.status === 429)
    return "Meta is limiting how often this ad account can be read. Try again in an hour.";
  if (code === 100 && (msg.includes("does not exist") || msg.includes("cannot be loaded")))
    return "Meta cannot find this ad account. Check the ID (it starts with act_) and that the system user is assigned to it.";
  if (code === 1 && msg.includes("reduce the amount of data"))
    return "Meta says this is too much data to read at once. Try again later; if it keeps happening, tell support.";
  if (code === 1 || code === 2 || e.status >= 500)
    return "Meta had a temporary problem. Try again in a few minutes.";
  return `Meta refused the request${code ? ` (code ${code})` : ""}.`;
}

// ---------------------------------------------------------------------------------------------
// Money and links
// ---------------------------------------------------------------------------------------------

/** "AED 1,250" / "USD 1,250.5" — the account's own currency, never converted. */
export function money(amount: number | null | undefined, currency: string) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** "19 Nov 2026, 10:30" in Dubai time, or "not yet". */
export function syncTimeLabel(iso: string | null) {
  if (!iso) return "not yet";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** What "money back" means for this account: GCI is always AED, spend is in the account currency. */
export function moneyBackLabel(currency: string) {
  return currency === "AED" ? "AED back per AED 1 spent" : `AED GCI per ${currency} 1 spent`;
}

/** Link to the same row in Meta Ads Manager. Only a link: the CRM changes nothing in Meta. */
export function adsManagerUrl(adAccountId: string, level?: MetaLevel, id?: string) {
  const act = adAccountId.replace(/^act_/, "");
  const page = level === "ad" ? "ads" : level === "adset" ? "adsets" : "campaigns";
  const url = new URL(`https://adsmanager.facebook.com/adsmanager/manage/${page}`);
  url.searchParams.set("act", act);
  if (level && id) url.searchParams.set(`selected_${level}_ids`, id);
  return url.toString();
}

// ---------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------

export type ReportLead = {
  id: string;
  name: string;
  score: string;
  created_at: string;
  /** The client answered: a WhatsApp message in, or an answered / call-back call. */
  client_replied: boolean;
  meta_ad_id: string | null;
  meta_adset_id: string | null;
  meta_campaign_id: string | null;
};
export type ReportViewing = { lead_id: string | null; status: string };
export type ReportDeal = {
  lead_id: string | null;
  status: string;
  price_aed: number;
  commission_percent: number;
};
export type ReportHit = {
  created_at: string;
  duplicate: boolean;
  meta_ad_id: string | null;
  meta_adset_id: string | null;
  meta_campaign_id: string | null;
};

export type MetaReportInput = {
  level: MetaLevel;
  since: string;
  until: string;
  currency: string;
  insights: InsightRow[];
  leads: ReportLead[];
  viewings: ReportViewing[];
  deals: ReportDeal[];
  hits?: ReportHit[];
};

export type Metrics = {
  spend: number;
  leads: number;
  replyRatePct: number | null;
  costPerLead: number | null;
  deals: number;
  gci: number;
  moneyBack: number | null;
};

export type MetaAdRow = Metrics & {
  level: MetaLevel;
  id: string;
  name: string;
  /** Campaign name for an ad set or ad, else "". */
  parent: string;
  impressions: number;
  clicks: number;
  metaLeads: number;
  leadIds: string[];
  replied: number;
  viewings: number;
  viewingsDone: number;
  hot: number;
  warm: number;
  cold: number;
  unscored: number;
  duplicates: number;
  verdict: Verdict;
  reason: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Keep / Watch / Wasting money, with the reason in plain words. Rules run in this order. */
export function verdictFor(m: Metrics, currency: string): { verdict: Verdict; reason: string } {
  const keep = (reason: string) => ({ verdict: "keep" as const, reason });
  const watch = (reason: string) => ({ verdict: "watch" as const, reason });
  const waste = (reason: string) => ({ verdict: "waste" as const, reason });
  const aed = currency === "AED";
  const spent = money(m.spend, currency);
  const gci = money(m.gci, "AED");
  const replies =
    m.replyRatePct != null && m.leads >= MIN_LEADS_TO_JUDGE_REPLIES ? m.replyRatePct : null;

  if (m.spend <= 0 && m.leads === 0 && m.deals === 0)
    return watch("No spend and no leads in this period.");

  if (m.deals > 0) {
    const won = `${plural(m.deals, "deal")}, ${gci} GCI`;
    if (m.spend <= 0) return keep(`${won} and no spend in this period.`);
    if (!aed)
      return keep(
        `${won}. Money back is not judged: spend is in ${currency} and the CRM does not convert currencies.`,
      );
    const back = m.moneyBack ?? 0;
    if (back >= KEEP_MIN_MONEY_BACK) return keep(`${won}: AED ${back} back for every AED 1 spent.`);
    return watch(
      `${won}, but only AED ${back} back for every AED 1 spent (aim for ${KEEP_MIN_MONEY_BACK}).`,
    );
  }

  if (!aed) {
    if (replies != null && replies < LOW_REPLY_RATE_PCT)
      return watch(
        `Cheap leads, no buyers? Only ${replies}% replied and no deal yet. Spend is in ${currency}, so the CRM does not judge the amount.`,
      );
    return watch(
      `No deal yet. Spend is in ${currency} and the CRM does not convert currencies, so it does not call this ad wasting money.`,
    );
  }

  if (m.spend >= WASTE_MIN_SPEND_AED)
    return waste(`${spent} spent, ${plural(m.leads, "lead")}, no deal.`);
  if (m.leads === 0)
    return watch(
      `${spent} spent and no leads in the CRM from this ad. Check that Meta form leads reach the CRM with their ad id.`,
    );
  if (
    replies != null &&
    replies < LOW_REPLY_RATE_PCT &&
    m.costPerLead != null &&
    m.costPerLead <= GOOD_CPL_AED
  )
    return watch(
      `Cheap leads, no buyers: ${money(m.costPerLead, currency)} a lead but only ${replies}% replied.`,
    );
  if (m.costPerLead != null && m.costPerLead > HIGH_CPL_AED)
    return watch(`Leads are expensive: ${money(m.costPerLead, currency)} each, no deal yet.`);
  if (m.spend < MIN_SPEND_TO_JUDGE_AED) return watch(`Too early to judge: ${spent} spent so far.`);
  return watch(
    `No deal yet. ${plural(m.leads, "lead")}${replies != null ? `, ${replies}% replied` : ""}.`,
  );
}

type Acc = Omit<MetaAdRow, keyof Metrics | "verdict" | "reason" | "level"> & {
  spend: number;
  gci: number;
  deals: number;
  latest: string;
};

function newAcc(id: string): Acc {
  return {
    id,
    name: "",
    parent: "",
    latest: "",
    spend: 0,
    impressions: 0,
    clicks: 0,
    metaLeads: 0,
    leadIds: [],
    replied: 0,
    viewings: 0,
    viewingsDone: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    unscored: 0,
    duplicates: 0,
    deals: 0,
    gci: 0,
  };
}

const inPeriod = (day: string, since: string, until: string) => day >= since && day <= until;

/** Per campaign / ad set / ad: spend, leads, replies, viewings, deals, GCI, money back, quality, verdict. */
export function metaAdsReport(input: MetaReportInput) {
  const { level, since, until, currency } = input;
  const insights = input.insights.filter((r) => inPeriod(r.date, since, until));
  const adToAdset = new Map<string, string>();
  const adToCampaign = new Map<string, string>();
  const adsetToCampaign = new Map<string, string>();
  for (const r of insights) {
    if (r.adset_id) adToAdset.set(r.ad_id, r.adset_id);
    if (r.campaign_id) adToCampaign.set(r.ad_id, r.campaign_id);
    if (r.adset_id && r.campaign_id) adsetToCampaign.set(r.adset_id, r.campaign_id);
  }
  const keyOf = (ids: {
    meta_ad_id: string | null;
    meta_adset_id: string | null;
    meta_campaign_id: string | null;
  }): string | null => {
    const ad = ids.meta_ad_id;
    const adset = ids.meta_adset_id ?? (ad ? adToAdset.get(ad) : undefined) ?? null;
    if (level === "ad") return ad;
    if (level === "adset") return adset;
    return (
      ids.meta_campaign_id ??
      (ad ? adToCampaign.get(ad) : undefined) ??
      (adset ? adsetToCampaign.get(adset) : undefined) ??
      null
    );
  };

  const rows = new Map<string, Acc>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = newAcc(id)));
    return r;
  };
  for (const i of insights) {
    const id = level === "ad" ? i.ad_id : level === "adset" ? i.adset_id : i.campaign_id;
    if (!id) continue;
    const r = row(id);
    r.spend += i.spend;
    r.impressions += i.impressions;
    r.clicks += i.clicks;
    r.metaLeads += i.meta_leads;
    if (i.date >= r.latest) {
      r.latest = i.date;
      r.name = level === "ad" ? i.ad_name : level === "adset" ? i.adset_name : i.campaign_name;
      r.parent = level === "campaign" ? "" : i.campaign_name;
    }
  }

  const leadRow = new Map<string, Acc>();
  let unmatched = 0;
  for (const l of input.leads) {
    if (!inPeriod(dubaiDay(l.created_at), since, until)) continue;
    const id = keyOf(l);
    if (!id) {
      unmatched += 1;
      continue;
    }
    const r = row(id);
    r.leadIds.push(l.id);
    leadRow.set(l.id, r);
    if (l.client_replied) r.replied += 1;
    if (l.score === "Hot") r.hot += 1;
    else if (l.score === "Warm") r.warm += 1;
    else if (l.score === "Cold") r.cold += 1;
    else r.unscored += 1;
  }
  for (const v of input.viewings) {
    const r = v.lead_id ? leadRow.get(v.lead_id) : undefined;
    if (!r || v.status === "cancelled") continue;
    r.viewings += 1;
    if (v.status === "done") r.viewingsDone += 1;
  }
  for (const d of input.deals) {
    const r = d.lead_id ? leadRow.get(d.lead_id) : undefined;
    if (!r || d.status !== "closed") continue;
    r.deals += 1;
    r.gci += (Number(d.price_aed) * Number(d.commission_percent)) / 100;
  }
  for (const h of input.hits ?? []) {
    if (!h.duplicate || !inPeriod(dubaiDay(h.created_at), since, until)) continue;
    const id = keyOf(h);
    if (id) row(id).duplicates += 1;
  }

  const out: MetaAdRow[] = [...rows.values()].map(({ latest: _latest, ...r }) => {
    const leads = r.leadIds.length;
    const spend = round2(r.spend);
    const gci = round2(r.gci);
    const metrics: Metrics = {
      spend,
      leads,
      replyRatePct: leads > 0 ? Math.round((r.replied / leads) * 100) : null,
      costPerLead: leads > 0 && spend > 0 ? round2(spend / leads) : null,
      deals: r.deals,
      gci,
      moneyBack: spend > 0 ? round2(gci / spend) : null,
    };
    const name =
      r.name || `${level === "ad" ? "Ad" : level === "adset" ? "Ad set" : "Campaign"} ${r.id}`;
    return { ...r, ...metrics, name, level, ...verdictFor(metrics, currency) };
  });

  const days = daysInRange(since, until);
  return {
    rows: sortByMoneyBack(out),
    totals: totalsOf(out),
    unmatchedLeads: unmatched,
    currency,
    moneyBackLabel: moneyBackLabel(currency),
    suggestion: budgetSuggestion(out, currency, days),
  };
}

/** Best money back first; rows with no spend after rows with spend; then by spend. */
export function sortByMoneyBack<T extends { moneyBack: number | null; spend: number }>(
  rows: T[],
  direction: "desc" | "asc" = "desc",
) {
  const sign = direction === "desc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (a.moneyBack == null && b.moneyBack == null) return b.spend - a.spend;
    if (a.moneyBack == null) return 1;
    if (b.moneyBack == null) return -1;
    return sign * (b.moneyBack - a.moneyBack) || b.spend - a.spend;
  });
}

function totalsOf(rows: MetaAdRow[]) {
  const sum = (k: "spend" | "gci" | "leads" | "deals" | "viewings" | "replied") =>
    rows.reduce((s, r) => s + r[k], 0);
  const spend = round2(sum("spend"));
  const gci = round2(sum("gci"));
  const leads = sum("leads");
  return {
    spend,
    gci,
    leads,
    deals: sum("deals"),
    viewings: sum("viewings"),
    replyRatePct: leads > 0 ? Math.round((sum("replied") / leads) * 100) : null,
    costPerLead: leads > 0 && spend > 0 ? round2(spend / leads) : null,
    moneyBack: spend > 0 ? round2(gci / spend) : null,
  };
}

export type BudgetSuggestion = {
  fromId: string;
  toId: string;
  dailyAmount: number;
  text: string;
};

/**
 * From the Wasting-money row with the most spend to the Keep row with the best money back.
 * Null unless both exist. The amount is the wasting row's average daily spend in the period.
 */
export function budgetSuggestion(
  rows: MetaAdRow[],
  currency: string,
  days: number,
): BudgetSuggestion | null {
  const from = rows.filter((r) => r.verdict === "waste").sort((a, b) => b.spend - a.spend)[0];
  const to = rows
    .filter((r) => r.verdict === "keep" && r.moneyBack != null)
    .sort((a, b) => (b.moneyBack ?? 0) - (a.moneyBack ?? 0))[0];
  if (!from || !to) return null;
  const dailyAmount = Math.round(from.spend / Math.max(1, days));
  return {
    fromId: from.id,
    toId: to.id,
    dailyAmount,
    text: `Move about ${money(dailyAmount, currency)} a day from "${from.name}" (no deal) to "${to.name}" (${to.moneyBack} ${moneyBackLabel(currency)}). Make the change yourself in Meta Ads Manager — the CRM does not change ads.`,
  };
}
