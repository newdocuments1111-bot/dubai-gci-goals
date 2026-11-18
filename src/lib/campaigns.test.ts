import { describe, expect, it } from "vitest";
import {
  META_MARKETING_RATE_AED_ESTIMATE,
  META_UTILITY_RATE_AED_ESTIMATE,
  audienceOptions,
  campaignCost,
  campaignProblems,
  costLine,
  countStatuses,
  followUpStopped,
  formatAed,
  leadValues,
  metaErrorCode,
  metaLimitRetry,
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

describe("campaign cost", () => {
  const priced = [
    { id: A, category: "marketing" },
    { id: B, category: "utility" },
  ];

  it("prices one marketing message to every client", () => {
    const c = campaignCost([{ templateId: A, afterDays: 0 }], priced, 480);
    expect(c.steps).toEqual([
      {
        n: 1,
        category: "marketing",
        afterDays: 0,
        upTo: false,
        messages: 480,
        rateAed: META_MARKETING_RATE_AED_ESTIMATE,
        aed: 101.52,
      },
    ]);
    expect(c.firstSendAed).toBe(101.52);
    expect(c.mostAed).toBe(101.52);
  });

  it("adds follow-ups as up-to amounts at their own category price", () => {
    const c = campaignCost(
      [
        { templateId: A, afterDays: 0 },
        { templateId: A, afterDays: 7 },
        { templateId: B, afterDays: 10 },
      ],
      priced,
      500,
    );
    expect(c.steps.map((s) => [s.n, s.upTo, s.aed])).toEqual([
      [1, false, 105.75],
      [2, true, 105.75],
      [3, true, 25],
    ]);
    expect(c.steps[2]!.rateAed).toBe(META_UTILITY_RATE_AED_ESTIMATE);
    expect(c.firstSendAed).toBe(105.75);
    expect(c.mostAed).toBe(236.5);
  });

  it("rounds each line to whole fils and never prices an unknown template too low", () => {
    const c = campaignCost([{ templateId: "missing", afterDays: 0 }], priced, 7);
    expect(c.steps[0]!.category).toBe("marketing");
    expect(c.steps[0]!.aed).toBe(1.48); // 7 × 0.2115 = 1.4805
    expect(campaignCost([{ templateId: A, afterDays: 0 }], priced, 0).mostAed).toBe(0);
    expect(campaignCost([{ templateId: A, afterDays: 0 }], priced, -3).mostAed).toBe(0);
  });

  it("writes amounts and lines in plain words", () => {
    expect(formatAed(101)).toBe("AED 101");
    expect(formatAed(101.52)).toBe("AED 101.52");
    expect(formatAed(1234.5)).toBe("AED 1,234.50");
    const c = campaignCost(
      [
        { templateId: A, afterDays: 0 },
        { templateId: B, afterDays: 1 },
      ],
      priced,
      480,
    );
    expect(costLine(c.steps[0]!)).toBe("Message 1 today · 480 × AED 0.2115 = AED 101.52");
    expect(costLine(c.steps[1]!)).toBe("Message 2 after 1 day · up to 480 × AED 0.05 = AED 24");
  });
});

describe("retry on Meta's per-person limit", () => {
  const limit = "Message undeliverable (code 131049)";
  const noon = new Date("2026-10-27T08:00:00Z"); // 12:00 Dubai

  it("reads Meta's code from the stored failure text", () => {
    expect(metaErrorCode(limit)).toBe(131049);
    expect(metaErrorCode("Meta refused the request [400]: Re-engagement (code 131047)")).toBe(
      131047,
    );
    expect(metaErrorCode("Failed")).toBeNull();
    expect(metaErrorCode(null)).toBeNull();
  });

  it("tries again 24 hours later, inside sending hours", () => {
    expect(metaLimitRetry({ errorText: limit, retries: 0, now: noon })).toEqual({
      action: "retry",
      at: new Date("2026-10-28T08:00:00Z"),
      retries: 1,
    });
    // Failed at 11pm Dubai: 24 hours later is still night, so it waits for 9am.
    expect(
      metaLimitRetry({ errorText: limit, retries: 1, now: new Date("2026-10-27T19:00:00Z") }),
    ).toEqual({ action: "retry", at: new Date("2026-10-29T05:00:00Z"), retries: 2 });
  });

  it("gives up after two retries or when the campaign was stopped", () => {
    expect(metaLimitRetry({ errorText: limit, retries: 2, now: noon }).action).toBe("give_up");
    expect(
      metaLimitRetry({ errorText: limit, retries: 0, campaignActive: false, now: noon }).action,
    ).toBe("give_up");
  });

  it("leaves every other failure, and old failures, alone", () => {
    expect(metaLimitRetry({ errorText: "Failed (code 131026)", retries: 0, now: noon })).toEqual({
      action: "none",
    });
    expect(metaLimitRetry({ errorText: null, retries: 0, now: noon })).toEqual({ action: "none" });
    expect(
      metaLimitRetry({
        errorText: limit,
        retries: 0,
        failedAt: "2026-10-23T08:00:00Z",
        now: noon,
      }),
    ).toEqual({ action: "none" });
    expect(
      metaLimitRetry({
        errorText: limit,
        retries: 0,
        failedAt: "2026-10-27T07:00:00Z",
        now: noon,
      }).action,
    ).toBe("retry");
  });
});
