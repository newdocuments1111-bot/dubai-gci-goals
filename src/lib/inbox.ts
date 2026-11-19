/**
 * Lead Inbox rules: browser-safe and tested.
 * Intake normalises what portals, Zapier, Meta forms and websites send; matching pairs leads with listings.
 */
import { z } from "zod";

export const LEAD_SOURCES = [
  "Bayut",
  "Property Finder",
  "Dubizzle",
  "Instagram",
  "Facebook",
  "Google",
  "TikTok",
  "WhatsApp",
  "Website",
  "Referral",
  "Other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const PORTAL_SOURCES: readonly LeadSource[] = ["Bayut", "Property Finder", "Dubizzle"];

/** Map whatever a sender calls the source to one of ours ("propertyfinder.ae" → Property Finder). */
export function normaliseSource(raw: string | null | undefined): LeadSource {
  const s = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return "Other";
  if (s.includes("bayut")) return "Bayut";
  if (s.includes("propertyfinder") || s === "pf") return "Property Finder";
  if (s.includes("dubizzle")) return "Dubizzle";
  if (s.includes("instagram") || s === "ig") return "Instagram";
  if (s.includes("facebook") || s.includes("meta") || s === "fb") return "Facebook";
  if (s.includes("google")) return "Google";
  if (s.includes("tiktok")) return "TikTok";
  if (s.includes("whatsapp")) return "WhatsApp";
  if (s.includes("website") || s.includes("web") || s.includes("site")) return "Website";
  if (s.includes("referral") || s.includes("refer")) return "Referral";
  return "Other";
}

/** The four reply languages the app keeps per lead. */
export function languageBucket(raw: string | null | undefined): "en" | "ar" | "hi" | "ru" {
  const s = (raw ?? "").toLowerCase().trim();
  if (s.startsWith("ar")) return "ar";
  if (s.startsWith("ru")) return "ru";
  if (s.startsWith("hi") || s.startsWith("ur")) return "hi";
  return "en";
}

const LEAD_TYPES = ["buyer", "seller", "landlord", "tenant", "other"] as const;

const str = (max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => (v == null ? "" : String(v).trim().slice(0, max)));

/** What the public intake API accepts. Unknown fields are ignored; a name or a phone is required. */
export const intakeSchema = z
  .object({
    name: str(200),
    first_name: str(100),
    last_name: str(100),
    phone: str(50),
    mobile: str(50),
    email: str(200),
    source: str(100),
    source_detail: str(200),
    ad: str(200),
    campaign: str(200),
    utm_campaign: str(200),
    utm_content: str(200),
    area: str(200),
    community: str(200),
    budget: str(200),
    language: str(30),
    type: str(20),
    message: str(2000),
    enquiry: str(2000),
    listing_ref: str(200),
    portal_ref: str(200),
    reference: str(200),
  })
  .passthrough();

export type IntakeLead = {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  source_detail: string;
  campaign: string;
  area: string;
  budget: string;
  language: "en" | "ar" | "hi" | "ru";
  type: (typeof LEAD_TYPES)[number];
  enquiry: string;
  portal_ref: string;
};

/** Turn a sender's payload into one lead, or an error a person can act on. */
export function parseIntake(body: unknown): { lead: IntakeLead } | { error: string } {
  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) return { error: "Send a JSON object with at least a name or a phone." };
  const d = parsed.data;
  const name = d.name || [d.first_name, d.last_name].filter(Boolean).join(" ");
  const phone = (d.phone || d.mobile).replace(/[^\d+]/g, "").slice(0, 20);
  if (!name && !phone) return { error: "A lead needs a name or a phone number." };
  const type = (LEAD_TYPES as readonly string[]).includes(d.type.toLowerCase())
    ? (d.type.toLowerCase() as IntakeLead["type"])
    : "buyer";
  return {
    lead: {
      name,
      phone: phone && !phone.startsWith("+") && phone.length > 9 ? `+${phone}` : phone,
      email: d.email,
      source: normaliseSource(d.source),
      source_detail: d.source_detail || d.ad || d.utm_content,
      campaign: d.campaign || d.utm_campaign,
      area: d.area || d.community,
      budget: d.budget,
      language: languageBucket(d.language),
      type,
      enquiry: d.enquiry || d.message,
      portal_ref: d.portal_ref || d.listing_ref || d.reference,
    },
  };
}

