import { describe, expect, it } from "vitest";
import {
  DEAL_WINDOW_DAYS,
  REASON_NO_DEAL,
  REASON_REPLY_RATE,
  REASON_SLOW_REPLY,
  REPLY_LIMIT_MINUTES,
  agentReplyRows,
  daysSinceLastDeal,
  leadReplyState,
  median,
  minutesText,
  waitingLeads,
  type ReplyDeal,
  type ReplyLead,
} from "./replyspeed";

const now = new Date("2026-11-18T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => ago(days * 1440);

let n = 0;
/** A lead created `createdAgo` minutes ago, replied after `replyAfter` minutes (null = no reply). */
const lead = (
  createdAgo: number,
  replyAfter: number | null,
  o: Partial<ReplyLead> = {},
): ReplyLead => ({
  id: `l${++n}`,
  name: "Sara Khan",
  source: "Property Finder",
  created_at: ago(createdAgo),
  first_reply_at: replyAfter === null ? null : ago(createdAgo - replyAfter),
  assigned_agent_id: "a1",
  outcome: "open",
  ...o,
});
const deal = (days: number, o: Partial<ReplyDeal> = {}): ReplyDeal => ({
  agent_id: "a1",
  status: "closed",
  closed_at: daysAgo(days),
  ...o,
});
const agents = [{ user_id: "a1", name: "Aisha" }];
const one = (leads: ReplyLead[], deals: ReplyDeal[] = [deal(10)]) => {
  const row = agentReplyRows(agents, leads, deals, now)[0];
  if (!row) throw new Error("no row");
  return row;
};

describe("thresholds", () => {
  it("uses Property Finder's published numbers", () => {
    expect(REPLY_LIMIT_MINUTES).toBe(120);
    expect(DEAL_WINDOW_DAYS).toBe(90);
    expect(REASON_REPLY_RATE).toBe("Reply rate under 80%");
    expect(REASON_NO_DEAL).toBe("No deal in 90 days");
    expect(REASON_SLOW_REPLY).toBe("Typical reply slower than 2 hours");
  });
});

describe("median", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([9, 1, 5])).toBe(5);
    expect(median([1, 3, 5, 100])).toBe(4);
  });
});

describe("leadReplyState", () => {
  it("counts a reply at exactly 2 hours as in time and one second later as missed", () => {
    expect(leadReplyState(lead(500, 120), now)).toBe("in time");
    expect(leadReplyState(lead(500, 120 + 1 / 60), now)).toBe("missed");
  });
  it("leaves an unanswered lead alone until it is older than 2 hours", () => {
    expect(leadReplyState(lead(5, null), now)).toBe("still in time");
    expect(leadReplyState(lead(120, null), now)).toBe("still in time");
    expect(leadReplyState(lead(121, null), now)).toBe("missed");
  });
  it("treats a reply stamped before the lead as an instant reply", () => {
    expect(leadReplyState(lead(60, -5), now)).toBe("in time");
  });
});

