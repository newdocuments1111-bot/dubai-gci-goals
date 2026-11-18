import { describe, expect, it } from "vitest";
import {
  EXAMPLE_PLAN,
  addDays,
  bedroomsFromType,
  brokerSummary,
  buildSchedule,
  collectionTotals,
  commissionAed,
  dueSoonInstalments,
  effectiveStatus,
  holdExpiresAt,
  holdTimeLeft,
  instalmentOpenAed,
  isHoldActive,
  overdueInstalments,
  parseUnitLines,
  planProblems,
  planTotalPercent,
  priceListCsv,
  priceListFileName,
  readPlan,
  reminderMessage,
  unitCounts,
  type Milestone,
} from "./developer";

const m = (label: string, percent: number, extra: Partial<Milestone> = {}): Milestone => ({
  label,
  percent,
  rule: "days_after_booking",
  days: 0,
  date: "",
  ...extra,
});
const sum = (list: { amount_aed: number }[]) =>
  list.reduce((a, b) => a + Math.round(b.amount_aed * 100), 0) / 100;

describe("payment plan", () => {
  it("accepts a plan that totals 100", () => {
    expect(planProblems(EXAMPLE_PLAN)).toEqual([]);
    expect(planTotalPercent(EXAMPLE_PLAN)).toBe(100);
    expect(planProblems([m("A", 33.33), m("B", 33.33), m("C", 33.34)])).toEqual([]);
  });

  it("refuses a plan that does not total 100, or has gaps", () => {
    expect(planProblems([])).toEqual(["Add at least one payment."]);
    expect(planProblems([m("A", 60), m("B", 30)])[0]).toContain("90%");
    expect(planProblems([m("A", 60), m("B", 50)])[0]).toContain("110%");
    expect(planProblems([m("", 100)])).toContain("Payment 1 needs a name.");
    expect(planProblems([m("A", 100), m("B", 0)])).toContain("Payment 2 needs a percent above 0.");
    expect(planProblems([m("A", 100, { rule: "fixed_date" })])).toContain(
      "Payment 1 needs a date.",
    );
  });

  it("reads a stored plan and ignores anything else", () => {
    expect(readPlan(EXAMPLE_PLAN)).toEqual(EXAMPLE_PLAN);
    expect(readPlan(null)).toEqual([]);
    expect(readPlan([{ label: "x" }])).toEqual([]);
  });
});

describe("schedule", () => {
  const sale = { priceAed: 1_000_000, saleDate: "2026-11-18", handoverDate: "2028-03-31" };

  it("makes one instalment per payment with the right dates", () => {
    const lines = buildSchedule(
      [
        m("Booking", 20),
        m("After 90 days", 30, { days: 90 }),
        m("Fixed", 10, { rule: "fixed_date", date: "2027-06-30" }),
        m("Handover", 40, { rule: "on_handover" }),
      ],
      sale,
    );
    expect(lines).toEqual([
      { position: 1, label: "Booking", amount_aed: 200_000, due_date: "2026-11-18" },
      { position: 2, label: "After 90 days", amount_aed: 300_000, due_date: "2027-02-16" },
      { position: 3, label: "Fixed", amount_aed: 100_000, due_date: "2027-06-30" },
      { position: 4, label: "Handover", amount_aed: 400_000, due_date: "2028-03-31" },
    ]);
  });

  it("leaves the handover date empty when the project has none", () => {
    const lines = buildSchedule([m("Handover", 100, { rule: "on_handover" })], {
      ...sale,
      handoverDate: null,
    });
    expect(lines[0]!.due_date).toBeNull();
  });

  it("rounds so the amounts add up to the price exactly", () => {
    const thirds = buildSchedule([m("A", 33.33), m("B", 33.33), m("C", 33.34)], {
      ...sale,
      priceAed: 1_234_567.89,
    });
    expect(sum(thirds)).toBe(1_234_567.89);
    for (const line of thirds)
      expect(Math.round(line.amount_aed * 100) / 100).toBe(line.amount_aed);

    const awkward = buildSchedule([m("A", 12.5), m("B", 12.5), m("C", 37.5), m("D", 37.5)], {
      ...sale,
      priceAed: 999_999.99,
    });
    expect(sum(awkward)).toBe(999_999.99);
    expect(awkward.every((l) => l.amount_aed > 0)).toBe(true);
  });

  it("adds up for many prices and never goes negative", () => {
    const plan = [m("A", 0.01), m("B", 9.99), m("C", 45), m("D", 45)];
    for (const price of [0.01, 0.05, 1, 100.01, 777_777.77, 2_500_000, 13_333_333.33]) {
      const lines = buildSchedule(plan, { ...sale, priceAed: price });
      expect(sum(lines)).toBe(price);
      expect(lines.every((l) => l.amount_aed >= 0)).toBe(true);
    }
  });

  it("gives the spare fils to the payments rounded down the most", () => {
    // 100.01 in three equal-ish parts: 33.33 (rest .003333), 33.33, 33.34 share → one fil spare.
    const lines = buildSchedule([m("A", 33.33), m("B", 33.33), m("C", 33.34)], {
      ...sale,
      priceAed: 100,
    });
    expect(lines.map((l) => l.amount_aed)).toEqual([33.33, 33.33, 33.34]);
  });

  it("refuses a plan that is not valid or a price of zero", () => {
    expect(() => buildSchedule([m("A", 50)], sale)).toThrow(/100%/);
    expect(() => buildSchedule(EXAMPLE_PLAN, { ...sale, priceAed: 0 })).toThrow(/price/);
  });

  it("adds days across months and leap years", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 30)).toBe("2027-01-30");
  });
});

