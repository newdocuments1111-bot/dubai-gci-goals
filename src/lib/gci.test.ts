import { describe, expect, it } from "vitest";
import { completionPlan, type Inputs } from "./gci";

const inputs: Inputs = {
  price: 2_000_000, commissionPct: 2, weeks: 46,
  rates: { callsToTalks: 36, talksToAppraisals: 34, appraisalsToListings: 59, listingsToDeals: 31 },
};

describe("GCI goal completion", () => {
  it("shows the working-day deadline and rounded daily target in goal mode", () => {
    const plan = completionPlan("goal", 1_000_000, 200, inputs);
    expect(plan?.workingDays).toBe(230);
    expect(plan?.workingWeeks).toBe(46);
    expect(plan?.callsPerDay).toBe(5);
    expect(plan?.funnel.deals).toBe(25);
  });

  it("uses weekly effort to calculate rounded working days to the target GCI", () => {
    const plan = completionPlan("effort", 1_000_000, 200, inputs);
    expect(plan?.callsPerDay).toBe(40);
    expect(plan?.workingDays).toBe(28);
    expect(plan?.workingWeeks).toBe(5.6);
  });

  it("updates completion time when the target GCI changes in effort mode", () => {
    expect(completionPlan("effort", 500_000, 200, inputs)?.workingDays).toBe(14);
  });

  it("reports total GCI per deal as price times commission, with no split applied", () => {
    expect(gciPerDeal(inputs)).toBe(40_000);
    expect(completionPlan("goal", 1_000_000, 200, inputs)?.funnel.deals).toBe(25);
  });

  it("does not claim a completion time for zero pace or zero conversion", () => {
    expect(completionPlan("effort", 1_000_000, 0, inputs)).toBeNull();
    expect(completionPlan("goal", 1_000_000, 200, {
      ...inputs, rates: { ...inputs.rates, callsToTalks: 0 },
    })).toBeNull();
  });
});