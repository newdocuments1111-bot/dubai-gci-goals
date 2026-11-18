/**
 * Caption for posting a listing on Instagram, Facebook or LinkedIn. Browser-safe and tested.
 * Dubai adverts must show the permit number, so a listing without one cannot be posted from here.
 */

import { advertCheck, type AdvertAgency } from "./advert";

export type SocialListing = {
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
  /** Last day the permit is valid (YYYY-MM-DD), when recorded. */
  permit_expires_on?: string | null | undefined;
  is_sample: boolean;
};

export type SocialAgency = { agency: string; agent: string; mobile: string; reraBrn: string };

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;

/** Hashtags from the community and the kind of home, cleaned for the apps. */
export function hashtags(l: Pick<SocialListing, "community" | "property_type" | "completion">) {
  const tag = (text: string) =>
    text
      .trim()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join("");
  const tags = ["#Dubai", "#DubaiRealEstate"];
  const area = tag(l.community);
  if (area) tags.push(`#${area}`);
  const kind = tag(l.property_type);
  if (kind) tags.push(`#${kind}ForSale`);
  if (l.completion === "off-plan") tags.push("#OffPlan");
  return [...new Set(tags)];
}

/** The advert check for a social post: the same rules as the brochure (see advert.ts). */
export const postCheck = (l: SocialListing, agency: AdvertAgency, today: string) =>
  advertCheck(l, agency, today);

/** Why this listing cannot be posted yet, or an empty list. `today` is YYYY-MM-DD. */
export function postProblems(l: SocialListing, agency: AdvertAgency, today: string): string[] {
  return postCheck(l, agency, today).blockers;
}

/** The caption to paste into the app. */
export function socialCaption(l: SocialListing, a: SocialAgency): string {
  const place = [l.project, l.community].filter((p) => p.trim()).join(", ");
  const beds = l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bed`;
  const facts = [
    beds,
    l.size_sqft > 0 ? `${l.size_sqft.toLocaleString("en-US")} sq ft` : "",
    l.property_type.trim(),
    l.completion === "off-plan"
      ? l.handover_date
        ? `Off-plan, handover ${l.handover_date}`
        : "Off-plan"
      : "Ready to move in",
  ].filter(Boolean);
  const contact = [a.agent, a.mobile].filter((p) => p.trim()).join(" · ");
  return [
    l.title.trim(),
    place,
    "",
    aed(l.price_aed),
    facts.join(" · "),
    "",
    contact ? `Call or WhatsApp ${contact}` : "",
    a.agency.trim(),
    a.reraBrn.trim() ? `RERA ORN / BRN ${a.reraBrn.trim()}` : "",
    `Permit number ${l.permit_number.trim()}`,
    "",
    hashtags(l).join(" "),
  ]
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n")
    .trim();
}

export const SOCIAL_APPS = [
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com/" },
  { key: "facebook", label: "Facebook", url: "https://www.facebook.com/" },
  { key: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/feed/" },
] as const;
