/** What goes on a listing brochure. Browser-safe and tested. Internal notes never appear on it. */

import { advertCheck, type AdvertAgency, type AdvertListing } from "./advert";

export type BrochureListing = {
  title: string;
  community: string;
  project: string;
  property_type: string;
  bedrooms: number;
  size_sqft: number;
  price_aed: number;
  completion: string;
  handover_date: string | null;
  permit_number: string;
  floor: string | null;
  view: string | null;
  furnishing: string | null;
  developer: string | null;
  payment_plan: string | null;
  parking_spaces: number | null;
  service_charge_aed_sqft_year: number | null;
  amenity_pool: boolean | null;
  amenity_gym: boolean | null;
  amenity_kids_play_area: boolean | null;
  amenity_security: boolean | null;
  nearby_schools: string | null;
  nearby_parks: string | null;
  nearby_clinics: string | null;
  nearby_metro: string | null;
  nearby_malls: string | null;
  nearby_beach: string | null;
  nearby_supermarket: string | null;
};

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const text = (v: string | null | undefined) => (v ?? "").trim();

export const brochurePrice = (l: Pick<BrochureListing, "price_aed">) => aed(l.price_aed);

/** Label and value pairs; anything empty is left off the page. */
export function brochureFacts(l: BrochureListing): [string, string][] {
  const offPlan = l.completion === "off-plan";
  const perSqft = l.size_sqft > 0 && l.price_aed > 0 ? aed(l.price_aed / l.size_sqft) : "";
  const rows: [string, string][] = [
    ["Type", text(l.property_type)],
    ["Bedrooms", l.bedrooms === 0 ? "Studio" : String(l.bedrooms)],
    ["Size", l.size_sqft > 0 ? `${l.size_sqft.toLocaleString("en-US")} sq ft` : ""],
    ["Price per sq ft", perSqft],
    ["Status", offPlan ? "Off-plan" : "Ready"],
    ["Handover", offPlan ? text(l.handover_date) : ""],
    ["Developer", text(l.developer)],
    ["Payment plan", offPlan ? text(l.payment_plan) : ""],
    ["Floor", text(l.floor)],
    ["View", text(l.view)],
    ["Furnishing", text(l.furnishing)],
    [
      "Parking",
      l.parking_spaces ? `${l.parking_spaces} space${l.parking_spaces > 1 ? "s" : ""}` : "",
    ],
    [
      "Service charge",
      l.service_charge_aed_sqft_year
        ? `AED ${l.service_charge_aed_sqft_year} per sq ft a year`
        : "",
    ],
  ];
  return rows.filter(([, v]) => v);
}

export function brochureAmenities(l: BrochureListing): string[] {
  return [
    l.amenity_pool && "Swimming pool",
    l.amenity_gym && "Gym",
    l.amenity_kids_play_area && "Children's play area",
    l.amenity_security && "24-hour security",
  ].filter((v): v is string => Boolean(v));
}

export function brochureNearby(l: BrochureListing): [string, string][] {
  const rows: [string, string][] = [
    ["Metro", text(l.nearby_metro)],
    ["Schools", text(l.nearby_schools)],
    ["Malls", text(l.nearby_malls)],
    ["Supermarket", text(l.nearby_supermarket)],
    ["Parks", text(l.nearby_parks)],
    ["Clinics", text(l.nearby_clinics)],
    ["Beach", text(l.nearby_beach)],
  ];
  return rows.filter(([, v]) => v);
}

/** The advert check for a brochure: the same rules as a social post (see advert.ts). */
export const brochureCheck = (l: AdvertListing, agency: AdvertAgency, today: string) =>
  advertCheck(l, agency, today);

/** A brochure is ready to share only when the advert check finds nothing that blocks it. */
export const brochureReady = (l: AdvertListing, agency: AdvertAgency, today: string) =>
  brochureCheck(l, agency, today).blockers.length === 0;
