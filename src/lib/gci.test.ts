import { describe, expect, it } from "vitest";
import { completionPlan, type Inputs } from "./gci";

const inputs: Inputs = {
  price: 2_000_000, commissionPct: 2, splitPct: 60, weeks: 46,
  rates: { callsToTalks: 36, talksToAppraisals: 34, appraisalsToListings: 59, listingsToDeals: 31 },
};

describe("GCI goal completion", () => {
  it("shows the working-day deadline and rounded daily target in goal mode", () => {
    const plan = completionPlan("goal", 1_000_000, 200, inputs);
    expect(plan?.workingDays).toBe(230);
    expect(plan?.workingWeeks).toBe(46);
    expect(plan?.callsPerDay).toBe(216);
    expect(plan?.funnel.deals).toBe(25);
  });

  it("uses weekly effort to calculate rounded working days to the target GCI", () => {
    const plan = completionPlan("effort", 1_000_000, 200, inputs);
    expect(plan?.callsPerDay).toBe(40);
    expect(plan?.workingDays).toBe(2792);
    expect(plan?.workingWeeks).toBe(558.4);
  });

  it("updates completion time when the target GCI changes in effort mode", () => {
    expect(completionPlan("effort", 500_000, 200, inputs)?.workingDays).toBe(1396);
  });

  it("keeps gross-goal timing independent of the 60/40 or 80/20 split", () => {
    expect(completionPlan("effort", 1_000_000, 200, { ...inputs, splitPct: 80 }))
      .toEqual(completionPlan("effort", 1_000_000, 200, inputs));
  });

  it("does not claim a completion time for zero pace or zero conversion", () => {
    expect(completionPlan("effort", 1_000_000, 0, inputs)).toBeNull();
    expect(completionPlan("goal", 1_000_000, 200, {
      ...inputs, rates: { ...inputs.rates, callsToTalks: 0 },
    })).toBeNull();
  });
});