/**
 * Developer Desk: a developer's own projects, units, holds, sales and payment plans.
 * Browser-safe and tested. Nothing here sends a message, and nothing here registers a sale with
 * any authority: reminders are drafts the team copies, and the schedule is the developer's own record.
 */
import { z } from "zod";
import { BOM, csvCell } from "./records";

// ---------- Projects and units ----------

export const PROJECT_STATUSES = ["planning", "selling", "sold_out", "handed_over"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  selling: "Selling",
  sold_out: "Sold out",
  handed_over: "Handed over",
};

export const UNIT_STATUSES = ["free", "held", "sold"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];
export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  free: "Free",
  held: "Held",
  sold: "Sold",
};

export const UNIT_TYPES = ["Studio", "1BR", "2BR", "3BR", "4BR", "Townhouse", "Villa", "Retail"];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-06-30.");
const optionalDate = z.union([isoDate, z.literal("")]);
const money = z.number().finite().min(0).max(10_000_000_000);

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  developer_name: z.string().trim().max(120),
  community: z.string().trim().max(120),
  handover_date: optionalDate,
  status: z.enum(PROJECT_STATUSES),
  notes: z.string().trim().max(2000),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const unitSchema = z.object({
  unit_number: z.string().trim().min(1).max(30),
  unit_type: z.string().trim().max(30),
  bedrooms: z.number().int().min(0).max(20),
  size_sqft: z.number().finite().min(0).max(1_000_000),
  floor: z.string().trim().max(20),
  view: z.string().trim().max(80),
  price_aed: money,
});
export type UnitInput = z.infer<typeof unitSchema>;

export const MAX_UNIT_LINES = 500;

/** "1BR" → 1, "Studio" → 0, "3 bed" → 3. Used when a pasted line leaves bedrooms out. */
export function bedroomsFromType(type: string): number {
  const m = /(\d{1,2})\s*(br|bed)/i.exec(type);
  return m ? Number(m[1]) : 0;
}

