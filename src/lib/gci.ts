export type Rates = { callsToTalks: number; talksToAppraisals: number; appraisalsToListings: number; listingsToDeals: number };
export type Inputs = { price: number; commissionPct: number; weeks: number; rates: Rates };

export function gciPerDeal(i: Inputs) {
  return i.price * (i.commissionPct / 100);
}

/** Funnel from yearly GCI goal (GCI = total commission earned). */
export function fromGoal(goal: number, i: Inputs) {
  const per = gciPerDeal(i);
  const deals = per > 0 ? goal / per : 0;
  const r = i.rates;
  const listings = deals / (r.listingsToDeals / 100 || 1);
  const appraisals = listings / (r.appraisalsToListings / 100 || 1);
  const talks = appraisals / (r.talksToAppraisals / 100 || 1);
  const calls = talks / (r.callsToTalks / 100 || 1);
  return { deals, listings, appraisals, talks, calls };
}

export function fromEffort(callsPerWeek: number, i: Inputs) {
  const r = i.rates;
  const calls = callsPerWeek * i.weeks;
  const talks = calls * (r.callsToTalks / 100);
  const appraisals = talks * (r.talksToAppraisals / 100);
  const listings = appraisals * (r.appraisalsToListings / 100);
  const deals = listings * (r.listingsToDeals / 100);
  return { deals, listings, appraisals, talks, calls };
}

export const WORKING_DAYS_PER_WEEK = 5;

/** Working days and daily call target needed to hit the GCI goal. */
export function completionPlan(mode: "goal" | "effort", goal: number, callsPerWeek: number, i: Inputs) {
  const validPercent = (v: number) => Number.isFinite(v) && v > 0 && v <= 100;
  if (!Number.isFinite(goal) || goal < 0 || !Number.isFinite(i.price) || i.price <= 0 ||
      !validPercent(i.commissionPct) || !Object.values(i.rates).every(validPercent) ||
      (mode === "goal" && (!Number.isFinite(i.weeks) || i.weeks <= 0)) ||
      (mode === "effort" && (!Number.isFinite(callsPerWeek) || callsPerWeek <= 0))) return null;

  const funnel = fromGoal(goal, i);
  const callsPerDay = mode === "goal"
    ? Math.ceil(funnel.calls / (i.weeks * WORKING_DAYS_PER_WEEK))
    : callsPerWeek / WORKING_DAYS_PER_WEEK;
  const workingDays = mode === "goal"
    ? Math.ceil(i.weeks * WORKING_DAYS_PER_WEEK)
    : Math.ceil(funnel.calls / callsPerDay);

  return { funnel, callsPerDay, workingDays, workingWeeks: workingDays / WORKING_DAYS_PER_WEEK };
}