describe("due and overdue", () => {
  const today = "2026-11-18";
  const rows = [
    { id: "paid", amount_aed: 100_000, due_date: "2026-10-01", paid_amount: 100_000 },
    { id: "late", amount_aed: 50_000, due_date: "2026-11-17", paid_amount: null },
    { id: "part", amount_aed: 80_000, due_date: "2026-09-01", paid_amount: 30_000 },
    { id: "today", amount_aed: 10_000, due_date: "2026-11-18", paid_amount: null },
    { id: "day30", amount_aed: 20_000, due_date: "2026-12-18", paid_amount: 0 },
    { id: "day31", amount_aed: 40_000, due_date: "2026-12-19", paid_amount: null },
    { id: "handover", amount_aed: 500_000, due_date: null, paid_amount: null },
  ];

  it("lists what is overdue, oldest first, without paid or undated rows", () => {
    expect(overdueInstalments(rows, today).map((r) => r.id)).toEqual(["part", "late"]);
  });

  it("lists what is due in the next 30 days, today and day 30 included", () => {
    expect(dueSoonInstalments(rows, today).map((r) => r.id)).toEqual(["today", "day30"]);
    expect(dueSoonInstalments(rows, today, 31).map((r) => r.id)).toContain("day31");
  });

  it("works out what is still open on a part payment", () => {
    expect(instalmentOpenAed(rows[2]!)).toBe(50_000);
    expect(instalmentOpenAed({ amount_aed: 10, due_date: null, paid_amount: 12 })).toBe(0);
  });

  it("totals collected against outstanding", () => {
    expect(collectionTotals(rows, today)).toEqual({
      soldAed: 800_000,
      collectedAed: 130_000,
      outstandingAed: 670_000,
      overdueAed: 100_000,
      dueSoonAed: 30_000,
    });
    expect(collectionTotals([], today).outstandingAed).toBe(0);
  });
});

describe("holds", () => {
  const now = new Date("2026-11-18T08:00:00Z");
  const live = { expires_at: "2026-11-19T08:00:00Z", released_at: null };
  const ended = { expires_at: "2026-11-18T07:59:59Z", released_at: null };
  const released = { expires_at: "2026-11-19T08:00:00Z", released_at: "2026-11-18T07:00:00Z" };

  it("ends 48 hours later by default", () => {
    expect(holdExpiresAt(now).toISOString()).toBe("2026-11-20T08:00:00.000Z");
    expect(holdExpiresAt(now, 6).toISOString()).toBe("2026-11-18T14:00:00.000Z");
  });

  it("is active only before its end time and while not released", () => {
    expect(isHoldActive(live, now)).toBe(true);
    expect(isHoldActive(ended, now)).toBe(false);
    expect(isHoldActive({ expires_at: now.toISOString(), released_at: null }, now)).toBe(false);
    expect(isHoldActive(released, now)).toBe(false);
    expect(isHoldActive(null, now)).toBe(false);
  });

  it("never shows an expired hold as held, whatever is stored", () => {
    expect(effectiveStatus("held", ended, now)).toBe("free");
    expect(effectiveStatus("held", released, now)).toBe("free");
    expect(effectiveStatus("held", null, now)).toBe("free");
    expect(effectiveStatus("held", live, now)).toBe("held");
    expect(effectiveStatus("free", live, now)).toBe("held");
    expect(effectiveStatus("free", null, now)).toBe("free");
    expect(effectiveStatus("sold", live, now)).toBe("sold");
    expect(effectiveStatus("sold", null, now)).toBe("sold");
  });

  it("says how long is left", () => {
    expect(holdTimeLeft("2026-11-18T08:20:00Z", now)).toBe("Ends in 20 min");
    expect(holdTimeLeft("2026-11-18T13:30:00Z", now)).toBe("Ends in 5 h");
    expect(holdTimeLeft("2026-11-20T11:00:00Z", now)).toBe("Ends in 2 d 3 h");
    expect(holdTimeLeft("2026-11-18T07:00:00Z", now)).toBe("Ended");
  });

  it("counts units by status", () => {
    expect(unitCounts(["free", "held", "free", "sold"])).toEqual({ free: 2, held: 1, sold: 1 });
  });
});

