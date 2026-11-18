import { describe, expect, it } from "vitest";
import {
  brochureAmenities,
  brochureFacts,
  brochureNearby,
  brochureCheck,
  brochureReady,
  type BrochureListing,
} from "./brochure";

const base: BrochureListing = {
  title: "2-bed with marina view",
  community: "Dubai Marina",
  project: "Marina Gate",
  property_type: "Apartment",
  bedrooms: 2,
  size_sqft: 1200,
  price_aed: 2400000,
  completion: "ready",
  handover_date: null,
  permit_number: "7123456789",
  floor: "",
  view: "Marina",
  furnishing: null,
  developer: "Select Group",
  payment_plan: "60/40",
  parking_spaces: 1,
  service_charge_aed_sqft_year: 18,
  amenity_pool: true,
  amenity_gym: true,
  amenity_kids_play_area: false,
  amenity_security: null,
  nearby_schools: "",
  nearby_parks: null,
  nearby_clinics: null,
  nearby_metro: "DMCC, 6 minutes on foot",
  nearby_malls: "Marina Mall",
  nearby_beach: null,
  nearby_supermarket: null,
};

describe("brochure", () => {
  it("lists only the facts that are filled in", () => {
    const facts = Object.fromEntries(brochureFacts(base));
    expect(facts["Price per sq ft"]).toBe("AED 2,000");
    expect(facts["Parking"]).toBe("1 space");
    expect(facts["View"]).toBe("Marina");
    expect(facts["Floor"]).toBeUndefined();
    expect(facts["Furnishing"]).toBeUndefined();
  });

  it("shows handover and payment plan only for off-plan", () => {
    expect(Object.fromEntries(brochureFacts(base))["Payment plan"]).toBeUndefined();
    const off = Object.fromEntries(
      brochureFacts({ ...base, completion: "off-plan", handover_date: "2027-06-30" }),
    );
    expect(off["Status"]).toBe("Off-plan");
    expect(off["Handover"]).toBe("2027-06-30");
    expect(off["Payment plan"]).toBe("60/40");
  });

  it("calls zero bedrooms a studio", () => {
    expect(Object.fromEntries(brochureFacts({ ...base, bedrooms: 0 }))["Bedrooms"]).toBe("Studio");
  });

  it("lists amenities and nearby places that exist", () => {
    expect(brochureAmenities(base)).toEqual(["Swimming pool", "Gym"]);
    expect(brochureNearby(base).map(([k]) => k)).toEqual(["Metro", "Malls"]);
  });

  it("is ready to share only when the advert check passes", () => {
    const agency = { reraBrn: "12345" };
    const today = "2026-11-18";
    expect(brochureReady(base, agency, today)).toBe(true);
    expect(brochureReady({ ...base, permit_number: "  " }, agency, today)).toBe(false);
    expect(brochureReady({ ...base, price_aed: 0 }, agency, today)).toBe(false);
    expect(brochureReady(base, { reraBrn: "" }, today)).toBe(false);
    expect(brochureReady({ ...base, is_sample: true }, agency, today)).toBe(false);
    expect(brochureReady({ ...base, permit_expires_on: "2026-11-17" }, agency, today)).toBe(false);
    expect(brochureReady({ ...base, permit_expires_on: today }, agency, today)).toBe(true);
    expect(brochureCheck(base, agency, today).warnings[0]).toContain("No permit end date");
  });
});
