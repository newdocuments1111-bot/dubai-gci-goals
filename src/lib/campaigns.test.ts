import { describe, expect, it } from "vitest";
import {
  audienceOptions,
  campaignProblems,
  countStatuses,
  followUpStopped,
  leadValues,
} from "./campaigns";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const templates = [
  { id: A, label: "New launch", category: "marketing", meta_status: "approved" },
  { id: B, label: "Viewing reminder", category: "utility", meta_status: "pending" },
];

describe("campaigns", () => {
  it("accepts one approved message sent now", () => {
    expect(campaignProblems([{ templateId: A, afterDays: 0 }], templates, 7)).toEqual([]);
  });

  it("refuses templates Meta has not approved", () => {
    const p = campaignProblems([{ templateId: B, afterDays: 0 }], templates, 7);
    expect(p.join(" ")).toContain("not approved by Meta");
  });

  it("keeps the marketing gap between follow-ups", () => {
    const tooSoon = campaignProblems(
      [
        { templateId: A, afterDays: 0 },
        { templateId: A, afterDays: 3 },
      ],
      templates,
      7,
    );
    expect(tooSoon.join(" ")).toContain("at least 7 days");
    expect(
      campaignProblems(
        [
          { templateId: A, afterDays: 0 },
          { templateId: A, afterDays: 7 },
        ],
        templates,
        7,
      ),
    ).toEqual([]);
  });

  it("needs each follow-up later than the one before", () => {
    const p = campaignProblems(
      [
        { templateId: A, afterDays: 0 },
        { templateId: A, afterDays: 14 },
        { templateId: A, afterDays: 14 },
      ],
      templates,
      7,
    );
    expect(p.join(" ")).toContain("Message 3 must go later");
  });

  it("fills blanks from the lead first, then from what the owner typed", () => {
    const r = leadValues({ name: "Omar Al Farsi", area: "" }, ["name", "area", "property"], {
      area: "Dubai",
      property: "Marina Gate",
    });
    expect(r.values).toEqual({ name: "Omar", area: "Dubai", property: "Marina Gate" });
    expect(r.missing).toEqual([]);
    expect(leadValues({ name: "", area: "" }, ["name", "price"], {}).missing).toEqual([
      "name",
      "price",
    ]);
  });

  it("drops a follow-up only when the client replied after the campaign started", () => {
    const queued = "2026-11-01T08:00:00Z";
    expect(followUpStopped(2, queued, "2026-11-03T08:00:00Z")).toBe(true);
    expect(followUpStopped(2, queued, "2026-10-30T08:00:00Z")).toBe(false);
    expect(followUpStopped(1, queued, "2026-11-03T08:00:00Z")).toBe(false);
    expect(followUpStopped(null, queued, "2026-11-03T08:00:00Z")).toBe(false);
    expect(followUpStopped(3, queued, null)).toBe(false);
  });

  it("offers ready-made audiences and valid saved lists", () => {
    const o = audienceOptions([
      { id: "x", name: "Marina buyers", filters: { q: "Marina", score: "Hot" } },
      { id: "y", name: "Broken", filters: { score: "Boiling" } },
    ]);
    expect(o.map((a) => a.label)).toEqual([
      "All open leads",
      "Hot leads",
      "Not-now leads",
      "List: Marina buyers",
    ]);
    expect(o[2]!.filter.outcome).toBe("not_now");
  });

  it("counts queue statuses", () => {
    expect(
      countStatuses(["sent", "sent", "approved", "scheduled", "blocked", "cancelled"]),
    ).toEqual({ sent: 2, waiting: 2, blocked: 1, failed: 0, cancelled: 1 });
  });
});
