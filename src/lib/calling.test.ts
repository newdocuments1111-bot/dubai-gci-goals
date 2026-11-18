import { describe, expect, it } from "vitest";
import { callCheck, callTimeText } from "./calling";

/** A moment given in UAE time (UTC+4). */
const uae = (date: string, time: string) => new Date(`${date}T${time}:00+04:00`);
const check = (now: Date, callTimes: (string | Date)[] = [], doNotCall = false) =>
  callCheck({ now, doNotCall, callTimes });

describe("safe calling: do not call", () => {
  it("stops, even inside calling hours with no calls made", () => {
    const r = check(uae("2026-11-18", "11:00"), [], true);
    expect(r.level).toBe("stop");
    expect(r.messages).toEqual(["This client asked not to be called. Do not call them."]);
    expect(r.nextAllowed).toBeNull();
  });
});

describe("safe calling: hours (9am to 6pm UAE time)", () => {
  it("is closed at 08:59 and opens at 09:00 the same day", () => {
    const r = check(uae("2026-11-18", "08:59"));
    expect(r.level).toBe("stop");
    expect(r.nextAllowed).toBe(uae("2026-11-18", "09:00").toISOString());
    expect(r.messages).toEqual([
      "It is outside calling hours. Calls are allowed from 9am to 6pm UAE time.",
      "You can call again today at 9:00 am UAE time.",
    ]);
  });

  it("is open at 09:00", () => {
    expect(check(uae("2026-11-18", "09:00"))).toEqual({
      level: "ok",
      messages: [],
      nextAllowed: null,
    });
  });

  it("is open at 17:59", () => {
    expect(check(uae("2026-11-18", "17:59")).level).toBe("ok");
    expect(check(new Date("2026-11-18T13:59:59.999Z")).level).toBe("ok");
  });

  it("is closed at 18:00 and opens at 09:00 the next day", () => {
    const r = check(uae("2026-11-18", "18:00"));
    expect(r.level).toBe("stop");
    expect(r.nextAllowed).toBe(uae("2026-11-19", "09:00").toISOString());
    expect(r.messages.at(-1)).toBe("You can call again tomorrow at 9:00 am UAE time.");
  });

  it("uses UAE time, not UTC: 05:00 UTC is 09:00 in Dubai", () => {
    expect(check(new Date("2026-11-18T04:59:00Z")).level).toBe("stop");
    expect(check(new Date("2026-11-18T05:00:00Z")).level).toBe("ok");
    expect(check(new Date("2026-11-18T14:00:00Z")).level).toBe("stop");
  });

  it("just after midnight in Dubai, opens the same Dubai day", () => {
    // 20:30 UTC on the 18th is 00:30 on the 19th in Dubai.
    const r = check(new Date("2026-11-18T20:30:00Z"));
    expect(r.nextAllowed).toBe(uae("2026-11-19", "09:00").toISOString());
    expect(r.messages.at(-1)).toBe("You can call again today at 9:00 am UAE time.");
  });
});

describe("safe calling: one call a day", () => {
  it("warns when the client was already called today", () => {
    const r = check(uae("2026-11-18", "15:00"), [uae("2026-11-18", "09:30")]);
    expect(r.level).toBe("warn");
    expect(r.messages).toEqual([
      "This client was already called today. The limit is one call a day.",
      "You can call again tomorrow at 9:00 am UAE time.",
    ]);
    expect(r.nextAllowed).toBe(uae("2026-11-19", "09:00").toISOString());
  });

  it("does not count yesterday's call", () => {
    expect(check(uae("2026-11-18", "09:00"), [uae("2026-11-17", "17:59")]).level).toBe("ok");
  });

  it("splits days at midnight in Dubai, not midnight UTC", () => {
    const now = uae("2026-11-18", "10:00");
    // 23:59 on the 17th in Dubai is 19:59 UTC on the 17th: yesterday.
    expect(check(now, ["2026-11-17T19:59:00Z"]).level).toBe("ok");
    // 00:01 on the 18th in Dubai is 20:01 UTC on the 17th: today, although the UTC date differs.
    expect(check(now, ["2026-11-17T20:01:00Z"]).level).toBe("warn");
    // 03:30 on the 18th in Dubai is 23:30 UTC on the 17th: today.
    expect(check(now, ["2026-11-17T23:30:00Z"]).level).toBe("warn");
  });

  it("stops outside hours and still mentions today's call", () => {
    const r = check(uae("2026-11-18", "19:00"), [uae("2026-11-18", "10:00")]);
    expect(r.level).toBe("stop");
    expect(r.messages).toHaveLength(3);
    expect(r.nextAllowed).toBe(uae("2026-11-19", "09:00").toISOString());
  });
});

describe("safe calling: two calls a week", () => {
  const now = uae("2026-11-18", "11:00");

  it("allows a second call in the week", () => {
    expect(check(now, [uae("2026-11-15", "10:00")]).level).toBe("ok");
  });

  it("stops after two calls in the last 7 days", () => {
    const r = check(now, [uae("2026-11-16", "16:00"), uae("2026-11-13", "14:15")]);
    expect(r.level).toBe("stop");
    expect(r.messages[0]).toBe(
      "This client was already called twice in the last 7 days. The limit is two calls a week.",
    );
    // Room again once the older of the two calls is 7 days old.
    expect(r.nextAllowed).toBe(uae("2026-11-20", "14:15").toISOString());
    expect(r.messages.at(-1)).toBe("You can call again on Friday 20 Nov at 2:15 pm UAE time.");
  });

  it("counts a call 6 days 23 hours ago but not one exactly 7 days ago", () => {
    const recent = uae("2026-11-17", "10:00");
    expect(check(now, [recent, uae("2026-11-11", "12:00")]).level).toBe("stop");
    expect(check(now, [recent, uae("2026-11-11", "11:00")]).level).toBe("ok");
    expect(check(now, [recent, uae("2026-11-10", "11:00")]).level).toBe("ok");
  });

  it("moves the next allowed time into calling hours", () => {
    // The older call was at 08:00 on the 12th, so the week frees up at 08:00 on the 19th: wait for 09:00.
    const r = check(now, [uae("2026-11-17", "10:00"), uae("2026-11-12", "08:00")]);
    expect(r.level).toBe("stop");
    expect(r.nextAllowed).toBe(uae("2026-11-19", "09:00").toISOString());
  });

  it("waits for tomorrow when one of the two calls was today", () => {
    const r = check(now, [uae("2026-11-18", "09:10"), uae("2026-11-11", "15:00")]);
    expect(r.level).toBe("stop");
    expect(r.messages).toHaveLength(3);
    // The week frees up at 15:00 today, but today's call still blocks until tomorrow.
    expect(r.nextAllowed).toBe(uae("2026-11-19", "09:00").toISOString());
  });

  it("accepts calls in any order and ignores bad dates", () => {
    const r = check(now, ["not a date", uae("2026-11-13", "14:15"), uae("2026-11-16", "16:00")]);
    expect(r.nextAllowed).toBe(uae("2026-11-20", "14:15").toISOString());
    expect(check(now, ["not a date"]).level).toBe("ok");
  });
});

describe("callTimeText", () => {
  it("writes the time in UAE time", () => {
    const now = uae("2026-11-18", "11:00");
    expect(callTimeText("2026-11-18T08:30:00Z", now)).toBe("today at 12:30 pm");
    expect(callTimeText("2026-11-18T20:05:00Z", now)).toBe("tomorrow at 12:05 am");
    expect(callTimeText(uae("2026-11-23", "09:00"), now)).toBe("on Monday 23 Nov at 9:00 am");
  });
});
