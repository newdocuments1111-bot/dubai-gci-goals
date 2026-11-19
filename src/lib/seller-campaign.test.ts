import { describe, expect, it } from "vitest";
import {
  MAX_CAMPAIGN_LEADS,
  campaignSchema,
  explicitAudience,
  pickRecipients,
  shouldTagAsSeller,
} from "./campaigns";
import {
  clearSellerHandoff,
  readSellerHandoff,
  resolveSellerAudience,
  sellerSelection,
  setSellerHandoff,
  type PickLead,
} from "./seller-campaign";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lead = (n: number, over: Partial<PickLead> = {}): PickLead => ({
  id: id(n),
  phone: `+97150${String(1000000 + n)}`,
  opted_in: true,
  stopped: false,
  do_not_call: false,
  ...over,
});

describe("Seller Finder → campaign audience", () => {
  it("keeps past buyers with consent and gives a reason for everyone left out", () => {
    const leads = [
      lead(1),
      lead(2, { opted_in: false }),
      lead(3, { stopped: true }),
      lead(4, { do_not_call: true }),
      lead(5, { phone: "" }),
    ];
    const r = resolveSellerAudience({
      picks: [1, 2, 3, 4, 5, 6].map((n) => ({ kind: "past buyer" as const, id: id(n) })),
      owners: [],
      leads,
    });
    expect(r.leadIds).toEqual([id(1)]);
    expect(r.skipped).toMatchObject({
      no_consent: 1,
      stopped: 1,
      do_not_call: 1,
      no_number: 1,
      no_lead: 1,
    });
    expect(r.rows.map((x) => x.reason)).toEqual([
      null,
      "no_consent",
      "stopped",
      "do_not_call",
      "no_number",
      "no_lead",
    ]);
  });

  it("reaches an owner only through a consenting lead with the same phone", () => {
    const leads = [
      lead(1, { phone: "050 100 0001" }),
      lead(2, { phone: "+971 50 100 0002", opted_in: false }),
    ];
    const r = resolveSellerAudience({
      picks: [
        { kind: "owner", id: id(101) },
        { kind: "owner", id: id(102) },
        { kind: "owner", id: id(103) },
        { kind: "owner", id: id(104) },
      ],
      owners: [
        { id: id(101), phone: "+971501000001" }, // matches lead 1 (consent)
        { id: id(102), phone: "0501000002" }, // matches lead 2 (no consent)
        { id: id(103), phone: "+971509999999" }, // no lead at all
        { id: id(104), phone: "" }, // no phone
      ],
      leads,
    });
    expect(r.leadIds).toEqual([id(1)]);
    expect(r.skipped.no_consent).toBe(1);
    expect(r.skipped.no_lead).toBe(2);
  });

  it("prefers the consenting lead when an owner's phone is on several leads", () => {
    const r = resolveSellerAudience({
      picks: [{ kind: "owner", id: id(101) }],
      owners: [{ id: id(101), phone: "0501000001" }],
      leads: [lead(1, { opted_in: false }), lead(2, { phone: "+971501000001" })],
    });
    expect(r.leadIds).toEqual([id(2)]);
  });

  it("never reaches a phone that said STOP or is do-not-call on any lead", () => {
    const r = resolveSellerAudience({
      picks: [
        { kind: "owner", id: id(101) },
        { kind: "past buyer", id: id(3) },
      ],
      owners: [{ id: id(101), phone: "0501000001" }],
      leads: [
        lead(1),
        lead(2, { phone: "+971501000001", stopped: true }),
        lead(3),
        lead(4, { phone: "0501000003", do_not_call: true }),
      ],
    });
    expect(r.leadIds).toEqual([]);
    expect(r.skipped.stopped).toBe(1);
    expect(r.skipped.do_not_call).toBe(1);
  });

  it("sends once per phone: an owner who is also a picked past buyer is a duplicate", () => {
    const r = resolveSellerAudience({
      picks: [
        { kind: "past buyer", id: id(1) },
        { kind: "owner", id: id(101) },
        { kind: "past buyer", id: id(1) },
        { kind: "past buyer", id: id(2) },
      ],
      owners: [{ id: id(101), phone: "0501000001" }],
      leads: [lead(1), lead(2, { phone: "+971 50 100 0001" })],
    });
    expect(r.leadIds).toEqual([id(1)]);
    expect(r.skipped.duplicate).toBe(2);
  });

  it("stops at the campaign limit and counts the rest", () => {
    const leads = [1, 2, 3].map((n) => lead(n));
    const r = resolveSellerAudience({
      picks: leads.map((l) => ({ kind: "past buyer" as const, id: l.id })),
      owners: [],
      leads,
      max: 2,
    });
    expect(r.leadIds).toHaveLength(2);
    expect(r.skipped.over_limit).toBe(1);
  });

  it("names the selection: all, only High, or picked", () => {
    const c = [
      { id: id(1), kind: "owner" as const, score: "High" as const },
      { id: id(2), kind: "past buyer" as const, score: "Medium" as const },
      { id: id(3), kind: "past buyer" as const, score: "High" as const },
    ];
    expect(sellerSelection(c, "all").label).toBe("Likely to sell · All (3)");
    const high = sellerSelection(c, "high");
    expect(high.label).toBe("Likely to sell · High (2)");
    expect(high.picks).toEqual([
      { kind: "owner", id: id(1) },
      { kind: "past buyer", id: id(3) },
    ]);
    const ticked = sellerSelection(c, "ticked", new Set([`past buyer-${id(2)}`]));
    expect(ticked).toEqual({
      picks: [{ kind: "past buyer", id: id(2) }],
      label: "Likely to sell · Picked (1)",
    });
  });

  it("hands over lead ids only, for a short time", () => {
    setSellerHandoff(
      {
        label: "x",
        leadIds: [id(1)],
        picked: 1,
        skipped: resolveSellerAudience({ picks: [], owners: [], leads: [] }).skipped,
      },
      1000,
    );
    expect(readSellerHandoff(2000)?.leadIds).toEqual([id(1)]);
    expect(readSellerHandoff(1000 + 31 * 60_000)).toBeNull();
    setSellerHandoff({
      label: "x",
      leadIds: [id(1)],
      picked: 1,
      skipped: resolveSellerAudience({ picks: [], owners: [], leads: [] }).skipped,
    });
    clearSellerHandoff();
    expect(readSellerHandoff()).toBeNull();
  });
});

