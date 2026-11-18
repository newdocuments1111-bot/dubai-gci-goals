/**
 * Holiday Homes: short-stay homes managed for owners, their bookings, calendar-file import, turnover
 * tasks and owner payouts. Browser-safe and tested. Every date is a plain YYYY-MM-DD day and a stay
 * covers the nights from check-in up to, but not including, check-out.
 *
 * Nothing here talks to Airbnb or Booking.com, takes a payment, sends a message or files a guest
 * registration with any authority. Bookings come in by hand or from a calendar file the operator
 * exports from the booking site.
 */

export const SOURCES = [
  { id: "airbnb", label: "Airbnb" },
  { id: "booking", label: "Booking.com" },
  { id: "direct", label: "Direct" },
  { id: "other", label: "Other" },
] as const;
export type BookingSource = (typeof SOURCES)[number]["id"];
export const SOURCE_IDS = ["airbnb", "booking", "direct", "other"] as const;

export const BOOKING_STATUSES = [
  { id: "confirmed", label: "Confirmed" },
  { id: "checked_in", label: "Checked in" },
  { id: "checked_out", label: "Checked out" },
  { id: "cancelled", label: "Cancelled" },
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number]["id"];
export const BOOKING_STATUS_IDS = ["confirmed", "checked_in", "checked_out", "cancelled"] as const;

export const TASK_KINDS = [
  { id: "cleaning", label: "Cleaning" },
  { id: "check_in", label: "Check-in" },
  { id: "check_out", label: "Check-out" },
  { id: "maintenance", label: "Maintenance" },
  { id: "other", label: "Other" },
] as const;
export type TaskKind = (typeof TASK_KINDS)[number]["id"];
export const TASK_KIND_IDS = ["cleaning", "check_in", "check_out", "maintenance", "other"] as const;

export const PERMIT_WARNING_DAYS = 30;
/** Times of day (Dubai) used for the automatic tasks. */
export const CHECK_IN_TIME = "15:00";
export const CHECK_OUT_TIME = "11:00";
export const MAX_IMPORT_EVENTS = 500;

export const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

// ---------- dates ----------

const DAY = 86_400_000;
const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** A real calendar day written as YYYY-MM-DD (2026-02-30 is refused). */
export const isDay = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ms(s)) && iso(ms(s)) === s;

/** Today's date in Dubai (UTC+4, no daylight saving). */
export const dubaiToday = (now: Date = new Date()) => iso(now.getTime() + 4 * 3600_000);
/** The Dubai day of a stored time. */
export const dubaiDay = (at: string) => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? "" : iso(t + 4 * 3600_000);
};
/** The Dubai time of day (HH:MM) of a stored time. */
export const dubaiTime = (at: string) => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? "" : new Date(t + 4 * 3600_000).toISOString().slice(11, 16);
};
/** A Dubai day and time as a time with its offset, ready to store. */
export const dubaiAt = (day: string, time: string) => `${day}T${time}:00+04:00`;

export const addDays = (day: string, days: number) => iso(ms(day) + days * DAY);
export const daysBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY);
export const nights = (b: { check_in: string; check_out: string }) =>
  Math.max(0, daysBetween(b.check_in, b.check_out));

