import { describe, expect, it } from "vitest";
import {
  REPORTS,
  parseQuestion,
  periodRange,
  reportAds,
  reportAgents,
  reportDeals,
  reportFind,
  reportHot,
  reportMissed,
  reportSources,
  reportStuck,
  type DealRow,
  type LeadRow,
  type ViewingRow,
} from "./ask";

const now = new Date("2026-11-18T10:00:00Z"); // Wednesday 14:00 in Dubai
const lead = (o: Partial<LeadRow>): LeadRow => ({
  id: "l",
  name: "Lead",
  phone: "",
  source: "Bayut",
  area: "",
  score: "Warm",
  outcome: "open",
  stage: 2,
  stage_name: "First reply",
  next_action: null,
  next_action_at: null,
  created_at: "2026-11-17T08:00:00Z",
  first_reply_at: "2026-11-17T08:01:00Z",
  assigned_agent_id: "a1",
  ad_campaign_id: null,
  ...o,
});
const members = [
  { user_id: "a1", display_name: "Ahmed", email: "" },
  { user_id: "a2", display_name: "Olga", email: "" },
];

describe("ask: understanding the question", () => {
  it("parses every suggested example without AI", () => {
    for (const r of REPORTS) expect(parseQuestion(r.example)?.report).toBe(r.id);
  });

  it("reads periods", () => {
    expect(parseQuestion("deals closing last month")?.period).toBe("last_month");
    expect(parseQuestion("who missed leads today")?.period).toBe("today");
    expect(parseQuestion("ad results this year")?.period).toBe("this_year");
    expect(parseQuestion("lead sources")?.period).toBe("this_month");
  });

  it("finds by name or phone", () => {
    expect(parseQuestion("find Sara Khan")).toMatchObject({ report: "find", search: "sara khan" });
    expect(parseQuestion("+971 50 111 2222")).toMatchObject({ report: "find" });
  });

  it("returns null when unsure", () => {
    expect(parseQuestion("what should I do about the weather")).toBeNull();
    expect(parseQuestion("   ")).toBeNull();
  });

  it("uses Dubai days and Monday weeks", () => {
    expect(periodRange("today", now)).toEqual({
      from: "2026-11-17T20:00:00.000Z",
      to: "2026-11-18T20:00:00.000Z",
    });
    expect(periodRange("this_week", now).from).toBe("2026-11-15T20:00:00.000Z");
    expect(periodRange("last_month", now)).toEqual({
      from: "2026-09-30T20:00:00.000Z",
      to: "2026-10-31T20:00:00.000Z",
    });
  });
});

describe("ask: reports from real rows", () => {
  const leads = [
    lead({
      id: "1",
      name: "Sara",
      ad_campaign_id: "c1",
      score: "Hot",
      area: "Dubai Marina",
      phone: "+971501112222",
    }),
    lead({
      id: "2",
      name: "Ivan",
      ad_campaign_id: "c1",
      source: "Property Finder",
      first_reply_at: null,
      assigned_agent_id: "a2",
    }),
    lead({ id: "3", name: "Omar", ad_campaign_id: "c2", created_at: "2026-10-05T08:00:00Z" }),
  ];
  const viewings: ViewingRow[] = [
    { lead_id: "1", status: "done", starts_at: "2026-11-17T12:00:00Z" },
  ];
  const deals: DealRow[] = [
    {
      id: "d1",
      lead_id: "1",
      agent_id: "a1",
      status: "closed",
      price_aed: 2_000_000,
      commission_percent: 2,
      closed_at: "2026-11-17T12:00:00Z",
      created_at: "2026-11-10T00:00:00Z",
    },
    {
      id: "d2",
      lead_id: "3",
      agent_id: "a1",
      status: "under offer",
      price_aed: 1_000_000,
      commission_percent: 2,
      closed_at: null,
      created_at: "2026-11-10T00:00:00Z",
    },
  ];

  it("ads: viewings and cost per viewing for the period only", () => {
    const r = reportAds(
      [
        {
          id: "c1",
          name: "Meta Marina",
          platform: "meta",
          spend_to_date_aed: 1400,
          status: "active",
        },
        {
          id: "c2",
          name: "Google JVC",
          platform: "google",
          spend_to_date_aed: 900,
          status: "paused",
        },
      ],
      leads,
      viewings,
      deals,
      "this_month",
      now,
    );
    expect(r.rows).toEqual([{ cells: ["Meta Marina", "2", "1", "1,400", "1"] }]);
    expect(r.answer).toContain(
      "Meta Marina brought the most viewings this month: 1, at AED 1,400 each",
    );
  });

  it("sources and missed leads", () => {
    expect(reportSources(leads, viewings, deals, "this_month", now).rows[0]?.cells).toEqual([
      "Bayut",
      "1",
      "100%",
      "1",
      "1",
    ]);
    const missed = reportMissed(leads, members, 15, "this_month", now);
    expect(missed.rows).toEqual([
      { cells: ["Ivan", "Property Finder", "Olga", "1 d, no reply yet"], leadId: "2" },
    ]);
  });

  it("agents: GCI and reply time", () => {
    const r = reportAgents(members, leads, viewings, deals, "this_month", now);
    expect(r.rows[0]?.cells).toEqual(["Ahmed", "1", "1 min", "1", "AED 40,000"]);
    expect(r.answer).toContain("Ahmed leads on GCI (AED 40,000)");
  });

  it("hot leads, stuck leads, deals and find", () => {
    expect(reportHot(leads, [], members).rows.map((x) => x.leadId)).toEqual(["1"]);
    expect(reportHot(leads, viewings, members).rows).toEqual([]);
    const stuck = reportStuck(
      [lead({ id: "9", next_action_at: "2026-11-18T08:00:00Z", next_action: "Send slots" })],
      members,
      now,
    );
    expect(stuck.rows[0]?.cells).toEqual(["Lead", "First reply", "Send slots", "2 h", "Ahmed"]);
    expect(reportDeals(deals, leads, members, "this_month", now).answer).toBe(
      "1 deal closed this month (AED 40,000 GCI). 1 deal under offer could add AED 20,000.",
    );
    expect(reportFind(leads, members, "1112222").rows.map((x) => x.leadId)).toEqual(["1"]);
    expect(reportFind(leads, members, "marina").rows).toHaveLength(1);
  });
});
