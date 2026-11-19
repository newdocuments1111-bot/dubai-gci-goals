import { describe, expect, it } from "vitest";
import {
  GOOD_CPL_AED,
  HIGH_CPL_AED,
  KEEP_MIN_MONEY_BACK,
  LOW_REPLY_RATE_PCT,
  MIN_SPEND_TO_JUDGE_AED,
  WASTE_MIN_SPEND_AED,
  adsManagerUrl,
  budgetSuggestion,
  daysInRange,
  graphErrorMessage,
  isValidMetaToken,
  metaAdsReport,
  metaId,
  metaLeadCount,
  money,
  moneyBackLabel,
  normaliseAdAccountId,
  parseInsightRow,
  parseMetaAdIds,
  sortByMoneyBack,
  syncRange,
  syncTimeLabel,
  verdictFor,
  type InsightRow,
  type MetaAdRow,
  type Metrics,
  type ReportLead,
} from "./meta-ads";

const SINCE = "2026-11-01";
const UNTIL = "2026-11-30";

const ins = (over: Partial<InsightRow> = {}): InsightRow => ({
  date: "2026-11-10",
  campaign_id: "100",
  campaign_name: "Marina buyers",
  adset_id: "200",
  adset_name: "UAE 30-55",
  ad_id: "300",
  ad_name: "Video A",
  spend: 0,
  impressions: 0,
  clicks: 0,
  meta_leads: 0,
  ...over,
});

let n = 0;
const lead = (over: Partial<ReportLead> = {}): ReportLead => ({
  id: `l${++n}`,
  name: "Client",
  score: "Warm",
  created_at: "2026-11-10T08:00:00Z",
  client_replied: false,
  meta_ad_id: "300",
  meta_adset_id: null,
  meta_campaign_id: null,
  ...over,
});

const m = (over: Partial<Metrics> = {}): Metrics => ({
  spend: 1000,
  leads: 10,
  replyRatePct: 80,
  costPerLead: 100,
  deals: 0,
  gci: 0,
  moneyBack: 0,
  ...over,
});

const report = (over: Partial<Parameters<typeof metaAdsReport>[0]> = {}) =>
  metaAdsReport({
    level: "ad",
    since: SINCE,
    until: UNTIL,
    currency: "AED",
    insights: [],
    leads: [],
    viewings: [],
    deals: [],
    ...over,
  });

describe("input checks", () => {
  it("normalises the ad account id", () => {
    expect(normaliseAdAccountId("act_1234567890")).toBe("act_1234567890");
    expect(normaliseAdAccountId(" 1234567890 ")).toBe("act_1234567890");
    expect(normaliseAdAccountId("ACT_42")).toBe("act_42");
    expect(normaliseAdAccountId("act_12ab")).toBeNull();
    expect(normaliseAdAccountId("")).toBeNull();
    expect(normaliseAdAccountId(null)).toBeNull();
  });

  it("checks the token shape without accepting spaces or short strings", () => {
    expect(isValidMetaToken("EAAB" + "x".repeat(100))).toBe(true);
    expect(isValidMetaToken("short")).toBe(false);
    expect(isValidMetaToken("EAAB token with spaces in it")).toBe(false);
    expect(isValidMetaToken(undefined)).toBe(false);
  });

  it("reads Meta ids as digit strings and refuses rounded numbers", () => {
    expect(metaId("120212345678901234")).toBe("120212345678901234");
    expect(metaId(" 42 ")).toBe("42");
    expect(metaId(42)).toBe("42");
    expect(metaId(Number("120212345678901234"))).toBeNull(); // not a safe integer: would be a different id
    expect(metaId("12a")).toBeNull();
    expect(metaId("")).toBeNull();
    expect(metaId(-5)).toBeNull();
    expect(metaId(null)).toBeNull();
  });

  it("takes ad, ad set and campaign ids from the intake body", () => {
    expect(
      parseMetaAdIds({ ad_id: "300", adset_id: "200", campaign_id: "100", name: "Sara" }),
    ).toEqual({ ad_id: "300", adset_id: "200", campaign_id: "100" });
    expect(parseMetaAdIds({ meta_ad_id: "301", ad_id: "bad" })).toEqual({
      ad_id: "301",
      adset_id: null,
      campaign_id: null,
    });
    expect(parseMetaAdIds({ ad_id: "not-an-id", name: "Sara" })).toBeNull();
    expect(parseMetaAdIds({ name: "Sara" })).toBeNull();
    expect(parseMetaAdIds("nope")).toBeNull();
    expect(parseMetaAdIds([1])).toBeNull();
  });
});

