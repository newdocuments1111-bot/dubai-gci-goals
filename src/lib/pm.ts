/**
 * Property Management: managed units, leases, rent cheques, maintenance, renewals and landlord statements.
 * Browser-safe and tested. Every date is a plain YYYY-MM-DD day; every amount is a record in AED, not an
 * accounting ledger. Nothing here files anything with Ejari or any authority, and nothing sends a message.
 */

export const UNIT_STATUSES = [
  { id: "occupied", label: "Occupied" },
  { id: "empty", label: "Empty" },
  { id: "notice", label: "On notice" },
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number]["id"];

export const UNIT_TYPES = ["apartment", "villa", "townhouse", "studio", "office", "shop"] as const;

export const LEASE_STATUSES = [
  { id: "active", label: "Active" },
  { id: "ended", label: "Ended" },
  { id: "renewed", label: "Renewed" },
] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number]["id"];

export const CHEQUE_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "banked", label: "Banked" },
  { id: "cleared", label: "Cleared" },
  { id: "bounced", label: "Bounced" },
] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number]["id"];

export const TICKET_STATUSES = [
  { id: "open", label: "Open" },
  { id: "assigned", label: "Assigned" },
  { id: "done", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number]["id"];

export const TICKET_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]["id"];

export const WHO_PAYS = [
  { id: "owner", label: "Landlord" },
  { id: "tenant", label: "Tenant" },
  { id: "company", label: "Our company" },
] as const;
export type WhoPays = (typeof WHO_PAYS)[number]["id"];

export const MAX_CHEQUES = 12;
export const RENEWAL_WINDOW_DAYS = 90;
export const NOTICE_DAYS = 90;

export const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

// ---------- dates ----------

const DAY = 86_400_000;
const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ms(s));

/** Today's date in Dubai (UTC+4, no daylight saving). */
export const dubaiToday = (now: Date = new Date()) => iso(now.getTime() + 4 * 3600_000);

export const addDays = (day: string, days: number) => iso(ms(day) + days * DAY);
export const daysBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY);

/** Same day of the month `months` later; the 31st becomes the last day of a shorter month. */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

/** A lease of one year from `start` ends the day before the anniversary. */
export const defaultLeaseEnd = (start: string) => addDays(addMonths(start, 12), -1);

