import { describe, expect, it } from "vitest";
import {
  adDecisions,
  fillTemplate,
  isOverdue,
  isParked,
  lostNeedsReason,
  rankAds,
  ruleFor,
  toggleItem,
  totals,
  trackFor,
  type AdCampaign,
  type LeadReport,
  type StageRule,
} from "./pipeline";

const rule = (track: string, stage: number, name: string): StageRule => ({
  track,
  stage,
  name,
  who: "agent",
  next_action: null,
  next_action_offset: null,
  checklist: ["a"],
  template: null,
});
const rules = [
  rule("ready", 4, "Qualified"),
  rule("ready", 10, "Deal agreed"),
  rule("offplan", 10, "Reservation"),
];

describe("pipeline rules", () => {
  it("parks not_now and lost", () => {
    expect(isParked("not_now")).toBe(true);
    expect(isParked("lost")).toBe(true);
    expect(isParked("open")).toBe(false);
  });
  it("off-plan only changes steps 10 to 13", () => {
    expect(trackFor(4, "offplan")).toBe("ready");
    expect(trackFor(10, "offplan")).toBe("offplan");
    expect(trackFor(14, "offplan")).toBe("ready");
    expect(ruleFor(rules, 10, "offplan").name).toBe("Reservation");
    expect(ruleFor(rules, 10, "ready").name).toBe("Deal agreed");
    expect(ruleFor(rules, 9, "ready").name).toBe("Step 9");
  });
  it("a lost lead needs a reason", () => {
    expect(lostNeedsReason("lost", "")).toBe(true);
    expect(lostNeedsReason("lost", "Bought elsewhere")).toBe(false);
    expect(lostNeedsReason("open", "")).toBe(false);
  });
  it("overdue counts only open leads with a past due date", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    expect(isOverdue({ outcome: "open", next_action_at: "2026-11-18T09:00:00Z" }, now)).toBe(true);
    expect(isOverdue({ outcome: "lost", next_action_at: "2026-11-18T09:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ outcome: "open", next_action_at: null }, now)).toBe(false);
  });
  it("toggles checklist items", () => {
    expect(toggleItem([], "a")).toEqual(["a"]);
    expect(toggleItem(["a", "b"], "a")).toEqual(["b"]);
  });
  it("fills the message with the lead details", () => {
    expect(
      fillTemplate(
        "Hi {name}, about {area}: {options}",
        { name: "Omar Hassan", area: "JVC", source_detail: null },
        { options: ["1-bed JVC A"] },
      ),
    ).toBe("Hi Omar, about JVC: 1-bed JVC A");
  });
});

const rows = [
  {
    source: "Ad A",
    spend: 2000,
    leads: 4,
    replied: 4,
    avg_first_reply_minutes: 3,
    viewings_attended: 2,
    qualified: 3,
    cost_per_attended_viewing: 1000,
  },
  {
    source: "Ad B",
    spend: 1000,
    leads: 2,
    replied: 1,
    avg_first_reply_minutes: 60,
    viewings_attended: 0,
    qualified: 1,
    cost_per_attended_viewing: null,
  },
  {
    source: "Bayut",
    spend: null,
    leads: 2,
    replied: 2,
    avg_first_reply_minutes: 5,
    viewings_attended: 1,
    qualified: 2,
    cost_per_attended_viewing: null,
  },
] as unknown as LeadReport[];

describe("owner numbers", () => {
  it("adds up and counts cost per viewing only on paid ads", () => {
    const t = totals(rows);
    expect(t.leads).toBe(8);
    expect(t.repliedPct).toBe(88);
    expect(t.spend).toBe(3000);
    expect(t.costPerViewing).toBe(1500);
    expect(Math.round(t.avgReplyMinutes ?? 0)).toBe(12);
  });
  it("ranks ads cheapest viewing first, portals left out", () => {
    expect(rankAds(rows).map((r) => r.source)).toEqual(["Ad A", "Ad B"]);
  });
  it("applies the day-14 rule", () => {
    const ads = [
      { name: "Ad A", status: "testing", started_at: "2026-11-01" },
      { name: "Ad B", status: "testing", started_at: "2026-11-01" },
      { name: "Ad C", status: "testing", started_at: "2026-11-01" },
      { name: "Ad D", status: "testing", started_at: "2026-11-15" },
    ] as unknown as AdCampaign[];
    const r = [
      ...rows.slice(0, 2),
      { source: "Ad C", spend: 1000, cost_per_attended_viewing: 1500, qualified: 1 },
    ] as unknown as LeadReport[];
    const d = adDecisions(ads, r, new Date("2026-11-20"));
    expect(d.find((x) => x.name === "Ad A")?.action).toBe("keep");
    expect(d.find((x) => x.name === "Ad B")?.action).toBe("stop");
    expect(d.find((x) => x.name === "Ad C")?.action).toBe("stop");
    expect(d.find((x) => x.name === "Ad D")?.action).toBe("wait");
  });
});
