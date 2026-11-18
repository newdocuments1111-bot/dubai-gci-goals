/**
 * Seller Finder: which of the agency's own owners and past buyers may be ready to sell or list now.
 * Only the agency's own rows, only facts that are stored. No outside data, no price guesses. Browser-safe and tested.
 */
import { daysUntil } from "./sellers";

export type FinderOwner = {
  id: string;
  name: string;
  phone: string;
  kind: string;
  intent: string;
  stage: string;
  area: string;
  building: string;
  lease_end: string | null;
  handover_date: string | null;
};
export type FinderListing = {
  id: string;
  owner_id: string | null;
  status: string;
  title: string;
  community: string;
  project: string;
  handover_date: string | null;
};
export type FinderDeal = {
  id: string;
  lead_id: string | null;
  listing_id: string | null;
  deal_type: string;
  track: string;
  status: string;
  closed_at: string | null;
};
export type FinderLead = {
  id: string;
  name: string;
  phone: string;
  do_not_call: boolean;
  stopped: boolean;
  opted_in: boolean;
};

export type ReasonKind =
  "bought" | "lease_ending" | "lease_ended" | "sell_intent" | "not_listed" | "handover";
/** One reason as a translatable sentence: `text` with {blanks}, the values, and the date behind {when} if any. */
export type ReasonPart = {
  kind: ReasonKind;
  text: string;
  vars: Record<string, string | number>;
  date?: string;
  dateStyle?: "day" | "month";
};
export type SellerCandidate = {
  id: string;
  name: string;
  kind: "owner" | "past buyer";
  score: "High" | "Medium";
  reasons: string[];
  unitLabel: string;
  reasonParts: ReasonPart[];
  /** The buyer's lead when the candidate is a past buyer, or an owner who is also a past buyer. */
  leadId: string | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** "2023-03-14" → "March 2023" / "14 March 2023". */
export function dateWords(day: string, style: "day" | "month" = "month"): string {
  const month = `${MONTHS[Number(day.slice(5, 7)) - 1] ?? ""} ${day.slice(0, 4)}`;
  return style === "day" ? `${Number(day.slice(8, 10))} ${month}` : month;
}
const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
const dubaiDay = (at: Date) => new Date(at.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
/** Phones match on their last nine digits, so +971 50… and 050… are the same person. */
const phoneKey = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-9) : "";
};

/** A listing the agency is working now. Listings have no withdrawn or expired status, only these three. */
export const isActiveListing = (l: Pick<FinderListing, "status">) =>
  l.status === "Available" || l.status === "Reserved";
/** No contact when the person said STOP, is marked do-not-call, or never agreed to be messaged. */
export const mayContact = (l: Pick<FinderLead, "do_not_call" | "stopped" | "opted_in">) =>
  !l.stopped && !l.do_not_call && l.opted_in;

export const HANDOVER_WINDOW_DAYS = 183;
export const LEASE_WINDOW_DAYS = 90;
export const YEARS_SINCE_PURCHASE = 2;

function leaseReason(leaseEnd: string | null, now: Date): ReasonPart | null {
  if (!leaseEnd || !DAY_RE.test(leaseEnd)) return null;
  const days = daysUntil(leaseEnd, now);
  if (days > LEASE_WINDOW_DAYS) return null;
  if (days < 0)
    return {
      kind: "lease_ended",
      text: "Lease ended on {when}, no new lease on record",
      vars: { when: dateWords(leaseEnd, "day") },
      date: leaseEnd,
      dateStyle: "day",
    };
  if (days === 0) return { kind: "lease_ending", text: "Lease ends today", vars: {} };
  if (days === 1) return { kind: "lease_ending", text: "Lease ends in 1 day", vars: {} };
  if (days < 14) return { kind: "lease_ending", text: "Lease ends in {n} days", vars: { n: days } };
  return {
    kind: "lease_ending",
    text: "Lease ends in {n} weeks",
    vars: { n: Math.round(days / 7) },
  };
}

