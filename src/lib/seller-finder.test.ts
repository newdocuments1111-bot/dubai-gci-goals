import { describe, expect, it } from "vitest";
import {
  dateWords,
  draftSellerMessage,
  findSellers,
  type FinderDeal,
  type FinderLead,
  type FinderListing,
  type FinderOwner,
} from "./seller-finder";
import { hasArabic } from "./i18n";

const now = new Date("2026-11-18T10:00:00Z");

const owner = (o: Partial<FinderOwner> & { id: string }): FinderOwner => ({
  name: `Owner ${o.id}`,
  phone: "",
  kind: "owner",
  intent: "unknown",
  stage: "prospect",
  area: "",
  building: "",
  lease_end: null,
  handover_date: null,
  ...o,
});
const listing = (l: Partial<FinderListing> & { id: string }): FinderListing => ({
  owner_id: null,
  status: "Sold",
  title: "2 bed in Marina Gate",
  community: "Marina",
  project: "Marina Gate",
  handover_date: null,
  ...l,
});
const deal = (d: Partial<FinderDeal> & { id: string }): FinderDeal => ({
  lead_id: "b1",
  listing_id: "l1",
  deal_type: "sale",
  track: "ready",
  status: "closed",
  closed_at: "2023-03-14T09:00:00Z",
  ...d,
});
const lead = (l: Partial<FinderLead> & { id: string }): FinderLead => ({
  name: "Sara Khan",
  phone: "+971 50 111 2222",
  do_not_call: false,
  stopped: false,
  opted_in: true,
  ...l,
});
const find = (rows: {
  owners?: FinderOwner[];
  listings?: FinderListing[];
  deals?: FinderDeal[];
  leads?: FinderLead[];
}) => findSellers({ owners: [], listings: [], deals: [], leads: [], ...rows }, now);

describe("seller finder: past buyers", () => {
  it("finds a buyer whose purchase closed two or more years ago", () => {
    const out = find({
      deals: [deal({ id: "d1" })],
      listings: [listing({ id: "l1" })],
      leads: [lead({ id: "b1" })],
    });
    expect(out).toEqual([
      expect.objectContaining({
        id: "b1",
        name: "Sara Khan",
        kind: "past buyer",
        score: "Medium",
        reasons: ["Bought in Marina in March 2023"],
        unitLabel: "2 bed in Marina Gate",
        leadId: "b1",
      }),
    ]);
  });

  it("uses the exact two-year line and leaves out the area when there is no listing", () => {
    const rows = (closed_at: string) => ({
      deals: [deal({ id: "d1", listing_id: null, closed_at })],
      leads: [lead({ id: "b1" })],
    });
    expect(find(rows("2024-11-18T08:00:00Z"))[0]?.reasons).toEqual(["Bought in November 2024"]);
    expect(find(rows("2024-11-19T08:00:00Z"))).toEqual([]);
  });

  it("ignores rentals, open deals, deals without a lead and homes we later sold to someone else", () => {
    const leads = [lead({ id: "b1" }), lead({ id: "b2", name: "Next Buyer", phone: "0502223333" })];
    const listings = [listing({ id: "l1" })];
    expect(find({ deals: [deal({ id: "d1", deal_type: "rent" })], leads, listings })).toEqual([]);
    expect(find({ deals: [deal({ id: "d1", status: "under offer" })], leads, listings })).toEqual(
      [],
    );
    expect(find({ deals: [deal({ id: "d1", lead_id: null })], leads, listings })).toEqual([]);
    const resold = find({
      deals: [
        deal({ id: "d1" }),
        deal({ id: "d2", lead_id: "b2", closed_at: "2024-06-01T09:00:00Z" }),
      ],
      leads,
      listings,
    });
    expect(resold.map((c) => c.id)).toEqual(["b2"]);
  });

  it("skips buyers who said STOP, are do-not-call or never agreed to messages", () => {
    const rows = (l: Partial<FinderLead>) => ({
      deals: [deal({ id: "d1" })],
      listings: [listing({ id: "l1" })],
      leads: [lead({ id: "b1", ...l })],
    });
    expect(find(rows({ stopped: true }))).toEqual([]);
    expect(find(rows({ do_not_call: true }))).toEqual([]);
    expect(find(rows({ opted_in: false }))).toEqual([]);
    expect(find(rows({}))).toHaveLength(1);
  });

  it("adds an off-plan handover within six months, and makes two reasons High", () => {
    const rows = (handover_date: string, closed_at: string) => ({
      deals: [deal({ id: "d1", track: "offplan", closed_at })],
      listings: [listing({ id: "l1", handover_date })],
      leads: [lead({ id: "b1" })],
    });
    expect(find(rows("2027-03-01", "2025-06-01T09:00:00Z"))[0]).toMatchObject({
      score: "Medium",
      reasons: ["Off-plan handover due in March 2027"],
    });
    expect(find(rows("2027-03-01", "2023-06-01T09:00:00Z"))[0]).toMatchObject({
      score: "High",
      reasons: ["Bought in Marina in June 2023", "Off-plan handover due in March 2027"],
    });
    expect(find(rows("2027-09-01", "2025-06-01T09:00:00Z"))).toEqual([]); // too far away
    expect(find(rows("2026-10-01", "2025-06-01T09:00:00Z"))).toEqual([]); // already handed over
  });
});