describe("campaign with picked leads", () => {
  const base = {
    name: "Price check",
    audienceLabel: "Likely to sell · High (2)",
    steps: [{ templateId: id(900), afterDays: 0 }],
    defaults: {},
  };

  it("accepts a list of lead ids instead of a filter", () => {
    expect(
      campaignSchema.safeParse({ ...base, leadIds: [id(1)], source: "seller_finder" }).success,
    ).toBe(true);
    expect(campaignSchema.safeParse({ ...base, filter: {} }).success).toBe(true);
  });

  it("refuses bad, empty, too many, or both kinds of audience", () => {
    expect(campaignSchema.safeParse({ ...base, leadIds: ["not-a-uuid"] }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, leadIds: [] }).success).toBe(false);
    expect(campaignSchema.safeParse(base).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, filter: {}, leadIds: [id(1)] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_CAMPAIGN_LEADS + 1 }, (_, i) => id(i + 1));
    expect(campaignSchema.safeParse({ ...base, leadIds: tooMany }).success).toBe(false);
    // Seller Finder source only with picked leads.
    expect(campaignSchema.safeParse({ ...base, filter: {}, source: "seller_finder" }).success).toBe(
      false,
    );
    expect(campaignSchema.safeParse({ ...base, leadIds: [id(1)], source: "other" }).success).toBe(
      false,
    );
  });

  it("only keeps ids that are leads of this agency, each once", () => {
    const rows = [{ id: id(1) }, { id: id(2) }];
    expect(explicitAudience([id(2), id(9), id(2), id(1)], rows)).toEqual({
      leads: [{ id: id(2) }, { id: id(1) }],
      notFound: 1,
    });
  });

  it("applies the same consent rules as filter audiences, plus do-not-call", () => {
    const row = (
      over: Partial<{ opted_in: boolean; stopped: boolean; do_not_call: boolean; phone: string }>,
    ) => ({
      name: "Sara Ali",
      area: "Marina",
      phone: "+971501234567",
      opted_in: true,
      stopped: false,
      do_not_call: false,
      ...over,
    });
    const leads = [
      row({}),
      row({ opted_in: false }),
      row({ stopped: true }),
      row({ do_not_call: true }),
      row({ phone: "12" }),
    ];
    const picked = pickRecipients(leads, ["name"], {}, { checkDoNotCall: true, notFound: 2 });
    expect(picked.recipients).toHaveLength(1);
    expect(picked.recipients[0]!.values).toEqual({ name: "Sara" });
    expect(picked.skipped).toEqual({
      stopped: 1,
      noConsent: 1,
      noNumber: 1,
      missingDetails: 0,
      overLimit: 0,
      doNotCall: 1,
      notFound: 2,
    });
    // Filter audiences keep their old rules (do-not-call is about phone calls there).
    expect(pickRecipients(leads, [], {}).recipients).toHaveLength(2);
  });

  it("caps picked audiences at the campaign limit", () => {
    const many = Array.from({ length: MAX_CAMPAIGN_LEADS + 3 }, () => ({
      name: "A",
      area: "",
      phone: "+971501234567",
      opted_in: true,
      stopped: false,
    }));
    const r = pickRecipients(many, [], {});
    expect(r.recipients).toHaveLength(MAX_CAMPAIGN_LEADS);
    expect(r.skipped.overLimit).toBe(3);
  });

  it("marks queued clients as sellers, never open buyer or tenant files", () => {
    expect(shouldTagAsSeller({ type: "buyer", outcome: "won" })).toBe(true);
    expect(shouldTagAsSeller({ type: "other", outcome: "open" })).toBe(true);
    expect(shouldTagAsSeller({ type: "buyer", outcome: "open" })).toBe(false);
    expect(shouldTagAsSeller({ type: "tenant", outcome: "open" })).toBe(false);
    expect(shouldTagAsSeller({ type: "seller", outcome: "won" })).toBe(false);
    expect(shouldTagAsSeller({ type: "landlord", outcome: "won" })).toBe(false);
  });
});
