import { checklistFor, documentReceived } from "./documents";
import { dealMath } from "./agency";

export const DRAFT_LABEL = "Draft – agent must check";
export type DealType = "sale" | "rent";

export type PaperworkInput = {
  dealType: DealType;
  lead: { name: string; phone: string } | null;
  listing: {
    title: string;
    community: string;
    project: string;
    property_type: string;
    bedrooms: number;
    size_sqft: number;
    permit_number: string;
  } | null;
  deal: { price_aed: number; commission_percent: number; status: string } | null;
  agency: { name: string; rera_brn: string; agent_name: string };
  today?: string;
};

/** Documents needed for a sale (Form F) or a rental (Ejari), split by party. */
export function paperworkChecklist(dealType: DealType) {
  if (dealType === "sale")
    return [
      { party: "Buyer", items: checklistFor("buyer") },
      { party: "Seller", items: checklistFor("seller") },
      {
        party: "Deal",
        items: [
          "Signed Form F (MOU) by buyer, seller and agents",
          "Deposit cheque (amount as agreed in Form F)",
        ],
      },
      {
        party: "DLD transfer",
        items: [
          "Developer NOC (seller clears service charges first)",
          "Mortgage: valuation report and final offer letter (if financing)",
          "Trustee office appointment and DLD transfer fee receipt",
          "New title deed in the buyer's name",
        ],
      },
    ];
  return [
    { party: "Tenant", items: checklistFor("tenant") },
    { party: "Landlord", items: checklistFor("landlord") },
    {
      party: "Deal",
      items: [
        "Signed tenancy contract",
        "DEWA premise number",
        "Security deposit and rent cheques (as agreed)",
      ],
    },
  ];
}

/** Checklist with received/missing status from the client's Document Vault file names. */
export function checklistWithStatus(dealType: DealType, vaultFileNames: string[]) {
  return paperworkChecklist(dealType).map((group) => ({
    party: group.party,
    items: group.items.map((item) => ({ item, received: documentReceived(item, vaultFileNames) })),
  }));
}

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const blank = (v: string | number | null | undefined) =>
  v === null || v === undefined || String(v).trim() === "" ? "________ (agent to fill)" : String(v);

/** Pre-filled Form F (sale) or Ejari details (rent) from lead, listing and deal data. Never a final document. */
export function paperworkDraft(input: PaperworkInput) {
  const l = input.listing,
    d = input.deal;
  const property = [
    `Property: ${blank(l?.title)}`,
    `Community / building: ${blank([l?.community, l?.project].filter(Boolean).join(" / "))}`,
    `Type: ${blank(l?.property_type)} · Bedrooms: ${l ? (l.bedrooms === 0 ? "Studio" : l.bedrooms) : blank("")} · Size: ${l?.size_sqft ? `${l.size_sqft.toLocaleString("en-US")} sq ft` : blank("")}`,
    `DLD / Trakheesi permit: ${blank(l?.permit_number)}`,
  ];
  const agency = [
    `Agency: ${blank(input.agency.name)} · RERA / BRN: ${blank(input.agency.rera_brn)}`,
    `Agent: ${blank(input.agency.agent_name)}`,
  ];
  const head = [
    `*** ${DRAFT_LABEL} ***`,
    `Prepared: ${input.today ?? new Date().toISOString().slice(0, 10)}`,
  ];
  if (input.dealType === "sale") {
    const fee = d
      ? dealMath({ price: d.price_aed, commissionPercent: d.commission_percent, splitPercent: 0 })
          .gci
      : null;
    return {
      title: "Form F (MOU) — sale draft",
      text: [
        ...head,
        "",
        "BUYER",
        `Name: ${blank(input.lead?.name)}`,
        `Phone: ${blank(input.lead?.phone)}`,
        "Passport / Emirates ID no.: ________ (agent to fill)",
        "",
        "SELLER",
        "Name: ________ (agent to fill)",
        "Title deed no.: ________ (agent to fill)",
        "",
        "PROPERTY",
        ...property,
        "",
        "TERMS",
        `Sale price: ${d ? aed(d.price_aed) : blank("")}`,
        `Agent commission: ${d ? `${d.commission_percent}% (${aed(fee ?? 0)})` : blank("")}`,
        "Deposit amount and holder: ________ (agent to fill)",
        "Transfer date: ________ (agent to fill)",
        "Mortgage / cash: ________ (agent to fill)",
        "",
        "AGENCY",
        ...agency,
        "",
        `*** ${DRAFT_LABEL} — check every detail with the official RERA Form F before signing ***`,
      ].join("\n"),
    };
  }
  return {
    title: "Ejari details — rental draft",
    text: [
      ...head,
      "",
      "TENANT",
      `Name: ${blank(input.lead?.name)}`,
      `Phone: ${blank(input.lead?.phone)}`,
      "Emirates ID / passport no.: ________ (agent to fill)",
      "",
      "LANDLORD",
      "Name: ________ (agent to fill)",
      "Title deed no.: ________ (agent to fill)",
      "",
      "PROPERTY",
      ...property,
      "DEWA premise number: ________ (agent to fill)",
      "",
      "CONTRACT",
      `Annual rent: ${d ? aed(d.price_aed) : blank("")}`,
      "Contract start / end: ________ (agent to fill)",
      "Number of cheques: ________ (agent to fill)",
      "Security deposit: ________ (agent to fill)",
      "",
      "AGENCY",
      ...agency,
      "",
      `*** ${DRAFT_LABEL} — confirm every detail on the official Ejari system before registering ***`,
    ].join("\n"),
  };
}