export const formatDay = (day: string) =>
  new Date(ms(day)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export type Period = { from: string; to: string; label: string };

/** A calendar month ("2026-11") as a period with both ends included. */
export function monthPeriod(month: string): Period | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const from = `${month}-01`;
  const to = addDays(addMonths(from, 1), -1);
  const label = new Date(ms(from)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return { from, to, label };
}

// ---------- money ----------

const fils = (aed: number) => Math.round(aed * 100);
const fromFils = (f: number) => f / 100;
export const aed = (n: number) =>
  `AED ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ---------- cheque schedule ----------

export type ScheduledCheque = { seq: number; amount_aed: number; due_date: string };

/**
 * Splits the annual rent into `count` cheques spread evenly over twelve months from the start date.
 * Amounts are worked out in fils so they always add up to the rent exactly; any left-over fils go on the
 * first cheques. Returns an empty list when the inputs make no sense.
 */
export function chequeSchedule(
  annualRent: number,
  count: number,
  start: string,
): ScheduledCheque[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHEQUES) return [];
  if (!Number.isFinite(annualRent) || annualRent <= 0 || !isDay(start)) return [];
  const total = fils(annualRent);
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => ({
    seq: i + 1,
    amount_aed: fromFils(base + (i < extra ? 1 : 0)),
    due_date: addMonths(start, Math.floor((i * 12) / count)),
  }));
}

/** Adds amounts without floating-point drift. */
export const sumAed = (amounts: number[]) => fromFils(amounts.reduce((s, a) => s + fils(a), 0));

// ---------- cheque buckets ----------

export type ChequeLike = { status: string; due_date: string };

/**
 * Cheques that need a person, grouped the way the Cheques tab shows them.
 * thisWeek: pending and due within 7 days, including anything already overdue.
 * next30: pending and due in 8 to 30 days. banked: paid in, waiting to clear. bounced: returned by the bank.
 */
export function chequeBuckets<T extends ChequeLike>(cheques: T[], today: string) {
  const byDue = (a: T, b: T) => a.due_date.localeCompare(b.due_date);
  const pending = cheques.filter((c) => c.status === "pending");
  const days = (c: T) => daysBetween(today, c.due_date);
  return {
    thisWeek: pending.filter((c) => days(c) <= 7).sort(byDue),
    next30: pending.filter((c) => days(c) > 7 && days(c) <= 30).sort(byDue),
    banked: cheques.filter((c) => c.status === "banked").sort(byDue),
    bounced: cheques.filter((c) => c.status === "bounced").sort(byDue),
  };
}

export function chequeDueLabel(c: ChequeLike, today: string): { late: boolean; label: string } {
  const d = daysBetween(today, c.due_date);
  if (c.status === "bounced") return { late: true, label: "Bounced" };
  if (c.status === "cleared") return { late: false, label: "Cleared" };
  if (c.status === "banked") return { late: false, label: "Banked, waiting to clear" };
  if (d < 0) return { late: true, label: `Overdue ${-d} day${d === -1 ? "" : "s"}` };
  if (d === 0) return { late: false, label: "Due today" };
  return { late: false, label: `Due in ${d} day${d === 1 ? "" : "s"}` };
}

/** The next cheque still to be paid in on a lease, if any. */
export function nextCheque<T extends ChequeLike>(cheques: T[]): T | null {
  return (
    cheques
      .filter((c) => c.status === "pending")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null
  );
}

// ---------- renewals ----------

export type LeaseLike = { id: string; status: string; end_date: string };
export type Renewal<T> = {
  lease: T;
  daysLeft: number;
  /** The lease end date has already passed and the lease is still marked active. */
  ended: boolean;
  noticeBy: string;
  noticePassed: boolean;
  noticeLine: string;
};

/**
 * Active leases ending within 90 days (or already past their end date), soonest first, each with the date
 * 90 days before the end. This is a reminder of common practice only: it does not work out any rent
 * increase and does not look at any rent index.
 */
export function renewals<T extends LeaseLike>(
  leases: T[],
  today: string,
  windowDays: number = RENEWAL_WINDOW_DAYS,
): Renewal<T>[] {
  return leases
    .filter((l) => l.status === "active" && daysBetween(today, l.end_date) <= windowDays)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .map((lease) => {
      const daysLeft = daysBetween(today, lease.end_date);
      const noticeBy = addDays(lease.end_date, -NOTICE_DAYS);
      const noticePassed = noticeBy < today;
      return {
        lease,
        daysLeft,
        ended: daysLeft < 0,
        noticeBy,
        noticePassed,
        noticeLine: noticePassed
          ? `By practice, notice of changed terms was due by ${formatDay(noticeBy)}; that date has passed. Check the current rules.`
          : `By practice, give notice by ${formatDay(noticeBy)}; check the current rules.`,
      };
    });
}

// ---------- reminder drafts (copied by a person, never sent by the app) ----------

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

export function chequeReminder(a: {
  tenantName: string;
  unitLabel: string;
  seq: number;
  count: number;
  amount: number;
  dueDate: string;
  status: string;
  agencyName: string;
}): string {
  const which = `rent cheque ${a.seq} of ${a.count} (${aed(a.amount)}) for ${a.unitLabel}`;
  const body =
    a.status === "bounced"
      ? `Our records show that ${which}, dated ${formatDay(a.dueDate)}, was returned by the bank. Please contact us today so we can arrange a replacement payment.`
      : `This is a reminder that ${which} is dated ${formatDay(a.dueDate)} and will be paid in on or after that date. Please make sure the funds are available.`;
  return [`Hello ${firstName(a.tenantName)},`, "", body, "", "Thank you,", a.agencyName]
    .join("\n")
    .trim();
}

export function renewalReminder(a: {
  tenantName: string;
  unitLabel: string;
  endDate: string;
  proposedRent: string;
  agencyName: string;
}): string {
  const lines = [
    `Hello ${firstName(a.tenantName)},`,
    "",
    `Your lease for ${a.unitLabel} ends on ${formatDay(a.endDate)}. We would like to talk about renewal with you.`,
  ];
  if (a.proposedRent.trim())
    lines.push(`The landlord's proposed rent for the new term is ${a.proposedRent.trim()}.`);
  lines.push("Please let us know whether you plan to renew.", "", "Thank you,", a.agencyName);
  return lines.join("\n").trim();
}

