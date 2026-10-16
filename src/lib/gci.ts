export type Rates = { callsToTalks: number; talksToAppraisals: number; appraisalsToListings: number; listingsToDeals: number };
export type Inputs = { price: number; commissionPct: number; splitPct: number; weeks: number; rates: Rates };

export function gciPerDeal(i: Inputs) {
  return i.price * (i.commissionPct / 100);
}

/** Funnel from yearly GCI goal (GCI = gross commission before agent split). */
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
