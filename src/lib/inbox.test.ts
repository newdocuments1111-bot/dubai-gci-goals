import { describe, expect, it } from "vitest";
import {
  budgetAed,
  elapsed,
  languageBucket,
  matchBuyers,
  matchListings,
  normaliseSource,
  parseIntake,
  replyState,
  whatsappLink,
} from "./inbox";

const listing = (over: Partial<Parameters<typeof matchListings>[1][number]> = {}) => ({
  id: "l1",
  title: "2BR Marina Gate",
  community: "Dubai Marina",
  project: "Marina Gate",
  price_aed: 2_000_000,
  bedrooms: 2,
  status: "Available",
  ...over,
});

describe("inbox intake", () => {
  it("maps portal and ad names to our sources", () => {
    expect(normaliseSource("propertyfinder.ae")).toBe("Property Finder");
    expect(normaliseSource("BAYUT")).toBe("Bayut");
    expect(normaliseSource("Dubizzle Property")).toBe("Dubizzle");
    expect(normaliseSource("Meta Lead Ads")).toBe("Facebook");
    expect(normaliseSource("")).toBe("Other");
    expect(normaliseSource("billboard")).toBe("Other");
  });

  it("buckets languages", () => {
    expect(languageBucket("Russian")).toBe("ru");
    expect(languageBucket("ar")).toBe("ar");
    expect(languageBucket("Urdu")).toBe("hi");
    expect(languageBucket(undefined)).toBe("en");
  });

  it("parses a portal payload with other field names", () => {
    const r = parseIntake({
      first_name: "Sara",
      last_name: "K",
      mobile: "971 50 111 2222",
      source: "bayut.com",
      community: "Dubai Marina",
      message: "Is the 2BR available?",
      listing_ref: "BY-123",
      campaign: "Marina off-plan",
      extra: true,
    });
    expect(r).toEqual({
      lead: expect.objectContaining({
        name: "Sara K",
        phone: "+971501112222",
        source: "Bayut",
        area: "Dubai Marina",
        enquiry: "Is the 2BR available?",
        portal_ref: "BY-123",
        campaign: "Marina off-plan",
        type: "buyer",
      }),
    });
  });

  it("rejects a lead with no name and no phone", () => {
    expect(parseIntake({ email: "a@b.c" })).toEqual({ error: expect.any(String) });
    expect(parseIntake("nope")).toEqual({ error: expect.any(String) });
  });
});

describe("inbox matching", () => {
  it("reads budgets", () => {
    expect(budgetAed("AED 2.1M")).toBe(2_100_000);
    expect(budgetAed("1.5-2m")).toBe(2_000_000);
    expect(budgetAed("850k")).toBe(850_000);
    expect(budgetAed("2,000,000")).toBe(2_000_000);
    expect(budgetAed("flexible")).toBeNull();
  });

  it("matches on area and budget, available only", () => {
    const lead = { area: "Marina", budget: "2.1M" };
    const out = matchListings(lead, [
      listing(),
      listing({
        id: "l2",
        community: "JVC",
        project: "Bloom",
        title: "Studio",
        price_aed: 600_000,
      }),
      listing({ id: "l3", status: "Sold" }),
    ]);
    expect(out.map((m) => m.listing.id)).toEqual(["l1"]);
    expect(out[0]).toMatchObject({ areaFit: true, budgetFit: true, score: 4 });
  });

  it("finds buyers for a listing", () => {
    const leads = [
      { id: "a", area: "Dubai Marina", budget: "2M", type: "buyer", outcome: "open" },
      { id: "b", area: "Dubai Marina", budget: "2M", type: "tenant", outcome: "open" },
      { id: "c", area: "Dubai Marina", budget: "2M", type: "buyer", outcome: "lost" },
    ];
    expect(matchBuyers(listing({ status: "Sold" }), leads).map((l) => l.id)).toEqual(["a"]);
  });
});

describe("inbox display", () => {
  it("formats time", () => {
    expect(elapsed("2026-11-18T10:00:00Z", "2026-11-18T10:00:42Z")).toBe("0:42");
    expect(elapsed("2026-11-18T10:00:00Z", "2026-11-18T13:10:00Z")).toBe("3 h");
    expect(elapsed("2026-11-16T10:00:00Z", "2026-11-18T10:00:00Z")).toBe("2 d");
  });

  it("shows reply state and lateness", () => {
    const now = new Date("2026-11-18T10:06:00Z");
    expect(
      replyState(
        { created_at: "2026-11-18T10:00:00Z", first_reply_at: "2026-11-18T10:00:38Z" },
        now,
      ),
    ).toEqual({
      replied: true,
      label: "Replied in 0:38",
      late: false,
    });
    expect(
      replyState({ created_at: "2026-11-18T10:00:00Z", first_reply_at: null }, now),
    ).toMatchObject({
      replied: false,
      late: true,
    });
  });

  it("builds WhatsApp links", () => {
    expect(whatsappLink("+971 50 111 2222")).toBe("https://wa.me/971501112222");
    expect(whatsappLink("")).toBeNull();
  });
});