// ---------- landlord statement ----------

export type StatementUnit = {
  id: string;
  building: string;
  unit_number: string;
  community: string;
  management_fee_percent: number;
};
export type StatementLease = { id: string; unit_id: string };
export type StatementCheque = {
  lease_id: string;
  amount_aed: number;
  status: string;
  due_date: string;
  bank_date: string | null;
  cleared_on: string | null;
};
export type StatementTicket = {
  unit_id: string;
  title: string;
  status: string;
  who_pays: string;
  cost_aed: number | null;
  opened_on: string;
  closed_on: string | null;
};
export type StatementLine = {
  unitId: string;
  unitLabel: string;
  feePercent: number;
  rentCleared: number;
  chequesCleared: number;
  fee: number;
  maintenance: number;
  maintenanceItems: { title: string; date: string; cost: number }[];
  net: number;
};
export type Statement = {
  from: string;
  to: string;
  lines: StatementLine[];
  totals: { rentCleared: number; fee: number; maintenance: number; net: number };
};

export const unitLabel = (u: { building: string; unit_number: string; community?: string }) =>
  [[u.building, u.unit_number].filter(Boolean).join(" ") || "Unit", u.community]
    .filter(Boolean)
    .join(", ");

/** The day a cleared cheque counts on: the recorded clearing date, else the bank date, else its due date. */
export const clearedDay = (c: Pick<StatementCheque, "cleared_on" | "bank_date" | "due_date">) =>
  c.cleared_on ?? c.bank_date ?? c.due_date;

const inPeriod = (day: string, from: string, to: string) => day >= from && day <= to;

/**
 * Draft statement for one landlord's units over a period (both ends included):
 * rent cleared, minus the management fee (a percent of cleared rent), minus finished maintenance the
 * landlord pays for, equals net to the landlord. Pass only that landlord's units; leases, cheques and
 * tickets of other units are ignored. Built from the records in the app; it is not an accounting ledger.
 */
export function ownerStatement(a: {
  units: StatementUnit[];
  leases: StatementLease[];
  cheques: StatementCheque[];
  tickets: StatementTicket[];
  from: string;
  to: string;
}): Statement {
  const lines = a.units.map((u): StatementLine => {
    const leaseIds = new Set(a.leases.filter((l) => l.unit_id === u.id).map((l) => l.id));
    const cleared = a.cheques.filter(
      (c) =>
        leaseIds.has(c.lease_id) && c.status === "cleared" && inPeriod(clearedDay(c), a.from, a.to),
    );
    const rent = cleared.reduce((s, c) => s + fils(Number(c.amount_aed)), 0);
    const feePercent = Number(u.management_fee_percent) || 0;
    const fee = Math.round((rent * feePercent) / 100);
    const items = a.tickets
      .filter(
        (t) =>
          t.unit_id === u.id &&
          t.who_pays === "owner" &&
          t.status === "done" &&
          Number(t.cost_aed) > 0 &&
          inPeriod(t.closed_on ?? t.opened_on, a.from, a.to),
      )
      .map((t) => ({
        title: t.title,
        date: t.closed_on ?? t.opened_on,
        cost: fromFils(fils(Number(t.cost_aed))),
      }))
      .sort((x, y) => x.date.localeCompare(y.date));
    const maintenance = items.reduce((s, i) => s + fils(i.cost), 0);
    return {
      unitId: u.id,
      unitLabel: unitLabel(u),
      feePercent,
      rentCleared: fromFils(rent),
      chequesCleared: cleared.length,
      fee: fromFils(fee),
      maintenance: fromFils(maintenance),
      maintenanceItems: items,
      net: fromFils(rent - fee - maintenance),
    };
  });
  const total = (pick: (l: StatementLine) => number) =>
    fromFils(lines.reduce((s, l) => s + fils(pick(l)), 0));
  return {
    from: a.from,
    to: a.to,
    lines,
    totals: {
      rentCleared: total((l) => l.rentCleared),
      fee: total((l) => l.fee),
      maintenance: total((l) => l.maintenance),
      net: total((l) => l.net),
    },
  };
}