function handoverReason(handover: string | null, now: Date): ReasonPart | null {
  if (!handover || !DAY_RE.test(handover)) return null;
  const days = daysUntil(handover, now);
  if (days < 0 || days > HANDOVER_WINDOW_DAYS) return null;
  return {
    kind: "handover",
    text: "Off-plan handover due in {when}",
    vars: { when: dateWords(handover) },
    date: handover,
    dateStyle: "month",
  };
}

function finish(
  base: Pick<SellerCandidate, "id" | "name" | "kind" | "unitLabel" | "leadId">,
  parts: ReasonPart[],
): SellerCandidate {
  return {
    ...base,
    score: parts.length >= 2 ? "High" : "Medium",
    reasons: parts.map((p) => fill(p.text, p.vars)),
    reasonParts: parts,
  };
}

/**
 * Candidates from plain rows. Two or more reasons is High, one is Medium; High first.
 * Skipped: owners with a live listing with the agency, owners already sold, and anyone who may not be contacted.
 */
export function findSellers(
  rows: {
    owners: FinderOwner[];
    listings: FinderListing[];
    deals: FinderDeal[];
    leads: FinderLead[];
  },
  now: Date = new Date(),
): SellerCandidate[] {
  const today = dubaiDay(now);
  const cutoff = `${Number(today.slice(0, 4)) - YEARS_SINCE_PURCHASE}${today.slice(4)}`;
  const listingById = new Map(rows.listings.map((l) => [l.id, l]));
  const leadById = new Map(rows.leads.map((l) => [l.id, l]));
  const sales = rows.deals.filter(
    (d) => d.status === "closed" && d.deal_type === "sale" && d.closed_at && d.lead_id,
  );

  // Past buyers: the latest purchase of each lead that is still theirs as far as our deals show.
  type Purchase = { lead: FinderLead; parts: ReasonPart[]; unitLabel: string; closed: string };
  const purchases = new Map<string, Purchase>();
  for (const d of sales) {
    const lead = leadById.get(d.lead_id ?? "");
    if (!lead || !d.closed_at) continue;
    const resold = sales.some(
      (x) =>
        x.id !== d.id &&
        d.listing_id !== null &&
        x.listing_id === d.listing_id &&
        x.lead_id !== d.lead_id &&
        (x.closed_at ?? "") > (d.closed_at ?? ""),
    );
    if (resold) continue;
    const closed = dubaiDay(new Date(d.closed_at));
    const listing = d.listing_id ? listingById.get(d.listing_id) : undefined;
    const area = listing?.community.trim() || listing?.project.trim() || "";
    const parts: ReasonPart[] = [];
    if (closed <= cutoff)
      parts.push({
        kind: "bought",
        text: area ? "Bought in {area} in {when}" : "Bought in {when}",
        vars: area ? { area, when: dateWords(closed) } : { when: dateWords(closed) },
        date: closed,
        dateStyle: "month",
      });
    if (d.track === "offplan") {
      const handover = handoverReason(listing?.handover_date ?? null, now);
      if (handover) parts.push(handover);
    }
    if (parts.length === 0) continue;
    const before = purchases.get(lead.id);
    if (!before || closed > before.closed)
      purchases.set(lead.id, { lead, parts, unitLabel: listing?.title.trim() || area, closed });
  }

  const out: SellerCandidate[] = [];
  const ownerPhones = new Set<string>();
  const blockedPhones = new Set(
    rows.leads
      .filter((l) => (l.stopped || l.do_not_call) && phoneKey(l.phone))
      .map((l) => phoneKey(l.phone)),
  );
  for (const o of rows.owners) {
    const key = phoneKey(o.phone);
    if (key) ownerPhones.add(key);
    // Owners carry no do-not-contact field of their own, so STOP or do-not-call on a lead with the same phone counts.
    if (key && blockedPhones.has(key)) continue;
    const mine = rows.listings.filter((l) => l.owner_id === o.id);
    if (mine.some(isActiveListing)) continue;
    if (o.stage === "closed" && o.intent === "sell") continue;
    const home = [o.building.trim(), o.area.trim()].filter(Boolean).join(", ");
    const parts: ReasonPart[] = [];
    if (o.intent === "sell")
      parts.push({
        kind: "sell_intent",
        text: "Marked as selling, no live listing with us",
        vars: {},
      });
    const lease = leaseReason(o.lease_end, now);
    if (lease) parts.push(lease);
    if (o.kind === "investor") {
      const handover = handoverReason(o.handover_date, now);
      if (handover) parts.push(handover);
    }
    // The same person as a past buyer: one row, with the purchase as a further reason.
    const match = key
      ? [...purchases.values()].find((p) => phoneKey(p.lead.phone) === key)
      : undefined;
    for (const p of match?.parts ?? []) if (!parts.some((x) => x.kind === p.kind)) parts.push(p);
    if (o.intent !== "sell" && o.stage !== "closed" && home)
      parts.push({
        kind: "not_listed",
        text: "Home at {home} is not listed with us",
        vars: { home },
      });
    if (parts.length === 0) continue;
    out.push(
      finish(
        {
          id: o.id,
          name: o.name,
          kind: "owner",
          unitLabel: home,
          leadId: match?.lead.id ?? null,
        },
        parts,
      ),
    );
  }

  for (const p of purchases.values()) {
    if (!mayContact(p.lead)) continue;
    const key = phoneKey(p.lead.phone);
    // Already an owner on our books: shown (or skipped) as that owner above.
    if (key && ownerPhones.has(key)) continue;
    out.push(
      finish(
        {
          id: p.lead.id,
          name: p.lead.name,
          kind: "past buyer",
          unitLabel: p.unitLabel,
          leadId: p.lead.id,
        },
        p.parts,
      ),
    );
  }

  return out.sort(
    (a, b) =>
      b.reasons.length - a.reasons.length || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1),
  );
}

