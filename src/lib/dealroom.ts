/**
 * DLD Deal Room rules: the steps of each kind of deal, the money on it, and RERA form drafts.
 * Browser-safe and tested. Fees are the agency's own settings (public figures by default) and
 * are always shown as estimates to confirm with the trustee office.
 */
import { DRAFT_LABEL } from "./paperwork";

export type DealKind = "sale_ready" | "sale_offplan" | "rent";
export type StepTemplate = {
  key: string;
  label: string;
  who: string;
  /** Days after the previous step is done (or the deal starts) that this step is due. */
  dueDays: number;
  /** Words to look for in the client's Document Vault, when this step leaves a document. */
  doc?: string;
  optional?: boolean;
};

export const STEP_TEMPLATES: Record<DealKind, StepTemplate[]> = {
  sale_ready: [
    {
      key: "form_a",
      label: "Form A (seller listing agreement)",
      who: "Agent",
      dueDays: 1,
      doc: "form a",
    },
    { key: "form_b", label: "Form B (buyer agreement)", who: "Agent", dueDays: 1, doc: "form b" },
    {
      key: "form_i",
      label: "Form I (agent-to-agent)",
      who: "Agent",
      dueDays: 1,
      doc: "form i",
      optional: true,
    },
    { key: "offer", label: "Offer accepted", who: "Agent", dueDays: 3 },
    {
      key: "form_f",
      label: "Form F (MOU) and 10% deposit",
      who: "Buyer and seller",
      dueDays: 3,
      doc: "form f",
    },
    { key: "noc", label: "Developer NOC", who: "Seller", dueDays: 7, doc: "noc" },
    {
      key: "mortgage",
      label: "Mortgage valuation and final offer",
      who: "Buyer's bank",
      dueDays: 10,
      doc: "valuation",
      optional: true,
    },
    { key: "trustee", label: "Trustee office appointment", who: "Agent", dueDays: 3 },
    {
      key: "transfer",
      label: "DLD transfer and fees paid",
      who: "Buyer and seller",
      dueDays: 7,
      doc: "dld fee",
    },
    {
      key: "title_deed",
      label: "New title deed issued",
      who: "DLD",
      dueDays: 1,
      doc: "title deed",
    },
    { key: "commission", label: "Commission received", who: "Agency", dueDays: 7 },
  ],
  sale_offplan: [
    { key: "form_b", label: "Form B (buyer agreement)", who: "Agent", dueDays: 1, doc: "form b" },
    {
      key: "reservation",
      label: "Reservation form and booking amount",
      who: "Buyer",
      dueDays: 2,
      doc: "reservation",
    },
    { key: "spa", label: "SPA signed", who: "Buyer and developer", dueDays: 14, doc: "spa" },
    { key: "oqood", label: "Oqood registered", who: "Developer", dueDays: 30, doc: "oqood" },
    {
      key: "payment_plan",
      label: "Payment plan on track",
      who: "Buyer",
      dueDays: 30,
      doc: "payment plan",
    },
    { key: "commission", label: "Commission received from developer", who: "Agency", dueDays: 30 },
    {
      key: "handover",
      label: "Handover and snagging",
      who: "Buyer and developer",
      dueDays: 0,
      doc: "handover",
      optional: true,
    },
  ],
  rent: [
    {
      key: "form_a",
      label: "Form A (landlord listing agreement)",
      who: "Agent",
      dueDays: 1,
      doc: "form a",
    },
    { key: "form_b", label: "Form B (tenant agreement)", who: "Agent", dueDays: 1, doc: "form b" },
    { key: "offer", label: "Offer accepted", who: "Agent", dueDays: 2 },
    {
      key: "tenancy",
      label: "Tenancy contract signed",
      who: "Tenant and landlord",
      dueDays: 3,
      doc: "tenancy contract",
    },
    { key: "cheques", label: "Deposit and rent cheques", who: "Tenant", dueDays: 2, doc: "cheque" },
    { key: "ejari", label: "Ejari registered", who: "Agent", dueDays: 3, doc: "ejari" },
    { key: "commission", label: "Commission received", who: "Agency", dueDays: 7 },
  ],
};

export function dealKind(deal: { deal_type: string; track?: string | null }): DealKind {
  if (deal.deal_type === "rent") return "rent";
  return deal.track === "offplan" ? "sale_offplan" : "sale_ready";
}

export type StepRow = {
  key: string;
  label: string;
  who: string;
  position: number;
  due_at: string | null;
  done_at: string | null;
  skipped: boolean;
};