describe("Graph API answers", () => {
  it("syncs the last 30 Dubai days including today", () => {
    const r = syncRange(new Date("2026-11-19T21:30:00Z")); // already 20 Nov in Dubai
    expect(r).toEqual({ since: "2026-10-22", until: "2026-11-20" });
    expect(daysInRange(r.since, r.until)).toBe(30);
    expect(syncRange(new Date("2026-11-19T10:00:00Z"), 1)).toEqual({
      since: "2026-11-19",
      until: "2026-11-19",
    });
    expect(daysInRange("2026-11-19", "2026-11-19")).toBe(1);
    expect(daysInRange("bad", "2026-11-19")).toBe(1);
  });

  it("counts Meta leads from actions", () => {
    expect(metaLeadCount([{ action_type: "lead", value: "4" }])).toBe(4);
    expect(metaLeadCount([{ action_type: "onsite_conversion.lead_grouped", value: "3" }])).toBe(3);
    expect(
      metaLeadCount([
        { action_type: "link_click", value: "40" },
        { action_type: "leadgen_grouped", value: "2" },
      ]),
    ).toBe(2);
    expect(metaLeadCount(undefined)).toBe(0);
    expect(metaLeadCount([{ action_type: "lead", value: "x" }])).toBe(0);
  });

  it("parses one daily ad row and drops rows without an ad id or date", () => {
    expect(
      parseInsightRow({
        date_start: "2026-11-10",
        date_stop: "2026-11-10",
        campaign_id: "100",
        campaign_name: "Marina buyers",
        adset_id: "200",
        adset_name: "UAE",
        ad_id: "300",
        ad_name: "Video A",
        spend: "123.456",
        impressions: "1000",
        clicks: "25",
        actions: [{ action_type: "lead", value: "3" }],
      }),
    ).toEqual(
      ins({
        adset_name: "UAE",
        spend: 123.46,
        impressions: 1000,
        clicks: 25,
        meta_leads: 3,
      }),
    );
    expect(parseInsightRow({ date_start: "2026-11-10" })).toBeNull();
    expect(parseInsightRow({ ad_id: "300" })).toBeNull();
    expect(parseInsightRow(null)).toBeNull();
    expect(parseInsightRow({ ad_id: "300", date_start: "2026-11-10" })?.spend).toBe(0);
  });

  it("explains Graph errors in plain words", () => {
    expect(graphErrorMessage({ status: 400, code: 190 })).toMatch(/expired/);
    expect(graphErrorMessage({ status: 403, code: 200 })).toMatch(/ads_read/);
    expect(graphErrorMessage({ status: 400, code: 10 })).toMatch(/ads_read/);
    expect(graphErrorMessage({ status: 400, code: 17 })).toMatch(/Try again in an hour/);
    expect(graphErrorMessage({ status: 400, code: 80004 })).toMatch(/Try again in an hour/);
    expect(graphErrorMessage({ status: 429 })).toMatch(/Try again in an hour/);
    expect(
      graphErrorMessage({
        status: 400,
        code: 100,
        message: "Object with ID 'act_1' does not exist",
      }),
    ).toMatch(/cannot find this ad account/);
    expect(graphErrorMessage({ status: 500 })).toMatch(/temporary/);
    expect(graphErrorMessage({ status: 400, code: 999 })).toBe(
      "Meta refused the request (code 999).",
    );
  });
});