describe("agentReplyRows", () => {
  it("counts leads, median and rate, leaving young unanswered leads out of the rate", () => {
    const row = one([
      lead(1000, 10),
      lead(1000, 30),
      lead(1000, 200),
      lead(1000, null),
      lead(30, null),
    ]);
    expect(row.leads).toBe(5);
    expect(row.repliedInTime).toBe(2);
    expect(row.missed).toBe(2);
    expect(row.stillInTime).toBe(1);
    expect(row.medianReplyMinutes).toBe(30);
    expect(row.repliedInTimePercent).toBe(50);
    expect(row.status).toBe("at risk");
    expect(row.reasons).toEqual([REASON_REPLY_RATE]);
  });

  it("is on track at exactly 80% and at risk just below", () => {
    const at80 = one([...Array.from({ length: 4 }, () => lead(1000, 5)), lead(1000, null)]);
    expect(at80.repliedInTimePercent).toBe(80);
    expect(at80.status).toBe("on track");
    expect(at80.reasons).toEqual([]);
    const below = one([...Array.from({ length: 3 }, () => lead(1000, 5)), lead(1000, null)]);
    expect(below.repliedInTimePercent).toBe(75);
    expect(below.reasons).toEqual([REASON_REPLY_RATE]);
  });

  it("flags a typical reply slower than 2 hours, but not one of exactly 2 hours", () => {
    const slow = one([lead(1000, 121), lead(1000, 300), lead(1000, 5)]);
    expect(slow.medianReplyMinutes).toBe(121);
    expect(slow.reasons).toEqual([REASON_REPLY_RATE, REASON_SLOW_REPLY]);
    const exact = one([lead(1000, 120)]);
    expect(exact.medianReplyMinutes).toBe(120);
    expect(exact.reasons).toEqual([]);
  });

  it("only looks at leads created in the period and assigned to the agent", () => {
    const leads = [
      lead(60 * 24 * 29, 5),
      lead(60 * 24 * 31, null),
      lead(1000, null, { assigned_agent_id: "a2" }),
      lead(1000, null, { assigned_agent_id: null }),
    ];
    expect(one(leads).leads).toBe(1);
    expect(agentReplyRows(agents, leads, [deal(1)], now, 60)[0]?.leads).toBe(2);
  });

  it("gives no rate and no reply reasons when there is nothing to count yet", () => {
    const row = one([lead(10, null)]);
    expect(row.repliedInTimePercent).toBeNull();
    expect(row.medianReplyMinutes).toBeNull();
    expect(row.status).toBe("on track");
  });

  it("applies the 90-day deal rule at the boundary", () => {
    expect(one([], [deal(90)]).reasons).toEqual([]);
    expect(one([], [deal(90)]).daysSinceLastDeal).toBe(90);
    expect(one([], [deal(90.01)]).reasons).toEqual([REASON_NO_DEAL]);
    expect(one([], [deal(200), deal(3)]).daysSinceLastDeal).toBe(3);
  });

  it("ignores deals that are not closed or belong to someone else", () => {
    const row = one(
      [],
      [
        deal(1, { status: "under_offer" }),
        deal(1, { agent_id: "a2" }),
        deal(1, { closed_at: null }),
      ],
    );
    expect(row.daysSinceLastDeal).toBeNull();
    expect(row.status).toBe("at risk");
    expect(row.reasons).toEqual([REASON_NO_DEAL]);
  });

  it("lists agents at risk first", () => {
    const rows = agentReplyRows(
      [
        { user_id: "a1", name: "Aisha" },
        { user_id: "a2", name: "Bilal" },
      ],
      [],
      [deal(1)],
      now,
    );
    expect(rows.map((r) => r.userId)).toEqual(["a2", "a1"]);
  });
});

describe("daysSinceLastDeal", () => {
  it("returns whole days or null", () => {
    expect(daysSinceLastDeal([deal(2.9)], "a1", now)).toBe(2);
    expect(daysSinceLastDeal([], "a1", now)).toBeNull();
  });
});

describe("waitingLeads", () => {
  it("lists open unanswered leads, least time left first", () => {
    const rows = waitingLeads(
      [
        lead(10, null, { id: "fresh" }),
        lead(300, null, { id: "late" }),
        lead(110, null, { id: "close" }),
        lead(50, 5, { id: "replied" }),
        lead(50, null, { id: "lost", outcome: "lost" }),
      ],
      now,
    );
    expect(rows.map((r) => r.id)).toEqual(["late", "close", "fresh"]);
    expect(rows[0]).toMatchObject({ minutesWaited: 300, minutesLeft: -180, overdue: true });
    expect(rows[1]).toMatchObject({ minutesWaited: 110, minutesLeft: 10, overdue: false });
  });
  it("is not overdue at exactly 2 hours", () => {
    expect(waitingLeads([lead(120, null)], now)[0]).toMatchObject({
      minutesLeft: 0,
      overdue: false,
    });
    expect(waitingLeads([lead(121, null)], now)[0]?.overdue).toBe(true);
  });
  it("names a lead without a name", () => {
    expect(waitingLeads([lead(5, null, { name: " " })], now)[0]?.name).toBe("Unnamed lead");
  });
});

describe("minutesText", () => {
  it("formats minutes, hours and days", () => {
    expect(minutesText(0.4)).toBe("0 min");
    expect(minutesText(42)).toBe("42 min");
    expect(minutesText(120)).toBe("2 h");
    expect(minutesText(125)).toBe("2 h 5 min");
    expect(minutesText(1440 * 3 + 240)).toBe("3 d 4 h");
  });
});