/** "AED 2.1M", "2,100,000", "1.5-2m", "850k" → the top of the range in AED, or null. */
export function budgetAed(raw: string | null | undefined): number | null {
  const s = (raw ?? "").toLowerCase().replace(/,/g, "");
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(m|mn|million|k|thousand)?/g)].map((m) => {
    const n = Number(m[1]);
    const unit = m[2] ?? "";
    return unit.startsWith("m")
      ? n * 1_000_000
      : unit.startsWith("k") || unit === "thousand"
        ? n * 1_000
        : n;
  });
  const top = Math.max(0, ...nums.filter((n) => n >= 10_000));
  return top > 0 ? top : null;
}

export type MatchLead = { area: string; budget: string; type?: string };
export type MatchListing = {
  id: string;
  title: string;
  community: string | null;
  project: string | null;
  price_aed: number | null;
  bedrooms: number | null;
  status: string;
};

const words = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["dubai", "the", "and"].includes(w));

/** Available listings that fit the lead's area and budget, best first (at most `limit`). */
export function matchListings<T extends MatchListing>(lead: MatchLead, listings: T[], limit = 3) {
  const leadWords = new Set(words(lead.area));
  const budget = budgetAed(lead.budget);
  return listings
    .filter((l) => l.status === "Available")
    .map((l) => {
      const placeWords = [...words(l.community), ...words(l.project), ...words(l.title)];
      const areaFit = leadWords.size > 0 && placeWords.some((w) => leadWords.has(w));
      const price = l.price_aed == null ? null : Number(l.price_aed);
      const budgetFit =
        budget != null && price != null && price <= budget * 1.1 && price >= budget * 0.6;
      return { listing: l, score: (areaFit ? 2 : 0) + (budgetFit ? 2 : 0), areaFit, budgetFit };
    })
    .filter((m) => m.score >= 2)
    .sort(
      (a, b) =>
        b.score - a.score || Number(a.listing.price_aed ?? 0) - Number(b.listing.price_aed ?? 0),
    )
    .slice(0, limit);
}

/** Buyers for one listing: the same test seen from the listing's side. */
export function matchBuyers<L extends MatchLead & { id: string; outcome?: string }>(
  listing: MatchListing,
  leads: L[],
  limit = 5,
) {
  return leads
    .filter((l) => (l.outcome ?? "open") === "open" && (l.type ?? "buyer") === "buyer")
    .filter((l) => matchListings(l, [{ ...listing, status: "Available" }], 1).length > 0)
    .slice(0, limit);
}

/** "0:42" for under an hour, "3 h" after, "2 d" after a day. */
export function elapsed(fromIso: string, to: Date | string = new Date()): string {
  const ms = Math.max(0, new Date(to).getTime() - new Date(fromIso).getTime());
  const sec = Math.floor(ms / 1000);
  if (sec < 3600) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)} h`;
  return `${Math.floor(sec / 86_400)} d`;
}

/** Reply status for the Inbox row. */
export function replyState(
  lead: { created_at: string; first_reply_at: string | null },
  now: Date = new Date(),
): { replied: boolean; label: string; late: boolean } {
  if (lead.first_reply_at)
    return {
      replied: true,
      label: `Replied in ${elapsed(lead.created_at, lead.first_reply_at)}`,
      late: false,
    };
  const waitedMin = (now.getTime() - new Date(lead.created_at).getTime()) / 60_000;
  return {
    replied: false,
    label: `Waiting ${elapsed(lead.created_at, now)}`,
    late: waitedMin >= 5,
  };
}

/** wa.me link for a phone number, or null. */
export function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}