describe("money and links", () => {
  it("shows the last sync in Dubai time", () => {
    expect(syncTimeLabel("2026-11-19T06:30:00Z")).toBe("19 Nov 2026, 10:30");
    expect(syncTimeLabel(null)).toBe("not yet");
  });

  it("labels the account currency instead of converting", () => {
    expect(money(1250.5, "AED")).toBe("AED 1,250.5");
    expect(money(1250, "USD")).toBe("USD 1,250");
    expect(money(null, "AED")).toBe("—");
    expect(moneyBackLabel("AED")).toBe("AED back per AED 1 spent");
    expect(moneyBackLabel("USD")).toBe("AED GCI per USD 1 spent");
  });

  it("links to Ads Manager without changing anything", () => {
    expect(adsManagerUrl("act_123")).toBe(
      "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=123",
    );
    expect(adsManagerUrl("act_123", "ad", "300")).toBe(
      "https://adsmanager.facebook.com/adsmanager/manage/ads?act=123&selected_ad_ids=300",
    );
    expect(adsManagerUrl("act_123", "adset", "200")).toContain(
      "adsets?act=123&selected_adset_ids=200",
    );
  });
});

describe("verdict rules", () => {
  it("nothing spent and no leads → Watch", () => {
    expect(
      verdictFor(
        m({ spend: 0, leads: 0, replyRatePct: null, costPerLead: null, moneyBack: null }),
        "AED",
      ),
    ).toEqual({
      verdict: "watch",
      reason: "No spend and no leads in this period.",
    });
  });

  it("a deal with money back at the target → Keep", () => {
    const v = verdictFor(
      m({ spend: 10_000, deals: 1, gci: 50_000, moneyBack: KEEP_MIN_MONEY_BACK }),
      "AED",
    );
    expect(v.verdict).toBe("keep");
    expect(v.reason).toBe("1 deal, AED 50,000 GCI: AED 5 back for every AED 1 spent.");
  });

  it("a deal but low money back → Watch", () => {
    const v = verdictFor(m({ spend: 20_000, deals: 2, gci: 40_000, moneyBack: 2 }), "AED");
    expect(v.verdict).toBe("watch");
    expect(v.reason).toMatch(/2 deals.*only AED 2 back/);
  });

  it("a deal with zero spend in the period → Keep", () => {
    expect(verdictFor(m({ spend: 0, deals: 1, gci: 30_000, moneyBack: null }), "AED").verdict).toBe(
      "keep",
    );
  });

  it("no deal and spend at the threshold → Wasting money", () => {
    const v = verdictFor(m({ spend: WASTE_MIN_SPEND_AED, leads: 12 }), "AED");
    expect(v).toEqual({ verdict: "waste", reason: "AED 3,000 spent, 12 leads, no deal." });
  });

  it("spend but no leads matched → Watch, check the intake", () => {
    const v = verdictFor(m({ spend: 800, leads: 0, replyRatePct: null, costPerLead: null }), "AED");
    expect(v.verdict).toBe("watch");
    expect(v.reason).toMatch(/no leads in the CRM/);
  });

  it("cheap leads but under half replied → Watch, cheap leads no buyers", () => {
    const v = verdictFor(
      m({
        spend: 1000,
        leads: 10,
        costPerLead: GOOD_CPL_AED,
        replyRatePct: LOW_REPLY_RATE_PCT - 1,
      }),
      "AED",
    );
    expect(v.verdict).toBe("watch");
    expect(v.reason).toMatch(/^Cheap leads, no buyers: AED 150 a lead but only 49% replied/);
  });

  it("reply rate is not judged from too few leads", () => {
    const v = verdictFor(m({ spend: 600, leads: 4, costPerLead: 150, replyRatePct: 0 }), "AED");
    expect(v.reason).not.toMatch(/Cheap leads/);
  });

  it("expensive leads → Watch", () => {
    const v = verdictFor(m({ spend: 2000, leads: 4, costPerLead: HIGH_CPL_AED + 100 }), "AED");
    expect(v.reason).toBe("Leads are expensive: AED 500 each, no deal yet.");
  });

  it("small spend → too early", () => {
    const v = verdictFor(
      m({ spend: MIN_SPEND_TO_JUDGE_AED - 1, leads: 3, costPerLead: 166 }),
      "AED",
    );
    expect(v.reason).toBe("Too early to judge: AED 499 spent so far.");
  });

  it("otherwise → Watch, no deal yet", () => {
    const v = verdictFor(m({ spend: 1500, leads: 10, costPerLead: 150, replyRatePct: 70 }), "AED");
    expect(v).toEqual({ verdict: "watch", reason: "No deal yet. 10 leads, 70% replied." });
  });

  it("a non-AED account is never called wasting money and money back is not judged", () => {
    expect(verdictFor(m({ spend: 50_000, leads: 2 }), "USD")).toEqual({
      verdict: "watch",
      reason:
        "No deal yet. Spend is in USD and the CRM does not convert currencies, so it does not call this ad wasting money.",
    });
    expect(verdictFor(m({ spend: 50_000, deals: 1, gci: 10, moneyBack: 0 }), "USD").verdict).toBe(
      "keep",
    );
    expect(verdictFor(m({ spend: 500, leads: 10, replyRatePct: 20 }), "USD").reason).toMatch(
      /Only 20% replied/,
    );
  });
});

