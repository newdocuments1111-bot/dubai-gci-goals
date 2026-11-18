/**
 * Advert check: what a Dubai property advert (brochure or social post) must have before it goes
 * out. Browser-safe and tested. One set of rules for every place an advert leaves the CRM.
 * Dates are date-only strings (YYYY-MM-DD) compared in UTC; today is always passed in.
 */

export type AdvertListing = {
  permit_number: string;
  /** Last day the permit is valid, YYYY-MM-DD. */
  permit_expires_on?: string | null | undefined;
  price_aed: number;
  is_sample?: boolean | null | undefined;
};

export type AdvertAgency = { reraBrn: string | null | undefined };

export type AdvertItem = {
  key: "permit" | "permitEnd" | "price" | "rera";
  label: string;
  ok: boolean;
};

export type AdvertCheck = {
  /** Reasons the advert must not go out. Empty means it may. */
  blockers: string[];
  /** Things to sort out soon; the advert may still go out. */
  warnings: string[];
  /** The permit's last day: the advert must be down after it. Null when no end date is recorded. */
  takeDownOn: string | null;
  /** Tick or cross for each thing an advert needs. */
  items: AdvertItem[];
};

/** Warn when the permit ends within this many days. */
export const PERMIT_WARNING_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** UTC midnight of a real YYYY-MM-DD date, or null. */
function dayTime(date: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((date ?? "").trim());
  if (!m) return null;
  const time = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(time).toISOString().slice(0, 10) === m[0] ? time : null;
}

/** "2026-11-25" → "25 Nov 2026". */
export function advertDate(date: string): string {
  const time = dayTime(date);
  if (time === null) return date;
  const d = new Date(time);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Today's date in Dubai as YYYY-MM-DD, for the pages that call advertCheck. */
export function dubaiToday(now: Date = new Date()): string {
  // Dubai is UTC+4 all year.
  return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function advertCheck(
  listing: AdvertListing,
  agency: AdvertAgency,
  today: string,
): AdvertCheck {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const todayTime = dayTime(today);
  if (todayTime === null) throw new Error("advertCheck needs today as YYYY-MM-DD.");

  const hasPermit = Boolean(listing.permit_number.trim());
  const hasPrice = Number.isFinite(listing.price_aed) && listing.price_aed > 0;
  const hasRera = Boolean((agency.reraBrn ?? "").trim());
  const endTime = dayTime(listing.permit_expires_on);
  const takeDownOn = endTime === null ? null : new Date(endTime).toISOString().slice(0, 10);
  const daysLeft = endTime === null ? null : Math.round((endTime - todayTime) / DAY_MS);
  const expired = daysLeft !== null && daysLeft < 0;

  if (!hasPermit)
    blockers.push(
      "Add the DLD / Trakheesi permit number on the listing. Dubai adverts must show it.",
    );
  if (!hasPrice) blockers.push("Add the price on the listing. An advert must show the price.");
  if (!hasRera)
    blockers.push(
      "Add your agency's RERA number in Settings. Ask the agency owner. Dubai adverts must show it.",
    );
  if (listing.is_sample)
    blockers.push("This is a sample listing with a fictional property. It cannot be advertised.");
  if (expired && takeDownOn)
    blockers.push(
      `The permit ended on ${advertDate(takeDownOn)}. Take this advert down everywhere, then renew the permit and enter the new end date.`,
    );

  if (takeDownOn === null)
    warnings.push(
      "No permit end date is recorded. Add it on the listing so you know when the advert must come down.",
    );
  else if (daysLeft !== null && daysLeft >= 0 && daysLeft <= PERMIT_WARNING_DAYS) {
    const when = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    warnings.push(
      `The permit ends ${when}, on ${advertDate(takeDownOn)}. Take this advert down after that date, or renew the permit.`,
    );
  }

  return {
    blockers,
    warnings,
    takeDownOn,
    items: [
      { key: "permit", label: "Permit number", ok: hasPermit },
      {
        key: "permitEnd",
        label: expired
          ? "Permit end date (permit has ended)"
          : takeDownOn
            ? `Permit end date (${advertDate(takeDownOn)})`
            : "Permit end date",
        ok: takeDownOn !== null && !expired,
      },
      { key: "price", label: "Price", ok: hasPrice },
      { key: "rera", label: "Agency RERA number", ok: hasRera },
    ],
  };
}
