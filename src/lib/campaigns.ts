/**
 * WhatsApp campaigns: one approved template to a list of leads, with up to two follow-ups days later.
 * Browser-safe and tested. Every message still goes through the send queue, which re-checks consent,
 * STOP, Meta approval, the Dubai send window and the marketing gap right before sending.
 */
import { z } from "zod";
import { filterSchema, type LeadFilter } from "./lists";

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
