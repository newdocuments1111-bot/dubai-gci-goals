import { describe, expect, it } from "vitest";
import {
  CASH_REPORT_AED,
  EMPTY_COMPLIANCE,
  complianceState,
  keepUntil,
  missingPapers,
  reportDue,
  worthChecking,
} from "./aml";

const full = {
  ...EMPTY_COMPLIANCE,
  buyer_id_collected: true,
  seller_id_collected: true,
  source_of_funds: "Sale of a flat in London",
};

describe("money and ID record", () => {
  it("asks for a report at the cash amount, not below it", () => {
    expect(reportDue({ cash_aed: CASH_REPORT_AED - 1, virtual_asset: false }).due).toBe(false);
    expect(reportDue({ cash_aed: CASH_REPORT_AED, virtual_asset: false }).due).toBe(true);
    expect(reportDue({ cash_aed: 0, virtual_asset: true }).reasons[0]).toContain("cryptocurrency");
  });

  it("names the papers still missing, and asks for company papers only for a company", () => {
    expect(missingPapers(EMPTY_COMPLIANCE, "sale")).toEqual([
      "Buyer's Emirates ID or passport",
      "Seller's Emirates ID or passport",
      "Where the money comes from, in a line",
    ]);
    expect(missingPapers(EMPTY_COMPLIANCE, "rent")[0]).toBe("Tenant's Emirates ID or passport");
    expect(missingPapers(full, "sale")).toEqual([]);
    expect(missingPapers({ ...full, is_company: true }, "sale")[0]).toContain("Trade licence");
  });

  it("points out a third-party payer by name", () => {
    expect(
      worthChecking({ ...full, payer_is_the_buyer: false, payer_name: "Gulf Trading LLC" })[0],
    ).toContain("Gulf Trading LLC is paying");
    expect(worthChecking({ ...full, payer_is_the_buyer: false })[0]).toContain("Write down who");
    expect(worthChecking(full)).toEqual([]);
  });

  it("warns that smaller cash amounts add up", () => {
    expect(worthChecking({ ...full, cash_aed: 20_000 }).join(" ")).toContain(
      "the total is what counts",
    );
    expect(worthChecking({ ...full, cash_aed: 60_000 }).join(" ")).not.toContain(
      "the total is what counts",
    );
  });

  it("moves from not started to complete, and holds at a due report", () => {
    expect(complianceState(EMPTY_COMPLIANCE, "sale")).toBe("not_started");
    expect(complianceState({ ...EMPTY_COMPLIANCE, buyer_id_collected: true }, "sale")).toBe(
      "needs_papers",
    );
    expect(complianceState(full, "sale")).toBe("complete");
    const cash = { ...full, cash_aed: 80_000 };
    expect(complianceState(cash, "sale")).toBe("reporting_due");
    expect(complianceState({ ...cash, rear_filed: true }, "sale")).toBe("complete");
  });

  it("keeps the record for five years after the last change", () => {
    expect(keepUntil("2026-11-18T10:00:00Z")).toBe("2031-11-18");
  });
});