export const formatDay = (day: string) =>
  new Date(ms(day)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export type Month = {
  /** First day of the month. */
  from: string;
  /** First day of the next month (not part of this month). */
  until: string;
  /** Last day of the month. */
  to: string;
  days: string[];
  label: string;
};

/** A calendar month written as "2026-11". */
export function monthOf(month: string): Month | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const from = `${month}-01`;
  const until = iso(Date.UTC(y, m, 1));
  const days: string[] = [];
  for (let d = from; d < until; d = addDays(d, 1)) days.push(d);
  const label = new Date(ms(from)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return { from, until, to: addDays(until, -1), days, label };
}

/** The month before or after ("2026-12" + 1 is "2027-01"). */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

// ---------- money ----------

const fils = (aed: number) => Math.round(aed * 100);
const fromFils = (f: number) => f / 100;
export const aed = (n: number) =>
  `AED ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ---------- double bookings ----------

export type Stay = {
  id?: string | undefined;
  home_id: string;
  check_in: string;
  check_out: string;
  status: string;
};

/** Two stays clash when they share a night. Checking out and in on the same day is allowed. */
export const staysOverlap = (
  a: { check_in: string; check_out: string },
  b: { check_in: string; check_out: string },
) => a.check_in < b.check_out && b.check_in < a.check_out;

/**
 * The bookings a new or edited stay would clash with: same home, not cancelled, sharing a night.
 * A cancelled stay never clashes, and a stay never clashes with itself. The database enforces the
 * same rule; this is for warning before saving.
 */
export function findConflicts<T extends Stay>(stay: Stay, existing: T[]): T[] {
  if (stay.status === "cancelled") return [];
  return existing.filter(
    (b) =>
      b.home_id === stay.home_id &&
      b.status !== "cancelled" &&
      (!stay.id || b.id !== stay.id) &&
      staysOverlap(stay, b),
  );
}

// ---------- calendar file (.ics) import ----------

export type IcsEvent = {
  uid: string;
  check_in: string;
  check_out: string;
  summary: string;
};
export type IcsResult = {
  /** Events that look like guest stays. */
  bookings: IcsEvent[];
  /** Events that are blocks ("Not available", "Blocked", "Closed"), not guest stays. */
  blocked: IcsEvent[];
  /** Events that could not be read: no UID, or missing or impossible dates. */
  invalid: number;
  /** The same UID appearing again in the file; only the first is kept. */
  duplicates: number;
};

/** Undo RFC 5545 line folding: a line starting with a space or tab continues the one before. */
export function unfoldIcs(text: string): string[] {
  const out: string[] = [];
  for (const line of (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r\n|\n|\r/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length)
      out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

const unescapeIcs = (s: string) =>
  s.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? " " : c)).trim();

/** The day of a DTSTART/DTEND value: 20261120, 20261120T140000 or 20261120T140000Z. */
function icsDay(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(value.trim());
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  return isDay(day) ? day : null;
}

const ICS_FIELDS = ["UID", "DTSTART", "DTEND", "SUMMARY"] as const;
type IcsField = (typeof ICS_FIELDS)[number];
type IcsFields = Partial<Record<IcsField, string>>;
const isIcsField = (name: string): name is IcsField =>
  (ICS_FIELDS as readonly string[]).includes(name);

/**
 * Booking sites mark days the host closed by hand (and sometimes their own reservations, see the
 * import screen) with wording like this. Such an entry carries no guest, so it is not a booking.
 */
export const isBlockSummary = (summary: string) =>
  /not available|unavailable|blocked|closed/i.test(summary);

/**
 * Reads a calendar file exported from Airbnb, Booking.com or any other iCalendar source. Each VEVENT
 * with a UID and whole-day DTSTART/DTEND becomes one stay: DTSTART is the check-in day and DTEND the
 * check-out day. An event with a start but no end is one night. Blocks are returned separately so
 * the screen can say how many were skipped. The UID is the identity used for re-import.
 */
export function parseIcs(text: string): IcsResult {
  const result: IcsResult = { bookings: [], blocked: [], invalid: 0, duplicates: 0 };
  const seen = new Set<string>();
  let event: IcsFields | null = null;
  let nested = 0;
  for (const line of unfoldIcs(text)) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const name = line.slice(0, colon).split(";")[0]!.trim().toUpperCase();
    const value = line.slice(colon + 1);
    if (name === "BEGIN") {
      if (value.trim().toUpperCase() === "VEVENT" && !event) event = {};
      else if (event) nested++;
      continue;
    }
    if (name === "END") {
      if (event && nested > 0) nested--;
      else if (event && value.trim().toUpperCase() === "VEVENT") {
        const uid = (event.UID ?? "").trim().slice(0, 300);
        const start = icsDay(event.DTSTART ?? "");
        const end = event.DTEND ? icsDay(event.DTEND) : start ? addDays(start, 1) : null;
        if (!uid || !start || !end || end <= start) result.invalid++;
        else if (seen.has(uid)) result.duplicates++;
        else {
          seen.add(uid);
          const summary = unescapeIcs(event.SUMMARY ?? "").slice(0, 200);
          (isBlockSummary(summary) ? result.blocked : result.bookings).push({
            uid,
            check_in: start,
            check_out: end,
            summary,
          });
        }
        event = null;
      }
      continue;
    }
    // Properties of nested parts (an alarm inside an event) are not the event's own.
    if (event && nested === 0 && isIcsField(name) && event[name] === undefined) event[name] = value;
  }
  return result;
}

/**
 * The guest name to show for an imported stay. Calendar files rarely carry one ("Reserved"), so the
 * name falls back to "<Site> guest" and the operator fills in the real one.
 */
export function importedGuestName(summary: string, source: BookingSource): string {
  const s = summary
    .replace(/^(reserved|reservation|booked|booking|airbnb|booking\.com)\s*[-:–]?\s*/i, "")
    .replace(/^\((.*)\)$/, "$1")
    .trim();
  if (s && !/^(reserved|reservation|booked|airbnb|booking\.com)$/i.test(s)) return s.slice(0, 200);
  return `${labelOf(SOURCES, source)} guest`;
}

export type ImportPlan = {
  /** New stays to add. */
  create: IcsEvent[];
  /** Stays already imported whose dates changed in the file. */
  update: { id: string; event: IcsEvent }[];
  /** Stays already imported with the same dates. */
  unchanged: number;
};

/**
 * Matches the events of a file to the bookings already stored for the home by UID, so importing the
 * same file twice adds nothing the second time and a changed date updates the existing booking.
 */
export function planImport(
  events: IcsEvent[],
  existing: { id: string; external_uid: string | null; check_in: string; check_out: string }[],
): ImportPlan {
  const byUid = new Map(existing.filter((b) => b.external_uid).map((b) => [b.external_uid!, b]));
  const plan: ImportPlan = { create: [], update: [], unchanged: 0 };
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.uid)) continue;
    seen.add(event.uid);
    const match = byUid.get(event.uid);
    if (!match) plan.create.push(event);
    else if (match.check_in !== event.check_in || match.check_out !== event.check_out)
      plan.update.push({ id: match.id, event });
    else plan.unchanged++;
  }
  return plan;
}

// ---------- automatic tasks ----------

export type AutoTask = { kind: "cleaning" | "check_in"; due_at: string; note: string };

/**
 * The tasks every booking gets: a check-in task on the arrival day and a cleaning task on the
 * departure day. There is one of each kind per booking (the database keeps them unique), so running
 * this again for the same booking never adds a second copy. A cancelled booking gets none.
 */
export function bookingTasks(b: {
  check_in: string;
  check_out: string;
  status: string;
  guest_name?: string;
}): AutoTask[] {
  if (b.status === "cancelled" || !isDay(b.check_in) || !isDay(b.check_out)) return [];
  const who = b.guest_name?.trim() ? ` ${b.guest_name.trim()}` : " the guest";
  return [
    {
      kind: "check_in",
      due_at: dubaiAt(b.check_in, CHECK_IN_TIME),
      note: `Welcome${who} and hand over access.`,
    },
    {
      kind: "cleaning",
      due_at: dubaiAt(b.check_out, CHECK_OUT_TIME),
      note: `Clean after${who} checks out.`,
    },
  ];
}

// ---------- today ----------

export type TodayBooking = { home_id: string; check_in: string; check_out: string; status: string };
export type TodayTask = {
  booking_id: string | null;
  due_at: string;
  status: string;
};

/**
 * What needs doing today: arrivals, departures, tasks due today and tasks still open from earlier.
 * Tasks of a cancelled booking are left out.
 */
export function todayBoard<B extends TodayBooking & { id: string }, T extends TodayTask>(
  bookings: B[],
  tasks: T[],
  today: string,
) {
  const live = bookings.filter((b) => b.status !== "cancelled");
  const cancelled = new Set(bookings.filter((b) => b.status === "cancelled").map((b) => b.id));
  const open = tasks.filter((t) => !(t.booking_id && cancelled.has(t.booking_id)));
  const byDue = (a: T, b: T) => a.due_at.localeCompare(b.due_at);
  return {
    arrivals: live.filter((b) => b.check_in === today),
    departures: live.filter((b) => b.check_out === today),
    staying: live.filter((b) => b.check_in < today && b.check_out > today),
    tasksToday: open.filter((t) => dubaiDay(t.due_at) === today).sort(byDue),
    overdue: open
      .filter((t) => t.status === "todo" && dubaiDay(t.due_at) < today && dubaiDay(t.due_at) !== "")
      .sort(byDue),
  };
}

/**
 * A check-in message for an arriving guest, in English, built only from what is stored on the home.
 * It is a draft the operator copies and sends themselves; the CRM sends nothing.
 */
export function checkInMessage(a: {
  guestName: string;
  homeName: string;
  building: string;
  community: string;
  checkIn: string;
  checkOut: string;
  instructions: string;
  wifi: string;
  agencyName: string;
}): string {
  const first = a.guestName.trim().split(/\s+/)[0] ?? "";
  const hello = first && !/guest$/i.test(a.guestName.trim()) ? `Hello ${first},` : "Hello,";
  const where = [a.building, a.community].map((s) => s.trim()).filter(Boolean);
  const lines = [
    hello,
    "",
    `Welcome to ${a.homeName.trim() || "your holiday home"}${where.length ? ` (${where.join(", ")})` : ""}.`,
    `Your stay is from ${formatDay(a.checkIn)} to ${formatDay(a.checkOut)}. Check-in is from ${CHECK_IN_TIME} and check-out is by ${CHECK_OUT_TIME}.`,
  ];
  if (a.instructions.trim()) lines.push("", "How to get in:", a.instructions.trim());
  if (a.wifi.trim()) lines.push("", `Wi-Fi: ${a.wifi.trim()}`);
  lines.push(
    "",
    "If you have not sent a copy of your passport or Emirates ID yet, please send it before you arrive.",
    "Message us here if you need anything.",
    "",
    a.agencyName.trim() || "Your host",
  );
  return lines.join("\n");
}

// ---------- permit ----------

export type PermitState = {
  tone: "ok" | "soon" | "late" | "missing";
  label: string;
};

/** Warns when the holiday-home permit is missing, has ended, or ends within 30 days. */
export function permitState(
  home: { permit_number: string; permit_expires_on: string | null },
  today: string,
): PermitState {
  if (!home.permit_number.trim()) return { tone: "missing", label: "No permit number recorded" };
  if (!home.permit_expires_on) return { tone: "missing", label: "No permit expiry date recorded" };
  const left = daysBetween(today, home.permit_expires_on);
  if (left < 0)
    return { tone: "late", label: `Permit ended on ${formatDay(home.permit_expires_on)}` };
  if (left === 0) return { tone: "late", label: "Permit ends today" };
  if (left <= PERMIT_WARNING_DAYS)
    return { tone: "soon", label: `Permit ends in ${left} day${left === 1 ? "" : "s"}` };
  return { tone: "ok", label: `Permit valid to ${formatDay(home.permit_expires_on)}` };
}

// ---------- occupancy ----------

/** Nights of a stay that fall inside the half-open period [from, until). */
export function nightsInside(
  b: { check_in: string; check_out: string },
  from: string,
  until: string,
): number {
  const start = b.check_in > from ? b.check_in : from;
  const end = b.check_out < until ? b.check_out : until;
  return end > start ? daysBetween(start, end) : 0;
}

export type Occupancy = { bookedNights: number; nightsInMonth: number; percent: number };

/**
 * Booked nights inside the month divided by the nights in the month, for one home's bookings. A stay
 * that crosses a month end counts only the nights inside this month; cancelled stays count nothing.
 */
export function occupancy(
  bookings: { check_in: string; check_out: string; status: string }[],
  month: Month,
): Occupancy {
  const nightsInMonth = month.days.length;
  const booked = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((n, b) => n + nightsInside(b, month.from, month.until), 0);
  // Overlapping rows cannot exist in the database, but never report more than a full month.
  const bookedNights = Math.min(booked, nightsInMonth);
  return {
    bookedNights,
    nightsInMonth,
    percent: nightsInMonth ? Math.round((bookedNights / nightsInMonth) * 1000) / 10 : 0,
  };
}

// ---------- owner payout ----------

export type PayoutBooking = {
  id: string;
  guest_name: string;
  source: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount_aed: number;
  channel_fee_aed: number;
  cleaning_fee_aed: number;
};
export type PayoutLine = {
  bookingId: string;
  guestName: string;
  source: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amount: number;
  channelFee: number;
  cleaning: number;
  managementFee: number;
  payout: number;
};
export type Payout = {
  feePercent: number;
  lines: PayoutLine[];
  totals: {
    amount: number;
    channelFee: number;
    cleaning: number;
    managementFee: number;
    payout: number;
  };
  occupancy: Occupancy;
};

/**
 * The owner's payout for one home and one month.
 *
 * A booking belongs to the month its check-out falls in, whole (a stay from 28 Nov to 3 Dec is paid
 * out in December). Cancelled bookings are left out. For each booking:
 *   payout = total booking amount − channel fee − cleaning cost − management fee
 * where the management fee is the home's percent of the amount left after the channel fee, and the
 * cleaning cost is the cleaning fee recorded on the booking. Amounts are worked in fils so the lines
 * always add up to the totals. Occupancy uses every non-cancelled stay with nights in the month.
 */
export function ownerPayout(a: {
  managementFeePercent: number;
  bookings: PayoutBooking[];
  month: Month;
}): Payout {
  const percent = Math.min(100, Math.max(0, Number(a.managementFeePercent) || 0));
  const lines = a.bookings
    .filter(
      (b) => b.status !== "cancelled" && b.check_out >= a.month.from && b.check_out < a.month.until,
    )
    .sort((x, y) => x.check_out.localeCompare(y.check_out) || x.check_in.localeCompare(y.check_in))
    .map((b) => {
      const amount = fils(Number(b.total_amount_aed) || 0);
      const channelFee = fils(Number(b.channel_fee_aed) || 0);
      const cleaning = fils(Number(b.cleaning_fee_aed) || 0);
      const managementFee = Math.round(((amount - channelFee) * percent) / 100);
      return {
        bookingId: b.id,
        guestName: b.guest_name,
        source: b.source,
        checkIn: b.check_in,
        checkOut: b.check_out,
        nights: nights(b),
        amount,
        channelFee,
        cleaning,
        managementFee,
        payout: amount - channelFee - cleaning - managementFee,
      };
    });
  const sum = (key: "amount" | "channelFee" | "cleaning" | "managementFee" | "payout") =>
    fromFils(lines.reduce((s, l) => s + l[key], 0));
  return {
    feePercent: percent,
    totals: {
      amount: sum("amount"),
      channelFee: sum("channelFee"),
      cleaning: sum("cleaning"),
      managementFee: sum("managementFee"),
      payout: sum("payout"),
    },
    lines: lines.map((l) => ({
      ...l,
      amount: fromFils(l.amount),
      channelFee: fromFils(l.channelFee),
      cleaning: fromFils(l.cleaning),
      managementFee: fromFils(l.managementFee),
      payout: fromFils(l.payout),
    })),
    occupancy: occupancy(a.bookings, a.month),
  };
}

// ---------- calendar grid ----------

export type DayCell<B> = {
  day: string;
  /** The stay sleeping in the home that night. */
  booking: B | null;
  /** True on the first night of that stay shown in this month. */
  starts: boolean;
  /** A guest checks out on this day (the night before was booked). */
  checkout: boolean;
};

/** One row of the month grid: for each day, who sleeps there that night. Cancelled stays are left out. */
export function calendarRow<B extends { check_in: string; check_out: string; status: string }>(
  bookings: B[],
  month: Month,
): DayCell<B>[] {
  const live = bookings.filter((b) => b.status !== "cancelled");
  return month.days.map((day, i) => {
    const booking = live.find((b) => b.check_in <= day && day < b.check_out) ?? null;
    return {
      day,
      booking,
      starts: !!booking && (booking.check_in === day || i === 0),
      checkout: live.some((b) => b.check_out === day),
    };
  });
}