const plainNumber = (text: string) => Number(text.replace(/[,\s"]|aed/gi, ""));

/**
 * Units pasted from a spreadsheet, one per line: unit, type, bedrooms, size, floor, view, price
 * (commas or tabs between them). Lines that cannot be read come back with the reason, never guessed.
 */
export function parseUnitLines(text: string): { units: UnitInput[]; problems: string[] } {
  const units: UnitInput[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  lines.forEach((line, i) => {
    const n = i + 1;
    const cells = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim());
    if (i === 0 && /^unit/i.test(cells[0] ?? "") && Number.isNaN(plainNumber(cells[6] ?? "x")))
      return; // heading row
    if (units.length >= MAX_UNIT_LINES) {
      if (units.length === MAX_UNIT_LINES && !problems.some((p) => p.startsWith("Only the first")))
        problems.push(`Only the first ${MAX_UNIT_LINES} units are added at once.`);
      return;
    }
    if (cells.length !== 7) {
      problems.push(
        `Line ${n}: expected 7 values (unit, type, bedrooms, size, floor, view, price), found ${cells.length}.`,
      );
      return;
    }
    const [unit, type, beds, size, floor, view, price] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const parsed = unitSchema.safeParse({
      unit_number: unit,
      unit_type: type,
      bedrooms: beds === "" ? bedroomsFromType(type) : plainNumber(beds),
      size_sqft: size === "" ? 0 : plainNumber(size),
      floor,
      view,
      price_aed: plainNumber(price),
    });
    if (!parsed.success || price === "") {
      problems.push(`Line ${n}: check the unit number, bedrooms, size and price.`);
      return;
    }
    const key = parsed.data.unit_number.toLowerCase();
    if (seen.has(key)) {
      problems.push(`Line ${n}: unit ${parsed.data.unit_number} appears twice.`);
      return;
    }
    seen.add(key);
    units.push(parsed.data);
  });
  return { units, problems };
}

// ---------- Holds ----------

export const DEFAULT_HOLD_HOURS = 48;
export const MAX_HOLD_HOURS = 720;

export const holdSchema = z.object({
  unitId: z.string().uuid(),
  client_name: z.string().trim().min(1).max(120),
  client_phone: z.string().trim().max(40),
  hours: z.number().int().min(1).max(MAX_HOLD_HOURS),
  broker_name: z.string().trim().max(120),
  broker_agency: z.string().trim().max(120),
  broker_phone: z.string().trim().max(40),
  notes: z.string().trim().max(500),
});
export type HoldInput = z.infer<typeof holdSchema>;

export type HoldLike = { expires_at: string; released_at: string | null };

export function holdExpiresAt(now: Date, hours = DEFAULT_HOLD_HOURS): Date {
  return new Date(now.getTime() + hours * 3_600_000);
}

/** A hold counts only until its end time, whether or not anything has tidied the row up yet. */
export function isHoldActive(hold: HoldLike | null | undefined, now: Date): boolean {
  if (!hold || hold.released_at) return false;
  return new Date(hold.expires_at).getTime() > now.getTime();
}

/**
 * The status to show. A sold unit is sold; otherwise it is held only while a live hold exists.
 * The stored status is never trusted for "held", so an expired hold never shows as held.
 */
export function effectiveStatus(
  storedStatus: string,
  hold: HoldLike | null | undefined,
  now: Date,
): UnitStatus {
  if (storedStatus === "sold") return "sold";
  return isHoldActive(hold, now) ? "held" : "free";
}

/** "Ends in 5 h", "Ends in 2 d 3 h", "Ends in 20 min". */
export function holdTimeLeft(expiresAt: string, now: Date): string {
  const mins = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "Ended";
  if (mins < 60) return `Ends in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Ends in ${hours} h`;
  return `Ends in ${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export function unitCounts(statuses: UnitStatus[]): Record<UnitStatus, number> {
  const counts = { free: 0, held: 0, sold: 0 };
  for (const s of statuses) counts[s]++;
  return counts;
}

// ---------- Payment plan ----------

export const DUE_RULES = ["days_after_booking", "fixed_date", "on_handover"] as const;
export type DueRule = (typeof DUE_RULES)[number];
export const DUE_RULE_LABEL: Record<DueRule, string> = {
  days_after_booking: "Days after booking",
  fixed_date: "Fixed date",
  on_handover: "On handover",
};
export const MAX_MILESTONES = 24;

export const milestoneSchema = z.object({
  label: z.string().trim().max(80),
  percent: z.number().finite().min(0).max(100),
  rule: z.enum(DUE_RULES),
  /** Used by "days after booking". */
  days: z.number().int().min(0).max(3650),
  /** Used by "fixed date"; empty otherwise. */
  date: optionalDate,
});
export type Milestone = z.infer<typeof milestoneSchema>;
export const planSchema = z.array(milestoneSchema).max(MAX_MILESTONES);

export const EXAMPLE_PLAN: Milestone[] = [
  { label: "Booking", percent: 20, rule: "days_after_booking", days: 0, date: "" },
  { label: "Second payment", percent: 30, rule: "days_after_booking", days: 90, date: "" },
  { label: "On handover", percent: 50, rule: "on_handover", days: 0, date: "" },
];

/** Reads a stored plan; anything that is not a valid plan becomes an empty one. */
export function readPlan(stored: unknown): Milestone[] {
  const parsed = planSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

// Percentages are compared in hundredths so 33.33 + 33.33 + 33.34 is exactly 100.
const hundredths = (percent: number) => Math.round(percent * 100);
export const planTotalPercent = (plan: Milestone[]) =>
  plan.reduce((sum, m) => sum + hundredths(m.percent), 0) / 100;

/** Plain-language problems with a plan, or an empty list when a schedule can be made from it. */
export function planProblems(plan: Milestone[]): string[] {
  if (!plan.length) return ["Add at least one payment."];
  const problems: string[] = [];
  plan.forEach((m, i) => {
    const n = i + 1;
    if (!m.label.trim()) problems.push(`Payment ${n} needs a name.`);
    if (!(hundredths(m.percent) > 0)) problems.push(`Payment ${n} needs a percent above 0.`);
    if (m.rule === "fixed_date" && !/^\d{4}-\d{2}-\d{2}$/.test(m.date))
      problems.push(`Payment ${n} needs a date.`);
  });
  const total = plan.reduce((sum, m) => sum + hundredths(m.percent), 0);
  if (total !== 10_000)
    problems.push(`The percentages add up to ${total / 100}%. They must total exactly 100%.`);
  return problems;
}

/** A calendar date some days later, e.g. ("2026-01-31", 1) → "2026-02-01". */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in Dubai. */
export function dubaiToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
}

const toFils = (aed: number) => Math.round(aed * 100);

export type ScheduleLine = {
  position: number;
  label: string;
  amount_aed: number;
  /** Empty when the payment is due on handover and the project has no handover date yet. */
  due_date: string | null;
};

/**
 * The instalments for one sale. Each amount is its share of the price in whole fils; the fils left
 * over by rounding go one each to the payments that were rounded down the most, so the amounts
 * always add up to the price exactly and none is negative. Throws when the plan is not valid.
 */
export function buildSchedule(
  plan: Milestone[],
  sale: { priceAed: number; saleDate: string; handoverDate: string | null },
): ScheduleLine[] {
  const problems = planProblems(plan);
  if (problems.length) throw new Error(problems[0]);
  if (!(sale.priceAed > 0)) throw new Error("The sale price must be above 0.");
  const priceFils = toFils(sale.priceAed);
  const exact = plan.map((m) => (priceFils * hundredths(m.percent)) / 10_000);
  const fils = exact.map(Math.floor);
  let left = priceFils - fils.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length, left--) fils[byRemainder[k]!.i]!++;
  return plan.map((m, i) => ({
    position: i + 1,
    label: m.label.trim(),
    amount_aed: fils[i]! / 100,
    due_date:
      m.rule === "fixed_date"
        ? m.date
        : m.rule === "on_handover"
          ? sale.handoverDate || null
          : addDays(sale.saleDate, m.days),
  }));
}

// ---------- Instalments: due, overdue, totals ----------

export type InstalmentLike = {
  amount_aed: number;
  due_date: string | null;
  paid_amount: number | null;
};

export const DUE_SOON_DAYS = 30;

/** What is still owed on one instalment (never below zero). */
export function instalmentOpenAed(i: InstalmentLike): number {
  return Math.max(0, toFils(Number(i.amount_aed)) - toFils(Number(i.paid_amount ?? 0))) / 100;
}
export const isSettled = (i: InstalmentLike) => instalmentOpenAed(i) === 0;

const byDue = <T extends InstalmentLike>(a: T, b: T) =>
  (a.due_date ?? "").localeCompare(b.due_date ?? "");

/** Not fully paid and the due date has passed. Due today is not overdue. */
export function overdueInstalments<T extends InstalmentLike>(rows: T[], today: string): T[] {
  return rows.filter((i) => !isSettled(i) && i.due_date !== null && i.due_date < today).sort(byDue);
}

/** Not fully paid and due from today up to and including `days` days ahead. */
export function dueSoonInstalments<T extends InstalmentLike>(
  rows: T[],
  today: string,
  days = DUE_SOON_DAYS,
): T[] {
  const until = addDays(today, days);
  return rows
    .filter(
      (i) => !isSettled(i) && i.due_date !== null && i.due_date >= today && i.due_date <= until,
    )
    .sort(byDue);
}

export type CollectionTotals = {
  soldAed: number;
  collectedAed: number;
  outstandingAed: number;
  overdueAed: number;
  dueSoonAed: number;
};

/** Collected against outstanding for a set of instalments (one project, or everything). */
export function collectionTotals(rows: InstalmentLike[], today: string): CollectionTotals {
  const sum = (list: number[]) => list.reduce((a, b) => a + toFils(b), 0) / 100;
  return {
    soldAed: sum(rows.map((i) => Number(i.amount_aed))),
    collectedAed: sum(rows.map((i) => Number(i.paid_amount ?? 0))),
    outstandingAed: sum(rows.map(instalmentOpenAed)),
    overdueAed: sum(overdueInstalments(rows, today).map(instalmentOpenAed)),
    dueSoonAed: sum(dueSoonInstalments(rows, today).map(instalmentOpenAed)),
  };
}

// ---------- Sales and outside brokers ----------

export const saleSchema = z.object({
  unitId: z.string().uuid(),
  /** The live hold being turned into this sale, when there is one. */
  holdId: z.string().uuid().nullable(),
  buyer_name: z.string().trim().min(1).max(120),
  buyer_phone: z.string().trim().max(40),
  leadId: z.string().uuid().nullable(),
  sale_price_aed: money.refine((n) => n > 0, "Enter the sale price."),
  sale_date: isoDate,
  broker_name: z.string().trim().max(120),
  broker_agency: z.string().trim().max(120),
  broker_phone: z.string().trim().max(40),
  broker_commission_percent: z.number().finite().min(0).max(100),
});
export type SaleInput = z.infer<typeof saleSchema>;

export const commissionAed = (priceAed: number, percent: number) =>
  Math.round(toFils(priceAed) * (percent / 100)) / 100;

export type BrokerSale = {
  broker_name: string;
  broker_agency: string;
  sale_price_aed: number;
  broker_commission_percent: number;
};
export type BrokerHold = HoldLike & { broker_name: string; broker_agency: string };
export type BrokerLine = {
  name: string;
  agency: string;
  unitsSold: number;
  salesAed: number;
  commissionAed: number;
  activeHolds: number;
};

/**
 * Units and commission per outside broker. Brokers are matched by the name typed on the hold or
 * sale (ignoring capitals and extra spaces), because outside brokers have no account here.
 */
export function brokerSummary(sales: BrokerSale[], holds: BrokerHold[], now: Date): BrokerLine[] {
  const lines = new Map<string, BrokerLine>();
  const line = (name: string, agency: string) => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return null;
    const key = clean.toLowerCase();
    let found = lines.get(key);
    if (!found) {
      found = {
        name: clean,
        agency: "",
        unitsSold: 0,
        salesAed: 0,
        commissionAed: 0,
        activeHolds: 0,
      };
      lines.set(key, found);
    }
    if (!found.agency && agency.trim()) found.agency = agency.trim();
    return found;
  };
  for (const s of sales) {
    const l = line(s.broker_name, s.broker_agency);
    if (!l) continue;
    l.unitsSold++;
    l.salesAed = (toFils(l.salesAed) + toFils(Number(s.sale_price_aed))) / 100;
    l.commissionAed =
      (toFils(l.commissionAed) +
        toFils(commissionAed(Number(s.sale_price_aed), Number(s.broker_commission_percent)))) /
      100;
  }
  for (const h of holds) {
    if (!isHoldActive(h, now)) continue;
    const l = line(h.broker_name, h.broker_agency);
    if (l) l.activeHolds++;
  }
  return [...lines.values()].sort(
    (a, b) => b.commissionAed - a.commissionAed || a.name.localeCompare(b.name),
  );
}

// ---------- Wording ----------

export const aed = (n: number) =>
  `AED ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export const longDate = (date: string) =>
  new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** A payment reminder for the team to copy and send themselves. The app does not send it. */
export function reminderMessage(input: {
  buyerName: string;
  projectName: string;
  unitNumber: string;
  label: string;
  openAed: number;
  dueDate: string | null;
  today: string;
  developerName: string;
}): string {
  const first = input.buyerName.trim().split(/\s+/)[0] || "there";
  const what = `the "${input.label}" payment of ${aed(input.openAed)} for unit ${input.unitNumber} at ${input.projectName}`;
  const when = !input.dueDate
    ? `${what} is due on handover`
    : input.dueDate < input.today
      ? `${what} was due on ${longDate(input.dueDate)} and is still open on our records`
      : `${what} is due on ${longDate(input.dueDate)}`;
  const from = input.developerName.trim() ? `\n${input.developerName.trim()}` : "";
  return `Hello ${first}, a friendly reminder that ${when}. If you have already paid, please send us the receipt so we can update our records. Thank you.${from}`;
}

// ---------- Price list ----------

export type PriceListUnit = {
  unit_number: string;
  unit_type: string;
  bedrooms: number;
  size_sqft: number;
  floor: string;
  view: string;
  price_aed: number;
};

const PRICE_LIST_COLUMNS: readonly (readonly [keyof PriceListUnit, string])[] = [
  ["unit_number", "Unit"],
  ["unit_type", "Type"],
  ["bedrooms", "Bedrooms"],
  ["size_sqft", "Size (sq ft)"],
  ["floor", "Floor"],
  ["view", "View"],
  ["price_aed", "Price (AED)"],
];

/** The price list of free units as a CSV file. Every cell goes through the formula guard. */
export function priceListCsv(units: PriceListUnit[]): string {
  const lines = [PRICE_LIST_COLUMNS.map(([, heading]) => csvCell(heading)).join(",")];
  for (const u of units) lines.push(PRICE_LIST_COLUMNS.map(([key]) => csvCell(u[key])).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export const priceListFileName = (projectName: string, today: string) =>
  `${
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  }-price-list-${today}.csv`;
