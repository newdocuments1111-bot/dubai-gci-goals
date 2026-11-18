/**
 * The money-and-ID record kept on every deal (UAE AML record keeping for brokers).
 * Browser-safe and tested. This is the agency's own record and a reminder of when a report is due.
 * It is not a sanctions or PEP check against any list, and it files nothing with anyone.
 */

/** Cash at or above this amount in one deal, in one go or added up, means a report is due. */
export const CASH_REPORT_AED = 55_000;
/** Dubai brokers must keep the record this long. */
export const KEEP_YEARS = 5;

export type Compliance = {
  buyer_id_collected: boolean;
  seller_id_collected: boolean;
  is_company: boolean;
  company_papers_collected: boolean;
  payer_is_the_buyer: boolean;
  payer_name: string;
  cash_aed: number;
  virtual_asset: boolean;
  source_of_funds: string;
  politically_exposed: boolean;
  rear_filed: boolean;
  rear_reference: string;
  rear_filed_on: string | null;
  notes: string;
};

export const EMPTY_COMPLIANCE: Compliance = {
  buyer_id_collected: false,
  seller_id_collected: false,
  is_company: false,
  company_papers_collected: false,
  payer_is_the_buyer: true,
  payer_name: "",
  cash_aed: 0,
  virtual_asset: false,
  source_of_funds: "",
  politically_exposed: false,
  rear_filed: false,
  rear_reference: "",
  rear_filed_on: null,
  notes: "",
};

/** Is a Real Estate Activity Report due in goAML for this deal, and why? */
export function reportDue(c: Pick<Compliance, "cash_aed" | "virtual_asset">): {
  due: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (c.cash_aed >= CASH_REPORT_AED)
    reasons.push(
      `AED ${Math.round(c.cash_aed).toLocaleString("en-US")} is being paid in cash, which is AED ${CASH_REPORT_AED.toLocaleString("en-US")} or more.`,
    );
  if (c.virtual_asset)
    reasons.push("Part of the money comes from cryptocurrency or another virtual asset.");
  return { due: reasons.length > 0, reasons };
}

/** Papers still to collect before the transfer. */
export function missingPapers(c: Compliance, dealType: "sale" | "rent"): string[] {
  const missing: string[] = [];
  if (!c.buyer_id_collected)
    missing.push(
      dealType === "rent" ? "Tenant's Emirates ID or passport" : "Buyer's Emirates ID or passport",
    );
  if (!c.seller_id_collected)
    missing.push(
      dealType === "rent"
        ? "Landlord's Emirates ID or passport"
        : "Seller's Emirates ID or passport",
    );
  if (c.is_company && !c.company_papers_collected)
    missing.push("Trade licence, memorandum and the list of real owners (UBO)");
  if (!c.source_of_funds.trim()) missing.push("Where the money comes from, in a line");
  return missing;
}

/** Things worth a second look. Each one is a question to ask, not an accusation. */
export function worthChecking(c: Compliance): string[] {
  const flags: string[] = [];
  if (!c.payer_is_the_buyer)
    flags.push(
      c.payer_name.trim()
        ? `${c.payer_name.trim()} is paying, not the buyer. Record why and keep their ID too.`
        : "Someone other than the buyer is paying. Write down who, and why.",
    );
  if (c.politically_exposed)
    flags.push(
      "A party holds, or held, a public position. Your compliance officer normally approves these deals before they go ahead.",
    );
  if (c.virtual_asset)
    flags.push("Money from a virtual asset. Keep the exchange record showing where it came from.");
  if (c.cash_aed > 0 && c.cash_aed < CASH_REPORT_AED)
    flags.push(
      "Cash below the reporting amount. If more cash is added later, the total is what counts.",
    );
  return flags;
}

export type ComplianceState = "not_started" | "reporting_due" | "needs_papers" | "complete";

export function complianceState(c: Compliance, dealType: "sale" | "rent"): ComplianceState {
  const touched =
    c.buyer_id_collected ||
    c.seller_id_collected ||
    c.cash_aed > 0 ||
    c.virtual_asset ||
    Boolean(c.source_of_funds.trim());
  if (!touched) return "not_started";
  if (reportDue(c).due && !c.rear_filed) return "reporting_due";
  if (missingPapers(c, dealType).length) return "needs_papers";
  return "complete";
}

export const STATE_LABEL: Record<ComplianceState, string> = {
  not_started: "Not started",
  reporting_due: "A report is due",
  needs_papers: "Papers still missing",
  complete: "Record complete",
};

/** The date the record may be thrown away, five years after the last change. */
export function keepUntil(lastChangedIso: string): string {
  const d = new Date(lastChangedIso);
  return new Date(Date.UTC(d.getUTCFullYear() + KEEP_YEARS, d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}