const DAY = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * DAY).toISOString();

/** The steps a new Deal Room starts with; the first one is due from the deal's start. */
export function initialSteps(kind: DealKind, startIso: string): StepRow[] {
  return STEP_TEMPLATES[kind].map((t, i) => ({
    key: t.key,
    label: t.label,
    who: t.who,
    position: i,
    due_at: i === 0 ? addDays(startIso, t.dueDays) : null,
    done_at: null,
    skipped: false,
  }));
}

/** The step to work on now: the first one neither done nor skipped. */
export function currentStep<T extends StepRow>(steps: T[]): T | null {
  return (
    [...steps].sort((a, b) => a.position - b.position).find((s) => !s.done_at && !s.skipped) ?? null
  );
}

/** When a step is done or skipped, the next open step gets its due date (if it has none yet). */
export function dueForNext(
  kind: DealKind,
  steps: StepRow[],
  nowIso: string,
): { key: string; due_at: string } | null {
  const next = currentStep(steps);
  if (!next || next.due_at) return null;
  const t = STEP_TEMPLATES[kind].find((x) => x.key === next.key);
  return { key: next.key, due_at: addDays(nowIso, t?.dueDays ?? 3) };
}

export type StepState = "done" | "skipped" | "overdue" | "current" | "upcoming";
export function stepState(
  step: StepRow,
  current: StepRow | null,
  now: Date = new Date(),
): StepState {
  if (step.done_at) return "done";
  if (step.skipped) return "skipped";
  if (current && step.key === current.key)
    return step.due_at && new Date(step.due_at) < now ? "overdue" : "current";
  return "upcoming";
}

export function progress(steps: StepRow[]) {
  const counted = steps.filter((s) => !s.skipped);
  const done = counted.filter((s) => s.done_at).length;
  return {
    done,
    total: counted.length,
    percent: counted.length ? Math.round((done / counted.length) * 100) : 0,
  };
}