const CLAUSE: Record<ReasonKind, (p: ReasonPart) => string> = {
  bought: (p) =>
    p.vars["area"]
      ? `you bought in ${p.vars["area"]} with us in ${p.vars["when"]}`
      : `you bought with us in ${p.vars["when"]}`,
  lease_ending: (p) => `the lease on your property ${fill(p.text, p.vars).replace(/^Lease /, "")}`,
  lease_ended: (p) => `the lease on your property ended on ${p.vars["when"]}`,
  sell_intent: () => "you mentioned that you may want to sell",
  not_listed: (p) => `we have your home at ${p.vars["home"]} on our records`,
  handover: (p) => `your off-plan property is due for handover in ${p.vars["when"]}`,
};

/**
 * A short first message the agent copies and sends by hand. English only.
 * No price claims, no market statements, no pressure: it states the stored reasons and offers a free price check.
 */
export function draftSellerMessage(
  c: Pick<SellerCandidate, "name" | "reasonParts" | "unitLabel">,
  agentName: string,
): string {
  const first = c.name.trim().split(/\s+/)[0] || "there";
  const agent = agentName.trim().split(/\s+/)[0] ?? "";
  const clauses = c.reasonParts.slice(0, 2).map((p) => CLAUSE[p.kind](p));
  const lines = [
    `Hello ${first},`,
    "",
    clauses.length
      ? `I hope you are well. I am getting in touch because ${clauses.join(" and ")}.`
      : "I hope you are well.",
    "",
    "Whether you plan to keep the property, rent it out or sell, I would be glad to prepare a free price check for you. There is no cost and no obligation.",
    "",
    "If this is not of interest, just tell me and I will not message you about it again.",
    "",
    "Kind regards,",
    ...(agent ? [agent] : []),
  ];
  return lines.join("\n");
}
