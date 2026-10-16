export type Signs = { budget: string | null; location: string | null; moveIn: string | null };
export type Score = "hot" | "warm" | "cold";
export type Lead = { id: string; name: string; email: string | null; url: string | null; signs: Signs; score: Score; nextStep: string };

/** 3 signs = Hot, 2 = Warm, 0–1 = Cold. */
export function scoreFromSigns(s: Signs): Score {
  const count = [s.budget, s.location, s.moveIn].filter((v) => v && v.trim()).length;
  return count === 3 ? "hot" : count === 2 ? "warm" : "cold";
}
