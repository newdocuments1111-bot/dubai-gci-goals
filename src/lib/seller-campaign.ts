/**
 * Seller Finder → WhatsApp campaign. Turns the people picked in "Likely to sell" into lead ids that may
 * get a campaign, and says who is left out and why. Browser-safe and tested.
 *
 * Consent rule: only a lead's own recorded WhatsApp consent counts (`opted_in`, as the campaign and send
 * code check it). `owners.agreed_to_updates` is the owner-update tick (a listing report the agent copies
 * by hand), not WhatsApp marketing consent, so an owner is only reached through a lead with the same
 * phone that has consent. No lead and no consent is ever created here.
 */
import { z } from "zod";
import { MAX_CAMPAIGN_LEADS } from "./campaigns";
import { phoneKey } from "./seller-finder";
import { phoneDigits } from "./whatsapp";

/** At most this many people can be picked at once (more than a campaign can take, so the rest are counted). */
export const MAX_SELLER_PICKS = 2000;

export const sellerPickSchema = z.object({
  kind: z.enum(["owner", "past buyer"]),
  id: z.string().uuid(),
});
export type SellerPick = z.infer<typeof sellerPickSchema>;

export const prepareSellerCampaignSchema = z.object({
  picks: z.array(sellerPickSchema).min(1).max(MAX_SELLER_PICKS),
  label: z.string().trim().min(1).max(200),
});

export type PickOwner = { id: string; phone: string };
export type PickLead = {
  id: string;
  phone: string;
  opted_in: boolean;
  stopped: boolean;
  do_not_call: boolean;
};

export type SkipReason =
  "no_consent" | "stopped" | "do_not_call" | "no_lead" | "duplicate" | "no_number" | "over_limit";

export type SellerSkipped = Record<SkipReason, number>;

export const SKIP_TEXT: Record<SkipReason, string> = {
  no_consent: "no WhatsApp consent on record",
  no_lead: "no WhatsApp consent on record (not a lead in the CRM)",
  stopped: "replied STOP",
  do_not_call: "marked do not contact",
  duplicate: "same phone as someone already picked",
  no_number: "no WhatsApp number",
  over_limit: `one campaign reaches at most ${MAX_CAMPAIGN_LEADS} clients`,
};

const emptySkipped = (): SellerSkipped => ({
  no_consent: 0,
  stopped: 0,
  do_not_call: 0,
  no_lead: 0,
  duplicate: 0,
  no_number: 0,
  over_limit: 0,
});

export type SellerAudience = {
  leadIds: string[];
  skipped: SellerSkipped;
  /** One line per pick, in the order picked: the lead that will be used, or why not. */
  rows: { pick: SellerPick; leadId: string | null; reason: SkipReason | null }[];
};

/**
 * Picked owners and past buyers → lead ids that may get the campaign.
 * - Past buyer: their own lead.
 * - Owner: a lead with the same phone (last nine digits, as Seller Finder matches), preferring one with consent.
 * - Anyone whose phone belongs to a lead that said STOP or is marked do-not-call is left out,
 *   even if another lead with that phone has consent.
 * `owners` and `leads` must already be limited to the caller's agency; ids not found there are "no_lead".
 */
export function resolveSellerAudience(input: {
  picks: SellerPick[];
  owners: PickOwner[];
  leads: PickLead[];
  max?: number;
}): SellerAudience {
  const max = input.max ?? MAX_CAMPAIGN_LEADS;
  const ownerById = new Map(input.owners.map((o) => [o.id, o]));
  const leadById = new Map(input.leads.map((l) => [l.id, l]));
  const byPhone = new Map<string, PickLead[]>();
  for (const l of input.leads) {
    const k = phoneKey(l.phone);
    if (!k) continue;
    byPhone.set(k, [...(byPhone.get(k) ?? []), l]);
  }
  const skipped = emptySkipped();
  const rows: SellerAudience["rows"] = [];
  const leadIds: string[] = [];
  const usedLeads = new Set<string>();
  const usedPhones = new Set<string>();
  const seenPicks = new Set<string>();

  for (const pick of input.picks) {
    const pickKey = `${pick.kind}:${pick.id}`;
    if (seenPicks.has(pickKey)) continue;
    seenPicks.add(pickKey);
    const skip = (reason: SkipReason) => {
      skipped[reason]++;
      rows.push({ pick, leadId: null, reason });
    };

    let lead: PickLead | undefined;
    let key = "";
    if (pick.kind === "past buyer") {
      lead = leadById.get(pick.id);
      if (!lead) {
        skip("no_lead");
        continue;
      }
      key = phoneKey(lead.phone);
    } else {
      const owner = ownerById.get(pick.id);
      key = owner ? phoneKey(owner.phone) : "";
      const same = key ? (byPhone.get(key) ?? []) : [];
      if (!same.length) {
        skip("no_lead");
        continue;
      }
      lead = same.find((l) => l.opted_in && !l.stopped && !l.do_not_call) ?? same[0];
    }
    const samePhone = key ? (byPhone.get(key) ?? []) : [lead!];
    if (lead!.stopped || samePhone.some((l) => l.stopped)) skip("stopped");
    else if (lead!.do_not_call || samePhone.some((l) => l.do_not_call)) skip("do_not_call");
    else if (!lead!.opted_in) skip("no_consent");
    else if (phoneDigits(lead!.phone).length < 6) skip("no_number");
    else if (usedLeads.has(lead!.id) || (key && usedPhones.has(key))) skip("duplicate");
    else if (leadIds.length >= max) skip("over_limit");
    else {
      usedLeads.add(lead!.id);
      if (key) usedPhones.add(key);
      leadIds.push(lead!.id);
      rows.push({ pick, leadId: lead!.id, reason: null });
    }
  }
  return { leadIds, skipped, rows };
}

/** "All", "Only High" or ticked by hand: the picks and the audience name shown on the campaign. */
export function sellerSelection(
  candidates: { id: string; kind: "owner" | "past buyer"; score: "High" | "Medium" }[],
  mode: "all" | "high" | "ticked",
  ticked: ReadonlySet<string> = new Set(),
): { picks: SellerPick[]; label: string } {
  const chosen = candidates.filter((c) =>
    mode === "all" ? true : mode === "high" ? c.score === "High" : ticked.has(pickKey(c)),
  );
  const word = mode === "all" ? "All" : mode === "high" ? "High" : "Picked";
  return {
    picks: chosen.map((c) => ({ kind: c.kind, id: c.id })),
    label: `Likely to sell · ${word} (${chosen.length})`,
  };
}

export const pickKey = (c: { kind: string; id: string }) => `${c.kind}-${c.id}`;

/**
 * The hand-over from the Owners page to the Campaigns page: lead ids and counts only (never names or
 * phones), kept in memory in this browser tab for a short time and never put in the URL.
 */
export type SellerHandoff = {
  label: string;
  leadIds: string[];
  picked: number;
  skipped: SellerSkipped;
  at: number;
};
export const HANDOFF_TTL_MS = 30 * 60_000;
let handoff: SellerHandoff | null = null;

export function setSellerHandoff(h: Omit<SellerHandoff, "at">, now = Date.now()) {
  handoff = { ...h, leadIds: [...h.leadIds], at: now };
}
export function readSellerHandoff(now = Date.now()): SellerHandoff | null {
  if (handoff && now - handoff.at > HANDOFF_TTL_MS) handoff = null;
  return handoff;
}
export function clearSellerHandoff() {
  handoff = null;
}
