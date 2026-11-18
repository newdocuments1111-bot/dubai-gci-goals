import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEES,
  STEP_TEMPLATES,
  buyerCosts,
  currentStep,
  dealKind,
  dealMoney,
  dueForNext,
  formDraft,
  formsFor,
  initialSteps,
  progress,
  stepDocInVault,
  stepState,
} from "./dealroom";
import { DRAFT_LABEL } from "./paperwork";

describe("deal room steps", () => {
  it("picks the step list for each deal", () => {
    expect(dealKind({ deal_type: "sale", track: "ready" })).toBe("sale_ready");
    expect(dealKind({ deal_type: "sale", track: "offplan" })).toBe("sale_offplan");
    expect(dealKind({ deal_type: "rent", track: "offplan" })).toBe("rent");
    expect(STEP_TEMPLATES.sale_ready.map((s) => s.key)).toEqual([
      "form_a",
      "form_b",
      "form_i",
      "offer",
      "form_f",
      "noc",
      "mortgage",
      "trustee",
      "transfer",
      "title_deed",
      "commission",
    ]);
  });

  it("starts with the first step due and moves the due date along", () => {
    const steps = initialSteps("sale_ready", "2026-11-18T10:00:00.000Z");
    expect(steps[0]?.due_at).toBe("2026-11-19T10:00:00.000Z");
    expect(steps.slice(1).every((s) => s.due_at === null)).toBe(true);
    const done = steps.map((s) =>
      s.key === "form_a" ? { ...s, done_at: "2026-11-18T12:00:00.000Z" } : s,
    );
    expect(currentStep(done)?.key).toBe("form_b");
    expect(dueForNext("sale_ready", done, "2026-11-18T12:00:00.000Z")).toEqual({
      key: "form_b",
      due_at: "2026-11-19T12:00:00.000Z",
    });
    const skipped = done.map((s) => (s.key === "form_b" ? { ...s, skipped: true } : s));
    expect(currentStep(skipped)?.key).toBe("form_i");
    expect(progress(skipped)).toEqual({ done: 1, total: 10, percent: 10 });
  });

  it("marks overdue only on the current step", () => {
    const steps = initialSteps("rent", "2026-11-01T00:00:00.000Z");
    const cur = currentStep(steps);
    expect(stepState(steps[0]!, cur, new Date("2026-11-18T00:00:00Z"))).toBe("overdue");
    expect(stepState(steps[1]!, cur, new Date("2026-11-18T00:00:00Z"))).toBe("upcoming");
  });

  it("checks step documents against the vault", () => {
    expect(stepDocInVault("sale_ready", "form_f", ["Form_F signed.pdf"])).toBe(true);
    expect(stepDocInVault("sale_ready", "noc", ["passport.pdf"])).toBe(false);
    expect(stepDocInVault("sale_ready", "offer", ["x.pdf"])).toBeNull();
    expect(stepDocInVault("sale_ready", "title_deed", ["New title-deed.pdf"])).toBe(true);
  });
});

describe("deal room money", () => {
  it("matches the whiteboard example", () => {
    expect(
      dealMoney({
        price: 2_050_000,
        totalCommissionPercent: 2,
        coBrokerPercent: 50,
        splitPercent: 50,
        vatPercent: 5,
      }),
    ).toEqual({
      total: 41_000,
      coBroker: 20_500,
      gci: 20_500,
      agentShare: 10_250,
      agencyShare: 10_250,
      vat: 1_025,
      invoiceTotal: 21_525,
    });
  });

  it("estimates buyer costs from settings", () => {
    const c = buyerCosts(2_050_000, 1_230_000, DEFAULT_FEES);
    expect(c.rows.map((r) => r.aed)).toEqual([82_000, 580, 5_250, 3_075]);
    expect(c.total).toBe(90_905);
    expect(buyerCosts(450_000, null, DEFAULT_FEES).rows.map((r) => r.aed)).toEqual([
      18_000, 580, 4_000,
    ]);
  });
});

describe("RERA form drafts", () => {
  const input = {
    dealType: "sale" as const,
    client: { name: "Sara Khan", phone: "+971501112222" },
    sellerName: "",
    coBrokerName: "Bluestone Realty",
    coBrokerPercent: 50,
    totalCommissionPercent: 2,
    price: 2_050_000,
    property: { title: "Marina Gate 2BR", community: "Dubai Marina", permit_number: "71234" },
    agency: { name: "Kingswear", rera_brn: "", agent_name: "Ahmed" },
    today: "2026-11-18",
  };

  it("always labels drafts and leaves blanks for the agent", () => {
    for (const k of ["A", "B", "I"] as const) {
      const d = formDraft(k, input);
      expect(d.text.startsWith(`*** ${DRAFT_LABEL} ***`)).toBe(true);
      expect(d.text).toContain("________ (agent to fill)");
    }
    expect(formDraft("I", input).text).toContain("Other brokerage's share: 50%");
    expect(formDraft("B", input).text).toContain("Sara Khan");
  });

  it("lists the forms each deal needs", () => {
    expect(formsFor("sale_ready", true)).toEqual(["A", "B", "I"]);
    expect(formsFor("sale_offplan", false)).toEqual(["B"]);
  });
});