describe("seller finder: owners", () => {
  it("flags a lease that ends within 90 days", () => {
    const reasons = (lease_end: string) =>
      find({ owners: [owner({ id: "o1", lease_end })] })[0]?.reasons;
    expect(reasons("2026-12-23")).toEqual(["Lease ends in 5 weeks"]);
    expect(reasons("2026-11-21")).toEqual(["Lease ends in 3 days"]);
    expect(reasons("2026-11-19")).toEqual(["Lease ends in 1 day"]);
    expect(reasons("2026-11-18")).toEqual(["Lease ends today"]);
    expect(reasons("2027-02-16")).toEqual(["Lease ends in 13 weeks"]); // day 90
    expect(reasons("2027-02-17")).toBeUndefined(); // day 91
  });

  it("flags a lease that has ended with no new lease", () => {
    expect(find({ owners: [owner({ id: "o1", lease_end: "2026-11-10" })] })[0]).toMatchObject({
      kind: "owner",
      score: "Medium",
      reasons: ["Lease ended on 10 November 2026, no new lease on record"],
    });
  });

  it("flags a home that is not listed, and skips owners with a live listing", () => {
    const o = owner({ id: "o1", building: "Marina Gate 1", area: "Dubai Marina" });
    expect(find({ owners: [o] })[0]).toMatchObject({
      unitLabel: "Marina Gate 1, Dubai Marina",
      reasons: ["Home at Marina Gate 1, Dubai Marina is not listed with us"],
      leadId: null,
    });
    const withListing = (status: string) =>
      find({ owners: [o], listings: [listing({ id: "l1", owner_id: "o1", status })] });
    expect(withListing("Available")).toEqual([]);
    expect(withListing("Reserved")).toEqual([]);
    expect(withListing("Sold")).toHaveLength(1);
    // no property details and nothing else known: not a candidate
    expect(find({ owners: [owner({ id: "o2" })] })).toEqual([]);
  });

  it("flags selling intent with no live listing, once, and skips owners already sold", () => {
    const o = owner({ id: "o1", intent: "sell", building: "Marina Gate 1" });
    expect(find({ owners: [o] })[0]).toMatchObject({
      score: "Medium",
      reasons: ["Marked as selling, no live listing with us"],
    });
    expect(find({ owners: [{ ...o, stage: "closed" }] })).toEqual([]);
    expect(
      find({ owners: [o], listings: [listing({ id: "l1", owner_id: "o1", status: "Available" })] }),
    ).toEqual([]);
  });

  it("flags an investor with a handover within six months only", () => {
    const reasons = (o: Partial<FinderOwner>) =>
      find({ owners: [owner({ id: "o1", ...o })] })[0]?.reasons;
    expect(reasons({ kind: "investor", handover_date: "2027-04-30" })).toEqual([
      "Off-plan handover due in April 2027",
    ]);
    expect(reasons({ kind: "investor", handover_date: "2027-06-30" })).toBeUndefined();
    expect(reasons({ kind: "investor", handover_date: "2026-11-01" })).toBeUndefined();
    expect(reasons({ kind: "owner", handover_date: "2027-04-30" })).toBeUndefined();
  });

  it("scores two reasons High and sorts High first", () => {
    const out = find({
      owners: [
        owner({ id: "o1", name: "Amal", building: "Tower A" }),
        owner({ id: "o2", name: "Zed", intent: "sell", lease_end: "2026-12-23" }),
      ],
    });
    expect(out.map((c) => [c.name, c.score])).toEqual([
      ["Zed", "High"],
      ["Amal", "Medium"],
    ]);
    expect(out[0]?.reasons).toEqual([
      "Marked as selling, no live listing with us",
      "Lease ends in 5 weeks",
    ]);
  });

  it("shows an owner who is also a past buyer once, and honours STOP on the same phone", () => {
    const rows = (l: Partial<FinderLead>, listings: FinderListing[] = []) => ({
      owners: [owner({ id: "o1", name: "Sara Khan", phone: "050 111 2222", building: "Tower A" })],
      deals: [deal({ id: "d1" })],
      listings: [listing({ id: "l1" }), ...listings],
      leads: [lead({ id: "b1", ...l })],
    });
    const out = find(rows({}));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "o1",
      kind: "owner",
      score: "High",
      leadId: "b1",
      reasons: ["Bought in Marina in March 2023", "Home at Tower A is not listed with us"],
    });
    expect(find(rows({ stopped: true }))).toEqual([]);
    expect(find(rows({ do_not_call: true }))).toEqual([]);
    // live listing with us: neither the owner row nor the buyer row is shown
    expect(find(rows({}, [listing({ id: "l2", owner_id: "o1", status: "Available" })]))).toEqual(
      [],
    );
  });
});

