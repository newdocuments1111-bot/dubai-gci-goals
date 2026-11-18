/**
 * WhatsApp campaigns: one approved template to a list of leads, with up to two follow-ups days later.
 * Browser-safe and tested. Every message still goes through the send queue, which re-checks consent,
 * STOP, Meta approval, the Dubai send window and the marketing gap right before sending.
 */
import { z } from "zod";
import { filterSchema, type LeadFilter } from "./lists";
import { dubaiSendWindow } from "./whatsapp-templates";

export const MAX_CAMPAIGN_LEADS = 500;
export const MAX_STEPS = 3;

export const stepSchema = z.object({
  templateId: z.string().uuid(),
  afterDays: z.number().int().min(0).max(90),
});
export type CampaignStep = z.infer<typeof stepSchema>;

export const campaignSchema = z.object({
  name: z.string().trim().min(1).max(100),
  audienceLabel: z.string().trim().max(200),
  filter: filterSchema,
  steps: z.array(stepSchema).min(1).max(MAX_STEPS),
  /** Typed once; used for every blank except the client's own name and area. */
  defaults: z.record(z.string().max(30), z.string().max(200)),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export type StepTemplate = { id: string; label: string; category: string; meta_status: string };

/** Plain-language problems with the plan, or an empty list when it can start. */
export function campaignProblems(
  steps: CampaignStep[],
  templates: StepTemplate[],
  gapDays: number,
): string[] {
  const problems: string[] = [];
  if (!steps.length) return ["Choose a message."];
  if (steps[0]!.afterDays !== 0) problems.push("The first message is sent now.");
  let lastMarketingDay: number | null = null;
  steps.forEach((s, i) => {
    const n = i + 1;
    const t = templates.find((x) => x.id === s.templateId);
    if (!t) {
      problems.push(`Choose a template for message ${n}.`);
      return;
    }
    if (t.meta_status !== "approved")
      problems.push(`Message ${n}: "${t.label}" is not approved by Meta yet.`);
    if (i > 0 && s.afterDays <= steps[i - 1]!.afterDays)
      problems.push(`Message ${n} must go later than message ${i}.`);
    if (t.category === "marketing") {
      if (lastMarketingDay !== null && s.afterDays - lastMarketingDay < gapDays)
        problems.push(
          `Message ${n} is a marketing message too soon after the last one. Leave at least ${gapDays} days between them.`,
        );
      lastMarketingDay = s.afterDays;
    }
  });
  return problems;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/**
 * The value for each blank for one lead: the client's own name and area win, everything else comes
 * from what the owner typed. Returns the blanks that are still empty.
 */
export function leadValues(
  lead: { name: string; area: string },
  tokens: string[],
  defaults: Record<string, string>,
): { values: Record<string, string>; missing: string[] } {
  const values: Record<string, string> = {};
  for (const t of new Set(tokens)) {
    const own = t === "name" ? firstName(lead.name) : t === "area" ? lead.area.trim() : "";
    values[t] = own || (defaults[t] ?? "").trim();
  }
  return { values, missing: Object.keys(values).filter((t) => !values[t]) };
}

/** A follow-up is dropped when the client has written back since the campaign started. */
export function followUpStopped(
  step: number | null | undefined,
  queuedAt: string,
  lastInboundAt: string | null | undefined,
): boolean {
  if (!step || step <= 1 || !lastInboundAt) return false;
  return new Date(lastInboundAt).getTime() > new Date(queuedAt).getTime();
}

export type AudienceOption = { key: string; label: string; filter: LeadFilter };

/** Ready-made audiences first, then the owner's saved lists. */
export function audienceOptions(saved: { id: string; name: string; filters: unknown }[]) {
  const base = filterSchema.parse({});
  const options: AudienceOption[] = [
    { key: "open", label: "All open leads", filter: base },
    { key: "hot", label: "Hot leads", filter: { ...base, score: "Hot" } },
    { key: "not_now", label: "Not-now leads", filter: { ...base, outcome: "not_now" } },
  ];
  for (const s of saved) {
    const parsed = filterSchema.safeParse(s.filters);
    if (parsed.success) options.push({ key: s.id, label: `List: ${s.name}`, filter: parsed.data });
  }
  return options;
}

export type CampaignCounts = {
  sent: number;
  waiting: number;
  blocked: number;
  failed: number;
  cancelled: number;
};

export function countStatuses(statuses: string[]): CampaignCounts {
  const c: CampaignCounts = { sent: 0, waiting: 0, blocked: 0, failed: 0, cancelled: 0 };
  for (const s of statuses) {
    if (s === "sent") c.sent++;
    else if (s === "blocked") c.blocked++;
    else if (s === "failed") c.failed++;
    else if (s === "cancelled") c.cancelled++;
    else c.waiting++;
  }
  return c;
}

/**
 * What Meta charges per delivered template message in the UAE, in AED.
 * ESTIMATES — check both against Meta's own rate card before relying on them:
 * marketing is USD 0.0576 (about AED 0.2115) as quoted by resellers from 1 Oct 2026, not confirmed
 * on Meta's page; the utility / authentication figure is a placeholder that is only known to be lower.
 */
export const META_MARKETING_RATE_AED_ESTIMATE = 0.2115;
export const META_UTILITY_RATE_AED_ESTIMATE = 0.05;
export const META_RATE_AED_ESTIMATE: Record<string, number> = {
  marketing: META_MARKETING_RATE_AED_ESTIMATE,
  utility: META_UTILITY_RATE_AED_ESTIMATE,
  authentication: META_UTILITY_RATE_AED_ESTIMATE,
};

/** Unknown categories are priced as marketing, so the estimate is never too low. */
export const rateFor = (category: string) =>
  META_RATE_AED_ESTIMATE[category] ?? META_MARKETING_RATE_AED_ESTIMATE;

export type StepCost = {
  /** Message number, starting at 1. */
  n: number;
  category: string;
  afterDays: number;
  /** Follow-ups stop when the client replies, so their figures are the most that can be sent. */
  upTo: boolean;
  messages: number;
  rateAed: number;
  aed: number;
};
export type CampaignCost = {
  steps: StepCost[];
  /** The first message, sent to everyone who will get the campaign. */
  firstSendAed: number;
  /** Every message sent to everyone: the most the campaign can cost, before VAT. */
  mostAed: number;
};

/**
 * Estimated Meta fee for a campaign to `leadCount` clients (only those who will be queued).
 * Every amount is rounded to whole fils per message line, and the totals are sums of those lines.
 */
export function campaignCost(
  steps: CampaignStep[],
  templates: { id: string; category: string }[],
  leadCount: number,
): CampaignCost {
  const messages = Math.max(0, Math.floor(Number.isFinite(leadCount) ? leadCount : 0));
  let firstFils = 0;
  let mostFils = 0;
  const lines = steps.map((s, i): StepCost => {
    const category = templates.find((t) => t.id === s.templateId)?.category ?? "marketing";
    const rateAed = rateFor(category);
    const fils = Math.round(messages * rateAed * 100);
    if (i === 0) firstFils = fils;
    mostFils += fils;
    return {
      n: i + 1,
      category,
      afterDays: s.afterDays,
      upTo: i > 0,
      messages,
      rateAed,
      aed: fils / 100,
    };
  });
  return { steps: lines, firstSendAed: firstFils / 100, mostAed: mostFils / 100 };
}

/** "AED 101" for whole dirhams, "AED 101.52" otherwise (never rounded down to look cheaper). */
export function formatAed(aed: number): string {
  const fils = Math.round((Number.isFinite(aed) ? aed : 0) * 100);
  return `AED ${(fils / 100).toLocaleString("en-US", {
    minimumFractionDigits: fils % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The per-message price, e.g. "AED 0.2115" (up to four decimals, at least two). */
export function formatRateAed(rateAed: number): string {
  return `AED ${rateAed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/** "Message 1 today · 480 × AED 0.2115 = AED 101.52"; follow-ups read "up to 480 × …". */
export function costLine(c: StepCost): string {
  const whenText =
    c.afterDays > 0 ? `after ${c.afterDays} ${c.afterDays === 1 ? "day" : "days"}` : "today";
  return `Message ${c.n} ${whenText} · ${c.upTo ? "up to " : ""}${c.messages} × ${formatRateAed(c.rateAed)} = ${formatAed(c.aed)}`;
}

/**
 * Meta limits how many marketing messages one person gets from all businesses together. A message
 * over that limit fails with this code and can go through when tried again later.
 */
export const META_PER_PERSON_LIMIT_CODE = 131049;
export const META_LIMIT_MAX_RETRIES = 2;
export const META_LIMIT_RETRY_HOURS = 24;
/** A failure older than this is left alone (nothing old is brought back to life). */
export const META_LIMIT_MAX_AGE_HOURS = 72;

/** Meta's error code from the stored failure text, which ends "... (code 131049)". */
export function metaErrorCode(errorText: string | null | undefined): number | null {
  const m = /\(code (\d{1,9})\)/.exec(errorText ?? "");
  return m ? Number(m[1]) : null;
}

export type MetaLimitRetry =
  | { action: "none" }
  | { action: "give_up"; reason: string }
  | { action: "retry"; at: Date; retries: number };

/**
 * What to do with a queue item whose send failed. Only Meta's per-person limit is retried: 24 hours
 * later, moved to the next 9am–8pm Dubai window, at most twice. The retry is only a new send time —
 * the send job still re-checks every rule (consent, STOP, approval, gap, hours) before sending.
 */
export function metaLimitRetry(input: {
  errorText: string | null | undefined;
  /** Retries already used for this item. */
  retries: number;
  /** When Meta reported the failure; omitted when it has just happened. */
  failedAt?: string | null;
  /** False once the item's campaign has been stopped. */
  campaignActive?: boolean;
  now?: Date;
}): MetaLimitRetry {
  if (metaErrorCode(input.errorText) !== META_PER_PERSON_LIMIT_CODE) return { action: "none" };
  const now = input.now ?? new Date();
  if (input.failedAt) {
    const age = now.getTime() - new Date(input.failedAt).getTime();
    if (!(age <= META_LIMIT_MAX_AGE_HOURS * 3600_000)) return { action: "none" };
  }
  if (input.campaignActive === false)
    return {
      action: "give_up",
      reason: "Not delivered: Meta's per-person marketing limit. The campaign was stopped.",
    };
  const retries = Number.isInteger(input.retries) && input.retries > 0 ? input.retries : 0;
  if (retries >= META_LIMIT_MAX_RETRIES)
    return {
      action: "give_up",
      reason: `Not delivered: Meta's per-person marketing limit, after ${META_LIMIT_MAX_RETRIES} more tries.`,
    };
  const at = dubaiSendWindow(new Date(now.getTime() + META_LIMIT_RETRY_HOURS * 3600_000)).nextOpen;
  return { action: "retry", at, retries: retries + 1 };
}
