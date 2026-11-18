import { describe, expect, it } from "vitest";
import {
  addMonths,
  chequeBuckets,
  chequeDueLabel,
  chequeReminder,
  chequeSchedule,
  defaultLeaseEnd,
  dubaiToday,
  monthPeriod,
  nextCheque,
  ownerStatement,
  renewalReminder,
  renewals,
  sumAed,
  unitLabel,
} from "./pm";

describe("cheque schedule", () => {
  it("splits the rent into equal cheques three months apart", () => {
    expect(chequeSchedule(120_000, 4, "2026-01-15")).toEqual([
      { seq: 1, amount_aed: 30_000, due_date: "2026-01-15" },
      { seq: 2, amount_aed: 30_000, due_date: "2026-04-15" },
      { seq: 3, amount_aed: 30_000, due_date: "2026-07-15" },
      { seq: 4, amount_aed: 30_000, due_date: "2026-10-15" },
    ]);
  });

  it("always adds up to the rent exactly, with the odd fils on the first cheques", () => {
    const s = chequeSchedule(100_000, 3, "2026-02-01");
    expect(s.map((c) => c.amount_aed)).toEqual([33_333.34, 33_333.33, 33_333.33]);
    expect(sumAed(s.map((c) => c.amount_aed))).toBe(100_000);
    for (const rent of [85_000, 99_999.99, 123_456.78, 1, 70_001]) {
      for (let n = 1; n <= 12; n++) {
        const parts = chequeSchedule(rent, n, "2026-03-31");
        expect(parts).toHaveLength(n);
        expect(sumAed(parts.map((c) => c.amount_aed))).toBe(rent);
        const amounts = parts.map((c) => Math.round(c.amount_aed * 100));
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps every cheque inside the lease year and in date order", () => {
    for (let n = 1; n <= 12; n++) {
      const dates = chequeSchedule(60_000, n, "2026-05-10").map((c) => c.due_date);
      expect([...dates].sort()).toEqual(dates);
      expect(new Set(dates).size).toBe(n);
      expect(dates[0]).toBe("2026-05-10");
      expect(dates[n - 1]! <= "2027-05-09").toBe(true);
    }
  });

  it("moves the 31st to the end of shorter months", () => {
    expect(chequeSchedule(12_000, 12, "2026-01-31").map((c) => c.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("returns nothing for input that makes no sense", () => {
    expect(chequeSchedule(0, 4, "2026-01-01")).toEqual([]);
    expect(chequeSchedule(-5, 4, "2026-01-01")).toEqual([]);
    expect(chequeSchedule(100_000, 0, "2026-01-01")).toEqual([]);
    expect(chequeSchedule(100_000, 13, "2026-01-01")).toEqual([]);
    expect(chequeSchedule(100_000, 2.5, "2026-01-01")).toEqual([]);
    expect(chequeSchedule(100_000, 4, "not a date")).toEqual([]);
  });

  it("ends a one-year lease the day before the anniversary", () => {
    expect(defaultLeaseEnd("2026-03-01")).toBe("2027-02-28");
    expect(defaultLeaseEnd("2026-11-18")).toBe("2027-11-17");
  });
});

describe("cheque buckets", () => {
  const today = "2026-11-18";
  const c = (id: string, status: string, due_date: string) => ({ id, status, due_date });
  const cheques = [
    c("overdue", "pending", "2026-11-10"),
    c("today", "pending", "2026-11-18"),
    c("day7", "pending", "2026-11-25"),
    c("day8", "pending", "2026-11-26"),
    c("day30", "pending", "2026-12-18"),
    c("day31", "pending", "2026-12-19"),
    c("banked", "banked", "2026-11-01"),
    c("cleared", "cleared", "2026-11-17"),
    c("bounced-new", "bounced", "2026-11-15"),
    c("bounced-old", "bounced", "2026-08-15"),
  ];
  const b = chequeBuckets(cheques, today);

  it("puts pending cheques due within seven days, and overdue ones, in this week", () => {
    expect(b.thisWeek.map((x) => x.id)).toEqual(["overdue", "today", "day7"]);
  });

  it("puts pending cheques due in 8 to 30 days in the next 30 days", () => {
    expect(b.next30.map((x) => x.id)).toEqual(["day8", "day30"]);
  });

  it("lists every bounced cheque whatever its date, oldest first", () => {
    expect(b.bounced.map((x) => x.id)).toEqual(["bounced-old", "bounced-new"]);
  });

  it("keeps banked cheques apart and leaves cleared ones out", () => {
    expect(b.banked.map((x) => x.id)).toEqual(["banked"]);
    const all = [...b.thisWeek, ...b.next30, ...b.banked, ...b.bounced].map((x) => x.id);
    expect(all).not.toContain("cleared");
    expect(all).not.toContain("day31");
  });

  it("labels due dates and finds the next cheque to pay in", () => {
    expect(chequeDueLabel(cheques[0]!, today)).toEqual({ late: true, label: "Overdue 8 days" });
    expect(chequeDueLabel(cheques[1]!, today).label).toBe("Due today");
    expect(chequeDueLabel(cheques[2]!, today).label).toBe("Due in 7 days");
    expect(chequeDueLabel(cheques[8]!, today)).toEqual({ late: true, label: "Bounced" });
    expect(nextCheque(cheques.slice(3))?.id).toBe("day8");
    expect(nextCheque([cheques[7]!])).toBeNull();
  });

  it("uses the Dubai date, which is already tomorrow late in the UTC evening", () => {
    expect(dubaiToday(new Date("2026-11-18T19:59:00Z"))).toBe("2026-11-18");
    expect(dubaiToday(new Date("2026-11-18T20:00:00Z"))).toBe("2026-11-19");
  });
});

describe("renewals", () => {
  const today = "2026-11-18";
  const l = (id: string, status: string, end_date: string) => ({ id, status, end_date });
  const leases = [
    l("far", "active", "2027-02-17"), // 91 days
    l("edge", "active", "2027-02-16"), // 90 days
    l("soon", "active", "2026-12-18"), // 30 days
    l("past", "active", "2026-11-10"), // ended, still active
    l("ended", "ended", "2026-12-01"),
    l("renewed", "renewed", "2026-12-01"),
  ];
  const r = renewals(leases, today);

  it("lists active leases ending within 90 days, soonest first", () => {
    expect(r.map((x) => x.lease.id)).toEqual(["past", "soon", "edge"]);
    expect(r.map((x) => x.daysLeft)).toEqual([-8, 30, 90]);
    expect(r.map((x) => x.ended)).toEqual([true, false, false]);
  });

  it("gives the date 90 days before the lease end", () => {
    const edge = r.find((x) => x.lease.id === "edge")!;
    expect(edge.noticeBy).toBe("2026-11-18");
    expect(edge.noticePassed).toBe(false);
    expect(edge.noticeLine).toBe(
      "By practice, give notice by 18 Nov 2026; check the current rules.",
    );
  });

  it("says so when the notice date has already passed", () => {
    const soon = r.find((x) => x.lease.id === "soon")!;
    expect(soon.noticeBy).toBe("2026-09-19");
    expect(soon.noticePassed).toBe(true);
    expect(soon.noticeLine).toContain("that date has passed");
    expect(soon.noticeLine).toContain("Check the current rules");
  });

  it("never states a rent increase", () => {
    for (const x of r) expect(x.noticeLine).not.toMatch(/%|increase|index|AED/i);
  });
});

describe("landlord statement", () => {
  const units = [
    {
      id: "u1",
      building: "Marina Gate 1",
      unit_number: "1204",
      community: "Dubai Marina",
      management_fee_percent: 5,
    },
    {
      id: "u2",
      building: "Vida",
      unit_number: "307",
      community: "The Hills",
      management_fee_percent: 7.5,
    },
    { id: "u3", building: "Empty one", unit_number: "", community: "", management_fee_percent: 5 },
  ];
  const leases = [
    { id: "l1", unit_id: "u1" },
    { id: "l2", unit_id: "u2" },
    { id: "other", unit_id: "someone-elses-unit" },
  ];
  const ch = (
    lease_id: string,
    amount_aed: number,
    status: string,
    due_date: string,
    cleared_on: string | null = null,
    bank_date: string | null = null,
  ) => ({ lease_id, amount_aed, status, due_date, cleared_on, bank_date });
  const cheques = [
    ch("l1", 30_000, "cleared", "2026-11-01", "2026-11-04"),
    ch("l1", 30_000, "cleared", "2026-08-01", "2026-08-03"), // earlier period
    ch("l1", 30_000, "pending", "2026-11-20"),
    ch("l1", 30_000, "banked", "2026-11-05", null, "2026-11-05"), // not cleared yet
    ch("l1", 30_000, "bounced", "2026-11-06"),
    ch("l2", 33_333.33, "cleared", "2026-10-28", "2026-11-30"), // last day of period
    ch("l2", 10_000, "cleared", "2026-11-28", "2026-12-01"), // cleared after the period
    ch("l2", 5_000, "cleared", "2026-11-02", null, "2026-11-03"), // falls back to bank date
    ch("other", 99_000, "cleared", "2026-11-01", "2026-11-02"),
  ];
  const tk = (
    unit_id: string,
    title: string,
    status: string,
    who_pays: string,
    cost_aed: number | null,
    closed_on: string | null,
  ) => ({ unit_id, title, status, who_pays, cost_aed, opened_on: "2026-11-01", closed_on });
  const tickets = [
    tk("u1", "AC repair", "done", "owner", 850.5, "2026-11-12"),
    tk("u1", "Tenant broke the door", "done", "tenant", 400, "2026-11-12"),
    tk("u1", "Goodwill paint touch-up", "done", "company", 300, "2026-11-12"),
    tk("u1", "Water heater", "assigned", "owner", 1_200, null), // not finished
    tk("u1", "Old job", "done", "owner", 500, "2026-10-30"), // earlier period
    tk("u2", "Cancelled job", "cancelled", "owner", 700, "2026-11-10"),
    tk("u2", "Plumbing", "done", "owner", 249.5, "2026-11-30"),
  ];
  const s = ownerStatement({
    units,
    leases,
    cheques,
    tickets,
    from: "2026-11-01",
    to: "2026-11-30",
  });

  it("counts only rent cleared inside the period", () => {
    expect(s.lines[0]!.rentCleared).toBe(30_000);
    expect(s.lines[0]!.chequesCleared).toBe(1);
    expect(s.lines[1]!.rentCleared).toBe(38_333.33);
    expect(s.lines[1]!.chequesCleared).toBe(2);
  });

  it("takes the management fee as a percent of cleared rent", () => {
    expect(s.lines[0]!.fee).toBe(1_500);
    expect(s.lines[1]!.fee).toBe(2_875); // 7.5% of 38,333.33 = 2,874.99975
  });

  it("takes off only finished maintenance the landlord pays for", () => {
    expect(s.lines[0]!.maintenance).toBe(850.5);
    expect(s.lines[0]!.maintenanceItems).toEqual([
      { title: "AC repair", date: "2026-11-12", cost: 850.5 },
    ]);
    expect(s.lines[1]!.maintenance).toBe(249.5);
  });

  it("works out net to the landlord per unit and in total", () => {
    expect(s.lines[0]!.net).toBe(27_649.5);
    expect(s.lines[1]!.net).toBe(35_208.83);
    expect(s.lines[2]).toMatchObject({ rentCleared: 0, fee: 0, maintenance: 0, net: 0 });
    expect(s.totals).toEqual({
      rentCleared: 68_333.33,
      fee: 4_375,
      maintenance: 1_100,
      net: 62_858.33,
    });
    expect(s.totals.net).toBe(sumAed([s.totals.rentCleared, -s.totals.fee, -s.totals.maintenance]));
  });

  it("shows a negative net when costs are more than the rent cleared", () => {
    const quiet = ownerStatement({
      units,
      leases,
      cheques: [],
      tickets,
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(quiet.totals).toEqual({ rentCleared: 0, fee: 0, maintenance: 1_100, net: -1_100 });
  });

  it("turns a month into a period and labels units", () => {
    expect(monthPeriod("2026-11")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
      label: "November 2026",
    });
    expect(monthPeriod("2028-02")?.to).toBe("2028-02-29");
    expect(monthPeriod("2026-13")).toBeNull();
    expect(unitLabel(units[0]!)).toBe("Marina Gate 1 1204, Dubai Marina");
  });
});

describe("reminder drafts", () => {
  it("drafts a cheque reminder with the real amount and date", () => {
    const text = chequeReminder({
      tenantName: "Sara Khan",
      unitLabel: "Marina Gate 1 1204",
      seq: 2,
      count: 4,
      amount: 30_000,
      dueDate: "2026-11-25",
      status: "pending",
      agencyName: "Demo Agency",
    });
    expect(text).toContain("Hello Sara,");
    expect(text).toContain("rent cheque 2 of 4 (AED 30,000) for Marina Gate 1 1204");
    expect(text).toContain("25 Nov 2026");
    expect(text.endsWith("Demo Agency")).toBe(true);
  });

  it("words a bounced cheque differently", () => {
    const text = chequeReminder({
      tenantName: "",
      unitLabel: "Vida 307",
      seq: 1,
      count: 1,
      amount: 90_000.5,
      dueDate: "2026-11-01",
      status: "bounced",
      agencyName: "Demo Agency",
    });
    expect(text).toContain("Hello there,");
    expect(text).toContain("returned by the bank");
    expect(text).toContain("AED 90,000.50");
  });

  it("mentions the proposed rent only when one was typed", () => {
    const base = {
      tenantName: "Omar",
      unitLabel: "Vida 307",
      endDate: "2027-01-31",
      agencyName: "Demo Agency",
    };
    expect(renewalReminder({ ...base, proposedRent: "" })).not.toContain("proposed rent");
    expect(renewalReminder({ ...base, proposedRent: " AED 95,000 " })).toContain(
      "proposed rent for the new term is AED 95,000.",
    );
  });
});