describe("seller finder: first message", () => {
  const [c] = find({
    owners: [owner({ id: "o1", name: "Sara Khan", intent: "sell", lease_end: "2026-12-23" })],
  });

  it("drafts a polite message from the reasons, signed with the agent's first name", () => {
    expect(c).toBeDefined();
    if (!c) return;
    expect(draftSellerMessage(c, "Omar Haddad")).toBe(
      [
        "Hello Sara,",
        "",
        "I hope you are well. I am getting in touch because you mentioned that you may want to sell and the lease on your property ends in 5 weeks.",
        "",
        "Whether you plan to keep the property, rent it out or sell, I would be glad to prepare a free price check for you. There is no cost and no obligation.",
        "",
        "If this is not of interest, just tell me and I will not message you about it again.",
        "",
        "Kind regards,",
        "Omar",
      ].join("\n"),
    );
  });

  const all = find({
    owners: [
      owner({ id: "o1", lease_end: "2026-11-10", building: "Tower A" }),
      owner({ id: "o2", kind: "investor", handover_date: "2027-03-01" }),
    ],
    deals: [deal({ id: "d1" }), deal({ id: "d2", lead_id: "b2", listing_id: null })],
    listings: [listing({ id: "l1" })],
    leads: [lead({ id: "b1" }), lead({ id: "b2", name: "", phone: "0509998888" })],
  });

  it("writes every kind of reason without price claims or pressure", () => {
    const texts = all.map((x) => draftSellerMessage(x, "Omar"));
    const joined = texts.join("\n");
    expect(joined).toContain("the lease on your property ended on 10 November 2026");
    expect(joined).toContain("we have your home at Tower A on our records");
    expect(joined).toContain("your off-plan property is due for handover in March 2027");
    expect(joined).toContain("you bought in Marina with us in March 2023");
    expect(joined).toContain(
      "Hello there,\n\nI hope you are well. I am getting in touch because you bought with us in March 2023.",
    );
    for (const text of texts) {
      expect(text).toContain("free price check");
      expect(text).not.toMatch(
        /AED|\d\s?%|prices? (are|is|have|has)|market is|hurry|last chance|act now|limited time|urgent/i,
      );
      expect(text.endsWith("Kind regards,\nOmar")).toBe(true);
    }
  });

  it("has Arabic for every reason and badge shown on the Owners page", () => {
    const parts = [
      ...all,
      ...find({
        owners: [
          owner({ id: "a", intent: "sell", lease_end: "2026-11-18" }),
          owner({ id: "b", lease_end: "2026-11-19" }),
          owner({ id: "c", lease_end: "2026-11-21" }),
          owner({ id: "d", lease_end: "2026-12-23" }),
        ],
      }),
    ].flatMap((x) => x.reasonParts.map((p) => p.text));
    expect(new Set(parts).size).toBe(10);
    expect(
      [...parts, "High", "Medium", "owner", "past buyer"].filter((x) => !hasArabic(x)),
    ).toEqual([]);
  });

  it("writes dates in words", () => {
    expect(dateWords("2023-03-14")).toBe("March 2023");
    expect(dateWords("2023-03-04", "day")).toBe("4 March 2023");
  });
});