export type Fees = {
  vat_percent: number;
  dld_fee_percent: number;
  dld_admin_aed: number;
  trustee_fee_low_aed: number;
  trustee_fee_high_aed: number;
  mortgage_reg_percent: number;
};
export const DEFAULT_FEES: Fees = {
  vat_percent: 5,
  dld_fee_percent: 4,
  dld_admin_aed: 580,
  trustee_fee_low_aed: 4000,
  trustee_fee_high_aed: 5250,
  mortgage_reg_percent: 0.25,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Commission on the deal: total fee, co-broker's share (Form I), our GCI, the agent split and VAT. */
export function dealMoney(input: {
  price: number;
  totalCommissionPercent: number;
  coBrokerPercent: number;
  splitPercent: number;
  vatPercent: number;
}) {
  const total = r2((input.price * input.totalCommissionPercent) / 100);
  const coBroker = r2((total * input.coBrokerPercent) / 100);
  const gci = r2(total - coBroker);
  const agentShare = r2((gci * input.splitPercent) / 100);
  const vat = r2((gci * input.vatPercent) / 100);
  return {
    total,
    coBroker,
    gci,
    agentShare,
    agencyShare: r2(gci - agentShare),
    vat,
    invoiceTotal: r2(gci + vat),
  };
}

/** What the buyer pays on a ready sale, from the agency's fee settings. An estimate, never a quote. */
export function buyerCosts(price: number, loan: number | null, fees: Fees) {
  const rows = [
    {
      label: `DLD transfer fee ${fees.dld_fee_percent}%`,
      aed: r2((price * fees.dld_fee_percent) / 100),
    },
    { label: "DLD admin and knowledge fees", aed: fees.dld_admin_aed },
    {
      label: "Trustee office (incl. VAT)",
      aed: price < 500_000 ? fees.trustee_fee_low_aed : fees.trustee_fee_high_aed,
    },
  ];
  if (loan && loan > 0)
    rows.push({
      label: `Mortgage registration ${fees.mortgage_reg_percent}% of loan`,
      aed: r2((loan * fees.mortgage_reg_percent) / 100),
    });
  return { rows, total: r2(rows.reduce((s, r) => s + r.aed, 0)) };
}

export type FormKind = "A" | "B" | "I";
export type FormInput = {
  dealType: "sale" | "rent";
  client: { name: string; phone: string };
  sellerName: string;
  coBrokerName: string;
  coBrokerPercent: number;
  totalCommissionPercent: number;
  price: number;
  property: { title: string; community: string; permit_number: string } | null;
  agency: { name: string; rera_brn: string; agent_name: string };
  today: string;
};

const blank = (v: string | number | null | undefined) =>
  v === null || v === undefined || String(v).trim() === "" ? "________ (agent to fill)" : String(v);
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;

/** Pre-filled RERA Form A, B or I details. Always a draft: the official form is completed and signed on the DLD/RERA system. */
export function formDraft(kind: FormKind, f: FormInput) {
  const owner = f.dealType === "rent" ? "LANDLORD" : "SELLER";
  const client = f.dealType === "rent" ? "TENANT" : "BUYER";
  const property = [
    `Property: ${blank(f.property?.title)}`,
    `Community: ${blank(f.property?.community)}`,
    `Trakheesi / DLD permit: ${blank(f.property?.permit_number)}`,
  ];
  const agency = [
    `Brokerage: ${blank(f.agency.name)} · RERA ORN / BRN: ${blank(f.agency.rera_brn)}`,
    `Broker: ${blank(f.agency.agent_name)}`,
  ];
  const head = [`*** ${DRAFT_LABEL} ***`, `Prepared: ${f.today}`, ""];
  const foot = [
    "",
    `*** ${DRAFT_LABEL} — complete and sign the official RERA form before relying on it ***`,
  ];
  const fee = `${f.totalCommissionPercent}% (${aed((f.price * f.totalCommissionPercent) / 100)}) plus VAT`;
  if (kind === "A")
    return {
      title: `Form A — ${owner.toLowerCase()} listing agreement (draft)`,
      text: [
        ...head,
        owner,
        `Name: ${blank(f.sellerName)}`,
        "Emirates ID / passport no.: ________ (agent to fill)",
        "Title deed no.: ________ (agent to fill)",
        "",
        "PROPERTY",
        ...property,
        `Asking ${f.dealType === "rent" ? "rent" : "price"}: ${f.price ? aed(f.price) : blank("")}`,
        "",
        "AGREEMENT",
        "Exclusive / non-exclusive: ________ (agent to fill)",
        "Valid from / to: ________ (agent to fill)",
        `Commission: ${fee}`,
        "",
        ...agency,
        ...foot,
      ].join("\n"),
    };
  if (kind === "B")
    return {
      title: `Form B — ${client.toLowerCase()} agreement (draft)`,
      text: [
        ...head,
        client,
        `Name: ${blank(f.client.name)}`,
        `Phone: ${blank(f.client.phone)}`,
        "Emirates ID / passport no.: ________ (agent to fill)",
        "",
        "REQUIREMENT",
        ...property,
        `Budget: ${f.price ? aed(f.price) : blank("")}`,
        "",
        "AGREEMENT",
        "Valid from / to: ________ (agent to fill)",
        `Commission: ${fee}`,
        "",
        ...agency,
        ...foot,
      ].join("\n"),
    };
  return {
    title: "Form I — agent-to-agent agreement (draft)",
    text: [
      ...head,
      "OUR BROKERAGE",
      ...agency,
      "",
      "OTHER BROKERAGE",
      `Name: ${blank(f.coBrokerName)}`,
      "RERA ORN / BRN: ________ (agent to fill)",
      "Broker: ________ (agent to fill)",
      "",
      "DEAL",
      ...property,
      `Price: ${f.price ? aed(f.price) : blank("")}`,
      `${client === "BUYER" ? "Buyer" : "Tenant"}: ${blank(f.client.name)}`,
      "",
      "COMMISSION SPLIT",
      `Total commission: ${fee}`,
      `Other brokerage's share: ${f.coBrokerPercent}%`,
      `Our share: ${100 - f.coBrokerPercent}%`,
      ...foot,
    ].join("\n"),
  };
}

/** Which RERA forms apply to this deal. */
export function formsFor(kind: DealKind, hasCoBroker: boolean): FormKind[] {
  const base: FormKind[] = kind === "sale_offplan" ? ["B"] : ["A", "B"];
  return hasCoBroker ? [...base, "I"] : base;
}

/** Is the document a step leaves already in the client's vault? Null when the step leaves none. */
export function stepDocInVault(kind: DealKind, key: string, vaultFiles: string[]): boolean | null {
  const doc = STEP_TEMPLATES[kind].find((t) => t.key === key)?.doc;
  if (!doc) return null;
  const variants = [doc, doc.replace(/ /g, "_"), doc.replace(/ /g, "-"), doc.replace(/ /g, "")];
  const names = vaultFiles.map((n) => n.toLowerCase());
  return names.some((n) => variants.some((v) => n.includes(v)));
}
