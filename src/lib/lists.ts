/** Lead list filters and saved lists. Browser-safe and tested. */
import { z } from "zod";

export const filterSchema = z.object({
  q: z.string().max(100).default(""),
  score: z.enum(["", "Hot", "Warm", "Cold"]).default(""),
  source: z.string().max(40).default(""),
  type: z.string().max(20).default(""),
  agent: z.string().max(40).default(""),
  step: z.enum(["", "new", "qualified", "viewing", "offer", "closed"]).default(""),
  reply: z.enum(["", "waiting", "replied"]).default(""),
  outcome: z.enum(["open", "not_now", "lost", "won", "all"]).default("open"),
});
export type LeadFilter = z.infer<typeof filterSchema>;
export const EMPTY_FILTER: LeadFilter = filterSchema.parse({});

export const STEP_RANGES: Record<
  Exclude<LeadFilter["step"], "">,
  { label: string; from: number; to: number }
> = {
  new: { label: "New or first reply (1–2)", from: 1, to: 2 },
  qualified: { label: "Qualifying (3–5)", from: 3, to: 5 },
  viewing: { label: "Viewing and follow-up (6–8)", from: 6, to: 8 },
  offer: { label: "Offer and paperwork (9–13)", from: 9, to: 13 },
  closed: { label: "Closed and after (14–15)", from: 14, to: 15 },
};

export type ListLead = {
  name: string;
  phone: string;
  area: string;
  budget: string;
  score: string;
  source: string;
  type: string;
  stage: number;
  outcome: string;
  first_reply_at: string | null;
  assigned_agent_id: string | null;
};

export function matchesFilter(l: ListLead, f: LeadFilter): boolean {
  if (f.outcome !== "all" && l.outcome !== f.outcome) return false;
  if (f.score && l.score !== f.score) return false;
  if (f.source && l.source !== f.source) return false;
  if (f.type && l.type !== f.type) return false;
  if (
    f.agent === "pool" ? l.assigned_agent_id !== null : f.agent && l.assigned_agent_id !== f.agent
  )
    return false;
  if (f.step) {
    const r = STEP_RANGES[f.step];
    if (l.stage < r.from || l.stage > r.to) return false;
  }
  if (f.reply === "waiting" && l.first_reply_at) return false;
  if (f.reply === "replied" && !l.first_reply_at) return false;
  const q = f.q.trim().toLowerCase();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const hit =
      l.name.toLowerCase().includes(q) ||
      l.area.toLowerCase().includes(q) ||
      l.budget.toLowerCase().includes(q) ||
      (digits.length >= 4 && l.phone.replace(/\D/g, "").includes(digits));
    if (!hit) return false;
  }
  return true;
}

export const applyFilter = <T extends ListLead>(leads: T[], f: LeadFilter) =>
  leads.filter((l) => matchesFilter(l, f));

/** True when the filter narrows anything (so "Save as list" makes sense). */
export function isFiltered(f: LeadFilter): boolean {
  return Object.entries(f).some(([k, v]) => v !== (EMPTY_FILTER as Record<string, string>)[k]);
}

/** A short name suggestion: "Hot · Bayut · Marina". */
export function suggestName(f: LeadFilter): string {
  return (
    [
      f.score,
      f.source,
      f.q,
      f.step && STEP_RANGES[f.step].label.split(" (")[0],
      f.reply === "waiting" && "Not replied",
      f.type,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 60) || "My list"
  );
}
