/** Export files and the activity log. Browser-safe and tested. */

export const EXPORT_KINDS = ["leads", "deals", "listings", "owners"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const EXPORT_LABELS: Record<ExportKind, string> = {
  leads: "Leads",
  deals: "Deals",
  listings: "Listings",
  owners: "Owners",
};

/** Column name in the database → heading in the file. The file has exactly these columns, in this order. */
export const EXPORT_COLUMNS: Record<ExportKind, readonly (readonly [string, string])[]> = {
  leads: [
    ["name", "Name"],
    ["phone", "Phone"],
    ["email", "Email"],
    ["type", "Type"],
    ["source", "Source"],
    ["area", "Area"],
    ["budget", "Budget"],
    ["score", "Score"],
    ["stage_name", "Step"],
    ["outcome", "Outcome"],
    ["agent", "Agent"],
    ["language", "Language"],
    ["opted_in", "Consent to check-ins"],
    ["stopped", "Replied STOP"],
    ["created_at", "Created"],
    ["first_reply_at", "First reply"],
  ],
  deals: [
    ["client", "Client"],
    ["deal_type", "Type"],
    ["status", "Status"],
    ["price_aed", "Price (AED)"],
    ["total_commission_percent", "Total commission %"],
    ["co_broker_name", "Co-broker"],
    ["co_broker_percent", "Co-broker share %"],
    ["commission_percent", "Our commission %"],
    ["agent", "Agent"],
    ["created_at", "Created"],
    ["closed_at", "Closed"],
  ],
  listings: [
    ["title", "Title"],
    ["community", "Community"],
    ["project", "Project"],
    ["property_type", "Type"],
    ["bedrooms", "Bedrooms"],
    ["size_sqft", "Size (sq ft)"],
    ["price_aed", "Price (AED)"],
    ["status", "Status"],
    ["completion", "Completion"],
    ["permit_number", "Permit number"],
    ["created_at", "Created"],
  ],
  owners: [
    ["name", "Name"],
    ["phone", "Phone"],
    ["kind", "Kind"],
    ["intent", "Wants to"],
    ["stage", "Step"],
    ["area", "Area"],
    ["building", "Building"],
    ["asking_price_aed", "Asking price (AED)"],
    ["tenant_name", "Tenant"],
    ["annual_rent_aed", "Yearly rent (AED)"],
    ["lease_end", "Lease ends"],
    ["created_at", "Created"],
  ],
};

/**
 * One spreadsheet cell. Text that a spreadsheet would run as a formula (= + - @ at the start) gets a
 * leading apostrophe, so a name typed by a stranger can never run anything on the owner's computer.
 * Phone numbers are left alone.
 */
export function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined
      ? ""
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : String(value);
  // Plain numbers such as +971501234567 are harmless and stay as they are.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && !/^[+-]?[\d\s.]+$/.test(text))
    text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The mark at the start of the file that tells Excel the text is UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

/** A CSV file that Excel opens correctly, Arabic included (UTF-8 with a byte-order mark). */
export function toCsv(kind: ExportKind, rows: Record<string, unknown>[]): string {
  const columns = EXPORT_COLUMNS[kind];
  const lines = [columns.map(([, heading]) => csvCell(heading)).join(",")];
  for (const row of rows) lines.push(columns.map(([key]) => csvCell(row[key])).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export const exportFileName = (kind: ExportKind, date = new Date()) =>
  `${kind}-${date.toISOString().slice(0, 10)}.csv`;

export const ACTIVITY_ENTITIES = [
  ["", "Everything"],
  ["lead", "Leads"],
  ["deal", "Deals"],
  ["listing", "Listings"],
  ["member", "Team"],
  ["settings", "Settings"],
  ["campaign", "Campaigns"],
  ["export", "Exports"],
] as const;

export type ActivityRow = {
  id: number;
  at: string;
  actor_id: string | null;
  entity: string;
  action: string;
  detail: string;
};

/** Who did it: a team member's name, "The app" for automatic changes, or a former member. */
export function actorName(
  actorId: string | null,
  members: { user_id: string; display_name: string; email: string }[],
): string {
  if (!actorId) return "The app";
  const m = members.find((x) => x.user_id === actorId);
  return m ? m.display_name || m.email : "Former team member";
}
