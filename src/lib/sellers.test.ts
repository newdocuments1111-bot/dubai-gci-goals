import { describe, expect, it } from "vitest";
import {
  chequeState,
  chequesNeedingAction,
  daysUntil,
  dubaiMonthStart,
  leaseStatus,
  ownerUpdate,
  stageLabel,
  targetProgress,
} from "./sellers";

const now = new Date("2026-11-18T10:00:00Z");

describe("seller side", () => {
  it("counts days in Dubai dates", () => {
    expect(daysUntil("2026-11-18", now)).toBe(0);
    expect(daysUntil("2026-11-21", now)).toBe(3);
    expect(daysUntil("2026-11-19", new Date("2026-11-18T21:00:00Z"))).toBe(0); // already the 19th in Dubai
    expect(dubaiMonthStart(now)).toBe("2026-10-31T20:00:00.000Z");
  });

  it("flags leases inside the 90-day renewal window", () => {
    expect(leaseStatus(null, now)).toBeNull();
    expect(leaseStatus("2027-06-01", now)?.tone).toBe("ok");
    expect(leaseStatus("2027-01-10", now)).toMatchObject({ tone: "soon", days: 53 });
    expect(leaseStatus("2026-11-10", now)?.label).toBe("Lease ended 8 days ago");
  });

  it("sorts cheques that need action", () => {
    const cheques = [
      { status: "pending", due_date: "2026-12-30" },
      { status: "pending", due_date: "2026-11-20" },
      { status: "bounced", due_date: "2026-10-01" },
      { status: "cleared", due_date: "2026-11-01" },
      { status: "pending", due_date: "2026-11-10" },
    ];
    expect(chequesNeedingAction(cheques, now).map((c) => `${c.status}:${c.due_date}`)).toEqual([
      "bounced:2026-10-01",
      "pending:2026-11-10",
      "pending:2026-11-20",
    ]);
    expect(chequeState({ status: "pending", due_date: "2026-11-10" }, now)).toEqual({
      tone: "late",
      label: "Overdue 8 d",
    });
    expect(chequeState({ status: "pending", due_date: "2026-11-18" }, now).label).toBe("Due today");
  });

  it("writes an owner update from real counts", () => {
    const text = ownerUpdate(
      "Fatima Al Ali",
      {
        title: "Marina Gate 2BR",
        price_aed: 2_050_000,
        status: "Available",
        listedAt: "2026-10-29T10:00:00Z",
        viewingsBooked: 0,
        viewingsDone: 0,
        matchingBuyers: 3,
        enquiries: 4,
      },
      "Ahmed",
      now,
    );
    expect(text).toContain("Hello Fatima, here is your update on Marina Gate 2BR.");
    expect(text).toContain("On the market: 20 days at AED 2,050,000");
    expect(text).toContain("Buyers on our books who fit: 3");
    expect(text).toContain("talk about the price and photos");
    expect(text.endsWith("Ahmed")).toBe(true);
  });

  it("tracks targets", () => {
    expect(targetProgress(5, null)).toBeNull();
    expect(targetProgress(5, 20)).toEqual({ percent: 25, left: 15, hit: false });
    expect(targetProgress(25, 20)).toEqual({ percent: 100, left: 0, hit: true });
    expect(stageLabel("form_a")).toBe("Form A signed");
  });
});
