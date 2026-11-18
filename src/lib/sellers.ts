/** Seller and landlord side: pipeline stages, owner reports, rent cheques and monthly targets. Browser-safe and tested. */

export const SELLER_STAGES = [
  { id: "prospect", label: "Prospect", hint: "Owner we want to list" },
  { id: "valuation", label: "Valuation", hint: "Valuation booked or sent" },
  { id: "form_a", label: "Form A signed", hint: "Listing agreement signed" },
  { id: "listed", label: "Listed", hint: "Live with a permit" },
  { id: "under_offer", label: "Under offer", hint: "Buyer or tenant found" },
  { id: "closed", label: "Sold / let", hint: "Done" },
  { id: "lost", label: "Lost", hint: "Went elsewhere or withdrew" },
] as const;
export type SellerStage = (typeof SELLER_STAGES)[number]["id"];
export const stageLabel = (id: string) => SELLER_STAGES.find((s) => s.id === id)?.label ?? id;

const DAY = 86_400_000;
const dubaiToday = (now: Date) => new Date(now.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
export const daysUntil = (date: string, now: Date = new Date()) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dubaiToday(now)}T00:00:00Z`)) / DAY);

/** Lease end: when to start the renewal talk (Dubai notice is 90 days before expiry). */
export function leaseStatus(leaseEnd: string | null, now: Date = new Date()) {
  if (!leaseEnd) return null;
  const days = daysUntil(leaseEnd, now);
  if (days < 0)
    return {
      days,
      tone: "late" as const,
      label: `Lease ended ${-days} day${days === -1 ? "" : "s"} ago`,
    };
  if (days <= 90)
    return {
      days,
      tone: "soon" as const,
      label: `Lease ends in ${days} day${days === 1 ? "" : "s"}: talk renewal now`,
    };
  return { days, tone: "ok" as const, label: `Lease ends in ${days} days` };
}

export type Cheque = {
  id: string;
  owner_id: string;
  amount_aed: number;
  due_date: string;
  status: string;
  cheque_no: string;
  note: string;
};
export function chequeState(c: Pick<Cheque, "status" | "due_date">, now: Date = new Date()) {
  if (c.status === "bounced") return { tone: "late" as const, label: "Bounced" };
  if (c.status === "cleared") return { tone: "ok" as const, label: "Cleared" };
  if (c.status === "deposited") return { tone: "ok" as const, label: "Deposited" };
  const days = daysUntil(c.due_date, now);
  if (days < 0) return { tone: "late" as const, label: `Overdue ${-days} d` };
  if (days <= 7)
    return { tone: "soon" as const, label: days === 0 ? "Due today" : `Due in ${days} d` };
  return { tone: "ok" as const, label: `Due in ${days} d` };
}

/** Cheques that need a person: bounced, overdue, or due within a week. Worst first. */
export function chequesNeedingAction<T extends Pick<Cheque, "status" | "due_date">>(
  cheques: T[],
  now: Date = new Date(),
): T[] {
  const rank = (c: T) => (c.status === "bounced" ? -1000 : daysUntil(c.due_date, now));
  return cheques
    .filter(
      (c) => c.status === "bounced" || (c.status === "pending" && daysUntil(c.due_date, now) <= 7),
    )
    .sort((a, b) => rank(a) - rank(b));
}

export type ListingStats = {
  title: string;
  price_aed: number;
  status: string;
  listedAt: string;
  viewingsBooked: number;
  viewingsDone: number;
  matchingBuyers: number;
  enquiries: number;
};

/** A plain update the agent can copy and send to the owner. Only real counts; nothing is sent from here. */
export function ownerUpdate(
  ownerName: string,
  s: ListingStats,
  agentName: string,
  now: Date = new Date(),
): string {
  const days = Math.max(0, Math.round((now.getTime() - new Date(s.listedAt).getTime()) / DAY));
  const first = ownerName.trim().split(/\s+/)[0] || "there";
  const lines = [
    `Hello ${first}, here is your update on ${s.title}.`,
    "",
    `- On the market: ${days} day${days === 1 ? "" : "s"} at AED ${Math.round(s.price_aed).toLocaleString("en-US")}`,
    `- Enquiries: ${s.enquiries}`,
    `- Viewings: ${s.viewingsDone} done, ${s.viewingsBooked} booked`,
    `- Buyers on our books who fit: ${s.matchingBuyers}`,
    "",
    s.viewingsDone + s.viewingsBooked === 0 && days >= 14
      ? "No viewings yet after two weeks. I would like to talk about the price and photos with you."
      : s.viewingsDone >= 5
        ? "Good viewing numbers. I will share the feedback from each buyer with you."
        : "I will keep you posted as viewings come in.",
    "",
    agentName,
  ];
  return lines.join("\n");
}

/** Progress against a monthly target: null target means none was set. */
export function targetProgress(actual: number, target: number | null | undefined) {
  if (target == null || target <= 0) return null;
  const percent = Math.min(100, Math.round((actual / target) * 100));
  return { percent, left: Math.max(0, target - actual), hit: actual >= target };
}

/** Start of this month in Dubai, as ISO. */
export function dubaiMonthStart(now: Date = new Date()): string {
  const d = dubaiToday(now);
  return new Date(Date.parse(`${d.slice(0, 7)}-01T00:00:00Z`) - 4 * 3600_000).toISOString();
}