describe("outside brokers", () => {
  const now = new Date("2026-11-18T08:00:00Z");
  const sales = [
    {
      broker_name: "Omar Khan",
      broker_agency: "Blue Key",
      sale_price_aed: 1_000_000,
      broker_commission_percent: 5,
    },
    {
      broker_name: "  omar  khan ",
      broker_agency: "",
      sale_price_aed: 1_500_000,
      broker_commission_percent: 4,
    },
    {
      broker_name: "Sara Ali",
      broker_agency: "",
      sale_price_aed: 2_000_000,
      broker_commission_percent: 2.5,
    },
    { broker_name: "", broker_agency: "", sale_price_aed: 900_000, broker_commission_percent: 0 },
  ];
  const holds = [
    {
      broker_name: "Sara Ali",
      broker_agency: "Palm Homes",
      expires_at: "2026-11-19T08:00:00Z",
      released_at: null,
    },
    {
      broker_name: "Sara Ali",
      broker_agency: "",
      expires_at: "2026-11-17T08:00:00Z",
      released_at: null,
    },
    {
      broker_name: "New Broker",
      broker_agency: "",
      expires_at: "2026-11-19T08:00:00Z",
      released_at: null,
    },
  ];

  it("works out one sale's commission to the fil", () => {
    expect(commissionAed(1_000_000, 5)).toBe(50_000);
    expect(commissionAed(1_234_567.89, 2.5)).toBe(30_864.2);
    expect(commissionAed(1_000_000, 0)).toBe(0);
  });

  it("totals units and commission per broker name, direct sales left out", () => {
    expect(brokerSummary(sales, holds, now)).toEqual([
      {
        name: "Omar Khan",
        agency: "Blue Key",
        unitsSold: 2,
        salesAed: 2_500_000,
        commissionAed: 110_000,
        activeHolds: 0,
      },
      {
        name: "Sara Ali",
        agency: "Palm Homes",
        unitsSold: 1,
        salesAed: 2_000_000,
        commissionAed: 50_000,
        activeHolds: 1,
      },
      {
        name: "New Broker",
        agency: "",
        unitsSold: 0,
        salesAed: 0,
        commissionAed: 0,
        activeHolds: 1,
      },
    ]);
  });
});

describe("pasted units", () => {
  it("reads lines with commas or tabs and skips a heading row", () => {
    const { units, problems } = parseUnitLines(
      'Unit,Type,Bedrooms,Size,Floor,View,Price\n101,1BR,1,750,1,Pool,"950000"\n102\t2BR\t\t1,100\t1\tSea view\tAED 1,450,000',
    );
    expect(problems).toEqual([]);
    expect(units).toEqual([
      {
        unit_number: "101",
        unit_type: "1BR",
        bedrooms: 1,
        size_sqft: 750,
        floor: "1",
        view: "Pool",
        price_aed: 950_000,
      },
      {
        unit_number: "102",
        unit_type: "2BR",
        bedrooms: 2,
        size_sqft: 1100,
        floor: "1",
        view: "Sea view",
        price_aed: 1_450_000,
      },
    ]);
  });

  it("reports short lines, bad prices and repeats instead of guessing", () => {
    const { units, problems } = parseUnitLines(
      "201,Studio,0,400,2,City,600000\n202,1BR\n203,1BR,1,700,2,City,abc\n201,Studio,0,400,2,City,600000",
    );
    expect(units.map((u) => u.unit_number)).toEqual(["201"]);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain("Line 2");
    expect(problems[2]).toContain("appears twice");
  });

  it("guesses bedrooms from the type only when they are left out", () => {
    expect(bedroomsFromType("Studio")).toBe(0);
    expect(bedroomsFromType("3BR")).toBe(3);
    expect(bedroomsFromType("2 bed")).toBe(2);
  });
});

describe("wording and price list", () => {
  it("drafts a reminder for a coming and a late payment", () => {
    const base = {
      buyerName: "Aisha Rahman",
      projectName: "Creek Gardens",
      unitNumber: "1204",
      label: "Second payment",
      openAed: 300_000,
      today: "2026-11-18",
      developerName: "Creek Developments",
    };
    const coming = reminderMessage({ ...base, dueDate: "2026-12-01" });
    expect(coming).toContain("Hello Aisha,");
    expect(coming).toContain("AED 300,000");
    expect(coming).toContain("is due on 1 Dec 2026");
    expect(coming.endsWith("Creek Developments")).toBe(true);
    expect(reminderMessage({ ...base, dueDate: "2026-11-01" })).toContain(
      "was due on 1 Nov 2026 and is still open",
    );
    expect(reminderMessage({ ...base, dueDate: null })).toContain("is due on handover");
  });

  it("writes the price list with the formula guard", () => {
    const csv = priceListCsv([
      {
        unit_number: "=HYPERLINK(1)",
        unit_type: "1BR",
        bedrooms: 1,
        size_sqft: 750,
        floor: "-1",
        view: "Pool, garden",
        price_aed: 950_000,
      },
    ]);
    const lines = csv.split("\r\n");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]!.slice(1)).toBe("Unit,Type,Bedrooms,Size (sq ft),Floor,View,Price (AED)");
    expect(lines[1]).toBe(`'=HYPERLINK(1),1BR,1,750,-1,"Pool, garden",950000`);
    expect(priceListFileName("Creek Gardens — Tower 2", "2026-11-18")).toBe(
      "creek-gardens-tower-2-price-list-2026-11-18.csv",
    );
  });
});
