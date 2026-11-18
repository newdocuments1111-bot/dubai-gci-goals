import { describe, expect, it } from "vitest";
import { advertCheck, advertDate, dubaiToday, type AdvertListing } from "./advert";

const today = "2026-11-18";
const listing: AdvertListing = {
  permit_number: "7123456789",
  permit_expires_on: "2027-03-01",
  price_aed: 2400000,
  is_sample: false,
};
const agency = { reraBrn: "12345" };
const check = (l: Partial<AdvertListing> = {}, a = agency, day = today) =>
  advertCheck({ ...listing, ...l }, a, day);

describe("advert check", () => {
  it("passes a complete advert with nothing to say", () => {
    const result = check();
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.takeDownOn).toBe("2027-03-01");
    expect(result.items.map((i) => i.ok)).toEqual([true, true, true, true]);
  });

  it("blocks without a permit number", () => {
    const result = check({ permit_number: "  " });
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain("permit number");
    expect(result.items.find((i) => i.key === "permit")?.ok).toBe(false);
  });

  it("blocks without a price", () => {
    expect(check({ price_aed: 0 }).blockers[0]).toContain("price");
    expect(check({ price_aed: Number.NaN }).blockers).toHaveLength(1);
    expect(check({ price_aed: -5 }).blockers).toHaveLength(1);
  });

  it("blocks without the agency RERA number", () => {
    expect(check({}, { reraBrn: " " }).blockers[0]).toContain("RERA number");
    expect(advertCheck(listing, { reraBrn: null }, today).blockers).toHaveLength(1);
    expect(check({}, { reraBrn: "" }).items.find((i) => i.key === "rera")?.ok).toBe(false);
  });

  it("blocks sample listings", () => {
    expect(check({ is_sample: true }).blockers[0]).toContain("sample listing");
  });

  it("blocks once the permit has ended, but not on its last day", () => {
    const ended = check({ permit_expires_on: "2026-11-17" });
    expect(ended.blockers).toHaveLength(1);
    expect(ended.blockers[0]).toContain("The permit ended on 17 Nov 2026");
    expect(ended.warnings).toEqual([]);
    expect(ended.takeDownOn).toBe("2026-11-17");
    expect(ended.items.find((i) => i.key === "permitEnd")?.ok).toBe(false);

    const lastDay = check({ permit_expires_on: today });
    expect(lastDay.blockers).toEqual([]);
    expect(lastDay.warnings[0]).toContain("ends today, on 18 Nov 2026");
  });

  it("warns when the permit ends within 14 days and says the date", () => {
    expect(check({ permit_expires_on: "2026-11-19" }).warnings[0]).toContain("tomorrow");
    const soon = check({ permit_expires_on: "2026-12-02" });
    expect(soon.blockers).toEqual([]);
    expect(soon.warnings).toHaveLength(1);
    expect(soon.warnings[0]).toContain("in 14 days, on 2 Dec 2026");
    expect(soon.takeDownOn).toBe("2026-12-02");
    expect(check({ permit_expires_on: "2026-12-03" }).warnings).toEqual([]);
  });

  it("warns when no permit end date is recorded", () => {
    for (const value of [null, undefined, "", "soon", "2026-02-30"]) {
      const result = check({ permit_expires_on: value });
      expect(result.blockers).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("No permit end date");
      expect(result.takeDownOn).toBeNull();
      expect(result.items.find((i) => i.key === "permitEnd")?.ok).toBe(false);
    }
  });

  it("lists every blocker together", () => {
    const result = advertCheck(
      { permit_number: "", permit_expires_on: null, price_aed: 0, is_sample: true },
      { reraBrn: "" },
      today,
    );
    expect(result.blockers).toHaveLength(4);
    expect(result.warnings).toHaveLength(1);
  });

  it("counts days across months and years without time zones", () => {
    expect(check({ permit_expires_on: "2027-01-05" }, agency, "2026-12-28").warnings[0]).toContain(
      "in 8 days, on 5 Jan 2027",
    );
    expect(() => check({}, agency, "today")).toThrow();
  });

  it("formats dates and finds today in Dubai", () => {
    expect(advertDate("2026-03-09")).toBe("9 Mar 2026");
    expect(advertDate("nonsense")).toBe("nonsense");
    expect(dubaiToday(new Date("2026-11-18T19:59:00Z"))).toBe("2026-11-18");
    expect(dubaiToday(new Date("2026-11-18T20:00:00Z"))).toBe("2026-11-19");
  });
});
