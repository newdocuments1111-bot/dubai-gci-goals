import { describe, expect, it } from "vitest";
import {
  bookingTasks,
  calendarRow,
  checkInMessage,
  dubaiDay,
  dubaiTime,
  dubaiToday,
  findConflicts,
  importedGuestName,
  isDay,
  monthOf,
  nightsInside,
  occupancy,
  ownerPayout,
  parseIcs,
  permitState,
  planImport,
  shiftMonth,
  staysOverlap,
  todayBoard,
  unfoldIcs,
  type PayoutBooking,
} from "./hh";

const month = (m: string) => {
  const found = monthOf(m);
  if (!found) throw new Error("bad month");
  return found;
};

describe("dates", () => {
  it("accepts only real days", () => {
    expect(isDay("2026-11-18")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("18/11/2026")).toBe(false);
  });

  it("uses the Dubai day, four hours ahead of UTC", () => {
    expect(dubaiToday(new Date("2026-11-18T19:59:00Z"))).toBe("2026-11-18");
    expect(dubaiToday(new Date("2026-11-18T20:00:00Z"))).toBe("2026-11-19");
    expect(dubaiDay("2026-11-20T15:00:00+04:00")).toBe("2026-11-20");
    expect(dubaiDay("2026-11-20T21:30:00Z")).toBe("2026-11-21");
    expect(dubaiTime("2026-11-20T11:00:00Z")).toBe("15:00");
    expect(dubaiDay("nonsense")).toBe("");
  });

  it("describes a month and moves between months", () => {
    const feb = month("2028-02");
    expect(feb.from).toBe("2028-02-01");
    expect(feb.to).toBe("2028-02-29");
    expect(feb.until).toBe("2028-03-01");
    expect(feb.days).toHaveLength(29);
    expect(month("2026-12").until).toBe("2027-01-01");
    expect(monthOf("2026-13")).toBeNull();
    expect(monthOf("nov")).toBeNull();
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("double bookings", () => {
  const stay = (check_in: string, check_out: string) => ({ check_in, check_out });
  const booked = [
    {
      id: "a",
      home_id: "h1",
      check_in: "2026-11-10",
      check_out: "2026-11-15",
      status: "confirmed",
    },
    {
      id: "b",
      home_id: "h1",
      check_in: "2026-11-20",
      check_out: "2026-11-22",
      status: "cancelled",
    },
    {
      id: "c",
      home_id: "h2",
      check_in: "2026-11-10",
      check_out: "2026-11-15",
      status: "confirmed",
    },
  ];
  const wanted = (check_in: string, check_out: string, extra: object = {}) => ({
    home_id: "h1",
    check_in,
    check_out,
    status: "confirmed",
    ...extra,
  });

  it("allows a check-in on the day another guest checks out", () => {
    expect(staysOverlap(stay("2026-11-10", "2026-11-15"), stay("2026-11-15", "2026-11-18"))).toBe(
      false,
    );
    expect(staysOverlap(stay("2026-11-15", "2026-11-18"), stay("2026-11-10", "2026-11-15"))).toBe(
      false,
    );
    expect(findConflicts(wanted("2026-11-15", "2026-11-18"), booked)).toEqual([]);
    expect(findConflicts(wanted("2026-11-07", "2026-11-10"), booked)).toEqual([]);
  });

  it("finds stays that share a night", () => {
    expect(staysOverlap(stay("2026-11-10", "2026-11-15"), stay("2026-11-14", "2026-11-16"))).toBe(
      true,
    );
    expect(findConflicts(wanted("2026-11-14", "2026-11-16"), booked).map((b) => b.id)).toEqual([
      "a",
    ]);
    // A stay that sits entirely inside, or entirely around, another one.
    expect(findConflicts(wanted("2026-11-11", "2026-11-12"), booked)).toHaveLength(1);
    expect(findConflicts(wanted("2026-11-01", "2026-11-30"), booked)).toHaveLength(1);
  });

  it("ignores cancelled stays, other homes and the booking being edited", () => {
    expect(findConflicts(wanted("2026-11-20", "2026-11-22"), booked)).toEqual([]);
    expect(findConflicts(wanted("2026-11-11", "2026-11-12", { home_id: "h3" }), booked)).toEqual(
      [],
    );
    expect(findConflicts(wanted("2026-11-11", "2026-11-16", { id: "a" }), booked)).toEqual([]);
    expect(
      findConflicts(wanted("2026-11-11", "2026-11-12", { status: "cancelled" }), booked),
    ).toEqual([]);
  });
});

/** Shaped like a real Airbnb export: CRLF lines, folded description, a reservation and two blocks. */
const AIRBNB = [
  "BEGIN:VCALENDAR",
  "PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20261124",
  "DTSTART;VALUE=DATE:20261120",
  "UID:1418fb94e984-3f5c2a7d9b1e4c6f8a0b2d4e6f8a0b2c@airbnb.com",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de",
  " tails/HMABCD1234\\nPhone Number (Last 4 Digits): 4421",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20261203",
  "DTSTART;VALUE=DATE:20261128",
  "UID:7f8e9d0c1b2a-99887766554433221100ffeeddccbbaa@airbnb.com",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20261210",
  "DTSTART;VALUE=DATE:20261205",
  "UID:6fec1092d3fa-b2c5f1a8e7d64c3b9a8f7e6d5c4b3a29@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

const BOOKING_COM = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Booking.com//Calendar//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261212
DTEND;VALUE=DATE:20261216
UID:a1b2c3d4e5f60718293a4b5c6d7e8f90@booking.com
SUMMARY:CLOSED - Not available
END:VEVENT
END:VCALENDAR`;

describe("calendar file import", () => {
  it("joins folded lines", () => {
    expect(unfoldIcs("SUMMARY:Sara\r\n  Khan\r\nUID:1\r\n\tx")).toEqual([
      "SUMMARY:Sara Khan",
      "UID:1x",
    ]);
  });

  it("reads an Airbnb calendar: reservations become stays, blocks are counted apart", () => {
    const r = parseIcs(AIRBNB);
    expect(r.bookings).toEqual([
      {
        uid: "1418fb94e984-3f5c2a7d9b1e4c6f8a0b2d4e6f8a0b2c@airbnb.com",
        check_in: "2026-11-20",
        check_out: "2026-11-24",
        summary: "Reserved",
      },
      {
        uid: "7f8e9d0c1b2a-99887766554433221100ffeeddccbbaa@airbnb.com",
        check_in: "2026-11-28",
        check_out: "2026-12-03",
        summary: "Reserved",
      },
    ]);
    expect(r.blocked).toHaveLength(1);
    expect(r.blocked[0]?.summary).toBe("Airbnb (Not available)");
    expect(r.invalid).toBe(0);
    expect(r.duplicates).toBe(0);
  });

  it("reads a file that starts with a byte-order mark", () => {
    expect(parseIcs(String.fromCharCode(0xfeff) + AIRBNB).bookings).toHaveLength(2);
  });

  it("treats a Booking.com 'CLOSED - Not available' entry as a block", () => {
    const r = parseIcs(BOOKING_COM);
    expect(r.bookings).toEqual([]);
    expect(r.blocked).toEqual([
      {
        uid: "a1b2c3d4e5f60718293a4b5c6d7e8f90@booking.com",
        check_in: "2026-12-12",
        check_out: "2026-12-16",
        summary: "CLOSED - Not available",
      },
    ]);
  });

  it("handles folded values, timed events, escapes, alarms and a missing end", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:long-",
      " uid-1",
      "DTSTART;TZID=Asia/Dubai:20261101T150000",
      "DTEND:20261104T070000Z",
      "SUMMARY:Sara Khan\\, 2 guests",
      "BEGIN:VALARM",
      "SUMMARY:Reminder",
      "END:VALARM",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:one-night",
      "DTSTART;VALUE=DATE:20261107",
      "summary:Omar",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const r = parseIcs(text);
    expect(r.bookings).toEqual([
      {
        uid: "long-uid-1",
        check_in: "2026-11-01",
        check_out: "2026-11-04",
        summary: "Sara Khan, 2 guests",
      },
      { uid: "one-night", check_in: "2026-11-07", check_out: "2026-11-08", summary: "Omar" },
    ]);
  });

  it("counts events it cannot use instead of guessing", () => {
    const event = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\n");
    const r = parseIcs(
      [
        event(["DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261103", "SUMMARY:No uid"]),
        event(["UID:x1", "DTEND;VALUE=DATE:20261103", "SUMMARY:No start"]),
        event(["UID:x2", "DTSTART;VALUE=DATE:20261105", "DTEND;VALUE=DATE:20261105"]),
        event(["UID:x3", "DTSTART;VALUE=DATE:20261340", "DTEND;VALUE=DATE:20261342"]),
        event(["UID:ok", "DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261112"]),
        event(["UID:ok", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261122"]),
      ].join("\n"),
    );
    expect(r.invalid).toBe(4);
    expect(r.duplicates).toBe(1);
    expect(r.bookings).toEqual([
      { uid: "ok", check_in: "2026-11-10", check_out: "2026-11-12", summary: "" },
    ]);
    expect(parseIcs("this is not a calendar")).toEqual({
      bookings: [],
      blocked: [],
      invalid: 0,
      duplicates: 0,
    });
  });

  it("names an imported guest only when the file gives a name", () => {
    expect(importedGuestName("Reserved", "airbnb")).toBe("Airbnb guest");
    expect(importedGuestName("", "booking")).toBe("Booking.com guest");
    expect(importedGuestName("Reserved - Sara Khan", "airbnb")).toBe("Sara Khan");
    expect(importedGuestName("Omar Haddad", "direct")).toBe("Omar Haddad");
  });

  it("re-importing the same file changes nothing, and a moved date updates the same booking", () => {
    const events = parseIcs(AIRBNB).bookings;
    const first = planImport(events, []);
    expect(first.create).toHaveLength(2);
    expect(first.update).toEqual([]);

    const stored = first.create.map((e, i) => ({
      id: `b${i + 1}`,
      external_uid: e.uid,
      check_in: e.check_in,
      check_out: e.check_out,
    }));
    expect(planImport(events, stored)).toEqual({ create: [], update: [], unchanged: 2 });

    const moved = parseIcs(
      AIRBNB.replace("DTEND;VALUE=DATE:20261124", "DTEND;VALUE=DATE:20261125"),
    );
    const again = planImport(moved.bookings, [
      ...stored,
      { id: "manual", external_uid: null, check_in: "2026-10-01", check_out: "2026-10-03" },
    ]);
    expect(again.create).toEqual([]);
    expect(again.unchanged).toBe(1);
    expect(again.update).toEqual([{ id: "b1", event: { ...events[0], check_out: "2026-11-25" } }]);
  });
});

describe("automatic tasks", () => {
  it("creates a check-in task on arrival and a cleaning task on departure", () => {
    expect(
      bookingTasks({
        check_in: "2026-11-20",
        check_out: "2026-11-24",
        status: "confirmed",
        guest_name: "Sara Khan",
      }),
    ).toEqual([
      {
        kind: "check_in",
        due_at: "2026-11-20T15:00:00+04:00",
        note: "Welcome Sara Khan and hand over access.",
      },
      {
        kind: "cleaning",
        due_at: "2026-11-24T11:00:00+04:00",
        note: "Clean after Sara Khan checks out.",
      },
    ]);
  });

  it("gives one task of each kind however often it is asked, and none for a cancelled stay", () => {
    const b = { check_in: "2026-11-20", check_out: "2026-11-24", status: "checked_in" };
    expect(bookingTasks(b)).toEqual(bookingTasks(b));
    expect(bookingTasks(b).map((t) => t.kind)).toEqual(["check_in", "cleaning"]);
    expect(new Set(bookingTasks(b).map((t) => t.kind)).size).toBe(2);
    expect(bookingTasks({ ...b, status: "cancelled" })).toEqual([]);
    expect(bookingTasks({ ...b, check_in: "soon" })).toEqual([]);
  });

  it("puts the task on the right Dubai day", () => {
    const [checkIn, cleaning] = bookingTasks({
      check_in: "2026-12-31",
      check_out: "2027-01-01",
      status: "confirmed",
    });
    expect(dubaiDay(checkIn!.due_at)).toBe("2026-12-31");
    expect(dubaiDay(cleaning!.due_at)).toBe("2027-01-01");
  });
});

describe("today", () => {
  const bookings = [
    {
      id: "in",
      home_id: "h1",
      check_in: "2026-11-18",
      check_out: "2026-11-21",
      status: "confirmed",
    },
    {
      id: "out",
      home_id: "h2",
      check_in: "2026-11-14",
      check_out: "2026-11-18",
      status: "checked_in",
    },
    {
      id: "stay",
      home_id: "h3",
      check_in: "2026-11-16",
      check_out: "2026-11-20",
      status: "checked_in",
    },
    {
      id: "gone",
      home_id: "h4",
      check_in: "2026-11-18",
      check_out: "2026-11-19",
      status: "cancelled",
    },
  ];
  const tasks = [
    { id: "t1", booking_id: "in", due_at: "2026-11-18T15:00:00+04:00", status: "todo" },
    { id: "t2", booking_id: "out", due_at: "2026-11-18T11:00:00+04:00", status: "done" },
    { id: "t3", booking_id: "gone", due_at: "2026-11-18T15:00:00+04:00", status: "todo" },
    { id: "t4", booking_id: null, due_at: "2026-11-16T09:00:00+04:00", status: "todo" },
    { id: "t5", booking_id: null, due_at: "2026-11-16T09:00:00+04:00", status: "done" },
    { id: "t6", booking_id: null, due_at: "2026-11-19T09:00:00+04:00", status: "todo" },
  ];

  it("lists arrivals, departures, tasks due today and older open tasks", () => {
    const board = todayBoard(bookings, tasks, "2026-11-18");
    expect(board.arrivals.map((b) => b.id)).toEqual(["in"]);
    expect(board.departures.map((b) => b.id)).toEqual(["out"]);
    expect(board.staying.map((b) => b.id)).toEqual(["stay"]);
    expect(board.tasksToday.map((t) => t.id)).toEqual(["t2", "t1"]);
    expect(board.overdue.map((t) => t.id)).toEqual(["t4"]);
  });

  it("drafts a check-in message from the home's own details", () => {
    const text = checkInMessage({
      guestName: "Sara Khan",
      homeName: "Marina View 1BR",
      building: "Marina Gate 1",
      community: "Dubai Marina",
      checkIn: "2026-11-18",
      checkOut: "2026-11-21",
      instructions: "Key box by door 1204, code 4821.",
      wifi: "MarinaView / sunny2026",
      agencyName: "Blue Door Stays",
    });
    expect(text).toContain("Hello Sara,");
    expect(text).toContain("Welcome to Marina View 1BR (Marina Gate 1, Dubai Marina).");
    expect(text).toContain("from 18 Nov 2026 to 21 Nov 2026");
    expect(text).toContain("How to get in:\nKey box by door 1204, code 4821.");
    expect(text).toContain("Wi-Fi: MarinaView / sunny2026");
    expect(text.endsWith("Blue Door Stays")).toBe(true);
  });

  it("leaves out what the home does not have and does not greet a placeholder name", () => {
    const text = checkInMessage({
      guestName: "Airbnb guest",
      homeName: "Palm Studio",
      building: "",
      community: "",
      checkIn: "2026-11-18",
      checkOut: "2026-11-19",
      instructions: " ",
      wifi: "",
      agencyName: "",
    });
    expect(text.startsWith("Hello,\n")).toBe(true);
    expect(text).toContain("Welcome to Palm Studio.");
    expect(text).not.toContain("How to get in");
    expect(text).not.toContain("Wi-Fi");
    expect(text.endsWith("Your host")).toBe(true);
  });
});

describe("permit warning", () => {
  const home = (permit_expires_on: string | null, permit_number = "DTCM-12345") => ({
    permit_number,
    permit_expires_on,
  });
  it("warns inside 30 days and after the end", () => {
    expect(permitState(home("2026-12-19"), "2026-11-18").tone).toBe("ok");
    expect(permitState(home("2026-12-18"), "2026-11-18")).toEqual({
      tone: "soon",
      label: "Permit ends in 30 days",
    });
    expect(permitState(home("2026-11-19"), "2026-11-18").label).toBe("Permit ends in 1 day");
    expect(permitState(home("2026-11-18"), "2026-11-18").tone).toBe("late");
    expect(permitState(home("2026-11-01"), "2026-11-18")).toEqual({
      tone: "late",
      label: "Permit ended on 1 Nov 2026",
    });
  });
  it("says when the permit details are missing", () => {
    expect(permitState(home("2027-01-01", " "), "2026-11-18").tone).toBe("missing");
    expect(permitState(home(null), "2026-11-18").tone).toBe("missing");
  });
});

describe("occupancy", () => {
  const nov = month("2026-11");
  const stay = (check_in: string, check_out: string, status = "confirmed") => ({
    check_in,
    check_out,
    status,
  });

  it("counts only the nights inside the month", () => {
    expect(nightsInside(stay("2026-10-29", "2026-11-03"), nov.from, nov.until)).toBe(2);
    expect(nightsInside(stay("2026-11-28", "2026-12-03"), nov.from, nov.until)).toBe(3);
    expect(nightsInside(stay("2026-10-20", "2026-12-10"), nov.from, nov.until)).toBe(30);
    expect(nightsInside(stay("2026-10-20", "2026-11-01"), nov.from, nov.until)).toBe(0);
    expect(nightsInside(stay("2026-12-01", "2026-12-05"), nov.from, nov.until)).toBe(0);
  });

  it("divides booked nights by the nights in the month", () => {
    const o = occupancy(
      [
        stay("2026-10-29", "2026-11-03"), // 2 nights in November
        stay("2026-11-10", "2026-11-15"), // 5
        stay("2026-11-28", "2026-12-03"), // 3
        stay("2026-11-18", "2026-11-20", "cancelled"), // 0
      ],
      nov,
    );
    expect(o).toEqual({ bookedNights: 10, nightsInMonth: 30, percent: 33.3 });
    expect(occupancy([], nov)).toEqual({ bookedNights: 0, nightsInMonth: 30, percent: 0 });
    expect(occupancy([stay("2026-10-01", "2027-01-01")], month("2026-12")).percent).toBe(100);
    expect(occupancy([stay("2028-02-01", "2028-02-15")], month("2028-02"))).toEqual({
      bookedNights: 14,
      nightsInMonth: 29,
      percent: 48.3,
    });
  });
});

describe("owner payout", () => {
  const booking = (over: Partial<PayoutBooking>): PayoutBooking => ({
    id: "b",
    guest_name: "Guest",
    source: "airbnb",
    check_in: "2026-11-10",
    check_out: "2026-11-15",
    status: "checked_out",
    total_amount_aed: 0,
    channel_fee_aed: 0,
    cleaning_fee_aed: 0,
    ...over,
  });

  it("takes channel fee, cleaning and the management fee off each booking", () => {
    const p = ownerPayout({
      managementFeePercent: 20,
      month: month("2026-11"),
      bookings: [
        booking({ id: "b1", total_amount_aed: 5000, channel_fee_aed: 750, cleaning_fee_aed: 300 }),
      ],
    });
    // 5,000 − 750 = 4,250; fee 20% of 4,250 = 850; payout 5,000 − 750 − 300 − 850 = 3,100.
    expect(p.lines).toEqual([
      {
        bookingId: "b1",
        guestName: "Guest",
        source: "airbnb",
        checkIn: "2026-11-10",
        checkOut: "2026-11-15",
        nights: 5,
        amount: 5000,
        channelFee: 750,
        cleaning: 300,
        managementFee: 850,
        payout: 3100,
      },
    ]);
    expect(p.totals).toEqual({
      amount: 5000,
      channelFee: 750,
      cleaning: 300,
      managementFee: 850,
      payout: 3100,
    });
    expect(p.feePercent).toBe(20);
  });

  it("puts a booking in the month of its check-out and leaves cancelled ones out", () => {
    const bookings = [
      booking({
        id: "oct-nov",
        check_in: "2026-10-29",
        check_out: "2026-11-01",
        total_amount_aed: 900,
      }),
      booking({ id: "nov", total_amount_aed: 2000 }),
      booking({
        id: "last-day",
        check_in: "2026-11-27",
        check_out: "2026-11-30",
        total_amount_aed: 1200,
      }),
      booking({
        id: "nov-dec",
        check_in: "2026-11-28",
        check_out: "2026-12-01",
        total_amount_aed: 1500,
      }),
      booking({
        id: "cancelled",
        check_in: "2026-11-20",
        check_out: "2026-11-22",
        status: "cancelled",
        total_amount_aed: 800,
      }),
    ];
    const nov = ownerPayout({ managementFeePercent: 0, month: month("2026-11"), bookings });
    expect(nov.lines.map((l) => l.bookingId)).toEqual(["oct-nov", "nov", "last-day"]);
    expect(nov.totals.amount).toBe(4100);
    expect(nov.totals.payout).toBe(4100);
    const dec = ownerPayout({ managementFeePercent: 0, month: month("2026-12"), bookings });
    expect(dec.lines.map((l) => l.bookingId)).toEqual(["nov-dec"]);
    // The stay that is paid out in December has no December nights: money and nights are separate.
    expect(dec.occupancy).toEqual({ bookedNights: 0, nightsInMonth: 31, percent: 0 });
  });

  it("reports occupancy for the month next to the money", () => {
    const p = ownerPayout({
      managementFeePercent: 15,
      month: month("2026-11"),
      bookings: [
        booking({
          id: "a",
          check_in: "2026-10-30",
          check_out: "2026-11-04",
          total_amount_aed: 1000,
        }),
        booking({
          id: "b",
          check_in: "2026-11-26",
          check_out: "2026-12-02",
          total_amount_aed: 3000,
        }),
      ],
    });
    // Money: only "a" checks out in November. Nights: 3 from "a" and 5 from "b".
    expect(p.lines.map((l) => l.bookingId)).toEqual(["a"]);
    expect(p.occupancy).toEqual({ bookedNights: 8, nightsInMonth: 30, percent: 26.7 });
  });

  it("keeps lines and totals adding up to the fils", () => {
    const bookings = [
      booking({
        id: "1",
        total_amount_aed: 1234.56,
        channel_fee_aed: 185.18,
        cleaning_fee_aed: 150,
      }),
      booking({
        id: "2",
        total_amount_aed: 999.99,
        channel_fee_aed: 33.33,
        cleaning_fee_aed: 120.5,
      }),
      booking({ id: "3", total_amount_aed: 0.1, channel_fee_aed: 0.03, cleaning_fee_aed: 0 }),
    ];
    const p = ownerPayout({ managementFeePercent: 17.5, month: month("2026-11"), bookings });
    const cents = (n: number) => Math.round(n * 100);
    for (const l of p.lines)
      expect(cents(l.payout)).toBe(
        cents(l.amount) - cents(l.channelFee) - cents(l.cleaning) - cents(l.managementFee),
      );
    expect(p.lines[0]?.managementFee).toBe(183.64); // 17.5% of 1,049.38 = 183.6415
    for (const key of ["amount", "channelFee", "cleaning", "managementFee", "payout"] as const)
      expect(cents(p.totals[key])).toBe(p.lines.reduce((s, l) => s + cents(l[key]), 0));
  });

  it("shows a negative payout rather than hiding it, and handles no bookings", () => {
    const p = ownerPayout({
      managementFeePercent: 20,
      month: month("2026-11"),
      bookings: [booking({ total_amount_aed: 200, channel_fee_aed: 30, cleaning_fee_aed: 250 })],
    });
    expect(p.totals.payout).toBe(-114);
    const none = ownerPayout({ managementFeePercent: 20, month: month("2026-11"), bookings: [] });
    expect(none.lines).toEqual([]);
    expect(none.totals.payout).toBe(0);
  });
});

describe("calendar grid", () => {
  it("shows who sleeps in the home each night and marks turnovers", () => {
    const row = calendarRow(
      [
        { id: "a", check_in: "2026-10-30", check_out: "2026-11-03", status: "confirmed" },
        { id: "b", check_in: "2026-11-03", check_out: "2026-11-05", status: "confirmed" },
        { id: "x", check_in: "2026-11-10", check_out: "2026-11-12", status: "cancelled" },
      ],
      month("2026-11"),
    );
    expect(row).toHaveLength(30);
    expect(row.slice(0, 6).map((c) => c.booking?.id ?? "-")).toEqual([
      "a",
      "a",
      "b",
      "b",
      "-",
      "-",
    ]);
    expect(row[0]?.starts).toBe(true); // continues from October, labelled on the 1st
    expect(row[1]?.starts).toBe(false);
    expect(row[2]).toMatchObject({ day: "2026-11-03", starts: true, checkout: true });
    expect(row[4]).toMatchObject({ booking: null, checkout: true });
    expect(row[9]?.booking).toBeNull();
  });
});
