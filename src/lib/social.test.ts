import { describe, expect, it } from "vitest";
import { hashtags, postProblems, socialCaption, type SocialListing } from "./social";

const listing: SocialListing = {
  title: "2-bed with full marina view",
  community: "Dubai Marina",
  project: "Marina Gate 2",
  property_type: "Apartment",
  bedrooms: 2,
  size_sqft: 1240,
  price_aed: 2400000,
  completion: "ready",
  handover_date: null,
  permit_number: "7123456789",
  is_sample: false,
};
const agency = {
  agency: "Kingswear Properties",
  agent: "Sara Khan",
  mobile: "+971 50 123 4567",
  reraBrn: "12345",
};

describe("social caption", () => {
  it("includes the permit number, price and contact", () => {
    const c = socialCaption(listing, agency);
    expect(c).toContain("Permit number 7123456789");
    expect(c).toContain("AED 2,400,000");
    expect(c).toContain("Call or WhatsApp Sara Khan · +971 50 123 4567");
    expect(c).toContain("Marina Gate 2, Dubai Marina");
    expect(c).toContain("2 bed · 1,240 sq ft · Apartment · Ready to move in");
  });

  it("names a studio and an off-plan handover", () => {
    const c = socialCaption(
      { ...listing, bedrooms: 0, completion: "off-plan", handover_date: "2027-06-30" },
      agency,
    );
    expect(c).toContain("Studio");
    expect(c).toContain("Off-plan, handover 2027-06-30");
  });

  it("leaves out details the agency has not filled in", () => {
    const c = socialCaption(listing, { agency: "Kingswear", agent: "", mobile: "", reraBrn: "" });
    expect(c).not.toContain("Call or WhatsApp");
    expect(c).not.toContain("RERA");
    expect(c).not.toMatch(/\n\n\n/);
  });

  it("builds hashtags from the area and type", () => {
    expect(hashtags(listing)).toEqual([
      "#Dubai",
      "#DubaiRealEstate",
      "#DubaiMarina",
      "#ApartmentForSale",
    ]);
    expect(hashtags({ ...listing, completion: "off-plan" })).toContain("#OffPlan");
    expect(hashtags({ ...listing, community: "", property_type: "" })).toEqual([
      "#Dubai",
      "#DubaiRealEstate",
    ]);
  });

  it("refuses to post without a permit number, and flags samples", () => {
    expect(postProblems(listing)).toEqual([]);
    expect(postProblems({ ...listing, permit_number: " " })[0]).toContain("permit number");
    expect(postProblems({ ...listing, is_sample: true })[0]).toContain("sample listing");
  });
});