describe("metaAdsReport", () => {
  it("zero spend and zero leads gives no rows and no suggestion", () => {
    const r = report();
    expect(r.rows).toEqual([]);
    expect(r.suggestion).toBeNull();
    expect(r.totals).toMatchObject({
      spend: 0,
      leads: 0,
      costPerLead: null,
      moneyBack: null,
      replyRatePct: null,
    });
  });

  it("adds up spend, leads, replies, viewings, deals, GCI, quality and duplicates per ad", () => {
    const leads = [
      lead({ id: "a", score: "Hot", client_replied: true }),
      lead({ id: "b", score: "Cold" }),
      lead({ id: "c", score: "", client_replied: true }),
      lead({ id: "old", created_at: "2026-10-01T08:00:00Z" }), // before the period
    ];
    const r = report({
      insights: [
        ins({ date: "2026-11-09", spend: 400, meta_leads: 2, ad_name: "Old name" }),
        ins({ date: "2026-11-10", spend: 600, meta_leads: 2 }),
        ins({ date: "2026-10-15", spend: 999 }), // outside the period
      ],
      leads,
      viewings: [
        { lead_id: "a", status: "done" },
        { lead_id: "a", status: "cancelled" },
        { lead_id: "c", status: "booked" },
        { lead_id: "old", status: "done" },
      ],
      deals: [
        { lead_id: "a", status: "closed", price_aed: 2_000_000, commission_percent: 2 },
        { lead_id: "b", status: "under offer", price_aed: 1_000_000, commission_percent: 2 },
      ],
      hits: [
        {
          created_at: "2026-11-12T08:00:00Z",
          duplicate: true,
          meta_ad_id: "300",
          meta_adset_id: null,
          meta_campaign_id: null,
        },
        {
          created_at: "2026-11-12T08:00:00Z",
          duplicate: false,
          meta_ad_id: "300",
          meta_adset_id: null,
          meta_campaign_id: null,
        },
      ],
    });
    expect(r.rows).toHaveLength(1);
    const row = r.rows[0]!;
    expect(row).toMatchObject({
      id: "300",
      name: "Video A",
      parent: "Marina buyers",
      spend: 1000,
      metaLeads: 4,
      leads: 3,
      leadIds: ["a", "b", "c"],
      costPerLead: 333.33,
      replied: 2,
      replyRatePct: 67,
      viewings: 2,
      viewingsDone: 1,
      deals: 1,
      gci: 40_000,
      moneyBack: 40,
      hot: 1,
      warm: 0,
      cold: 1,
      unscored: 1,
      duplicates: 1,
      verdict: "keep",
    });
  });

  it("rolls ads up to ad sets and campaigns, using the ad's place when a lead only has an ad id", () => {
    const input = {
      insights: [
        ins({ ad_id: "300", spend: 500 }),
        ins({ ad_id: "301", ad_name: "Video B", spend: 700 }),
        ins({ ad_id: "302", adset_id: "201", adset_name: "Europe", spend: 300 }),
      ],
      leads: [
        lead({ meta_ad_id: "300" }),
        lead({ meta_ad_id: "302" }),
        lead({ meta_ad_id: null, meta_adset_id: "201" }),
      ],
    };
    const adsets = report({ ...input, level: "adset" });
    expect(adsets.rows.map((x) => [x.id, x.spend, x.leads])).toEqual(
      [
        ["200", 1200, 1],
        ["201", 300, 2],
      ].sort((a, b) => Number(b[1]) - Number(a[1])),
    );
    const campaigns = report({ ...input, level: "campaign" });
    expect(campaigns.rows).toHaveLength(1);
    expect(campaigns.rows[0]).toMatchObject({
      id: "100",
      name: "Marina buyers",
      spend: 1500,
      leads: 3,
      parent: "",
    });
  });

  it("counts leads with no ad id as unmatched, and keeps a lead whose ad has no spend in the period", () => {
    const r = report({
      insights: [ins({ spend: 100 })],
      leads: [
        lead({ meta_ad_id: null }),
        lead({ meta_ad_id: "999" }), // ad not in the synced insights
      ],
    });
    expect(r.unmatchedLeads).toBe(1);
    const unknown = r.rows.find((x) => x.id === "999")!;
    expect(unknown).toMatchObject({
      name: "Ad 999",
      spend: 0,
      leads: 1,
      costPerLead: null,
      moneyBack: null,
    });
  });

  it("labels the currency and suggests moving budget from the worst Wasting ad to the best Keep ad", () => {
    const insights = [
      ins({ ad_id: "1", ad_name: "Keeper", spend: 3000 }),
      ins({ ad_id: "2", ad_name: "Big waste", spend: 6000 }),
      ins({ ad_id: "3", ad_name: "Small waste", spend: 3500 }),
    ];
    const leads = [lead({ id: "k", meta_ad_id: "1" }), lead({ meta_ad_id: "2" })];
    const deals = [{ lead_id: "k", status: "closed", price_aed: 1_500_000, commission_percent: 2 }];
    const r = report({ insights, leads, deals });
    expect(r.moneyBackLabel).toBe("AED back per AED 1 spent");
    expect(r.rows.map((x) => x.verdict)).toEqual(["keep", "waste", "waste"]);
    expect(r.suggestion).toMatchObject({ fromId: "2", toId: "1", dailyAmount: 200 });
    expect(r.suggestion?.text).toBe(
      'Move about AED 200 a day from "Big waste" (no deal) to "Keeper" (10 AED back per AED 1 spent). Make the change yourself in Meta Ads Manager — the CRM does not change ads.',
    );

    const usd = report({ insights, leads, deals, currency: "USD" });
    expect(usd.moneyBackLabel).toBe("AED GCI per USD 1 spent");
    expect(usd.rows.some((x) => x.verdict === "waste")).toBe(false);
    expect(usd.suggestion).toBeNull();
  });
});

describe("sorting and suggestion edges", () => {
  const r = (id: string, moneyBack: number | null, spend: number) =>
    ({ id, moneyBack, spend }) as { id: string; moneyBack: number | null; spend: number };

  it("sorts by money back with no-spend rows last", () => {
    const rows = [r("a", 2, 10), r("b", null, 0), r("c", 9, 5), r("d", 2, 50)];
    expect(sortByMoneyBack(rows).map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
    expect(sortByMoneyBack(rows, "asc").map((x) => x.id)).toEqual(["d", "a", "c", "b"]);
  });

  it("no suggestion without both a Keep and a Wasting row", () => {
    const row = (verdict: MetaAdRow["verdict"]) =>
      ({ id: verdict, name: verdict, verdict, spend: 100, moneyBack: 1 }) as MetaAdRow;
    expect(budgetSuggestion([row("waste")], "AED", 30)).toBeNull();
    expect(budgetSuggestion([row("keep")], "AED", 30)).toBeNull();
    expect(budgetSuggestion([], "AED", 0)).toBeNull();
  });
});
