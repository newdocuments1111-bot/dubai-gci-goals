/**
 * Lead import: read rows pasted from Excel or a CSV file, map the columns and clean each lead.
 * Browser-safe and tested. Nothing here writes; the server skips phone numbers the agency already has.
 */
import { LEAD_SOURCES, languageBucket, normaliseSource, type LeadSource } from "./inbox";

export const IMPORT_MAX_ROWS = 2000;

/** Split delimited text (comma, tab or semicolon) into rows, honouring "quoted, cells" and "" escapes. */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = src.split("\n", 1)[0] ?? "";
  const delim = firstLine.includes("\t")
    ? "\t"
    : firstLine.split(";").length > firstLine.split(",").length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

export const IMPORT_FIELDS = [
  "name",
  "phone",
  "email",
  "source",
  "area",
  "budget",
  "type",
  "language",
  "notes",
  "date",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

const HEADER_HINTS: [ImportField, RegExp][] = [
  ["phone", /phone|mobile|whats\s*app|contact no|number|tel/i],
  ["email", /e-?mail/i],
  ["name", /name|client|customer|lead$/i],
  ["source", /source|portal|channel|came from|origin/i],
  ["area", /area|community|location|project|building/i],
  ["budget", /budget|price|amount/i],
  ["type", /type|buyer|tenant|category/i],
  ["language", /lang/i],
  ["date", /date|created|received|time/i],
  ["notes", /note|comment|message|remark|enquiry|inquiry|requirement/i],
];

/** Guess which column holds which field from the header row; -1 when a field has no column. */
export function guessMapping(header: string[]): Record<ImportField, number> {
  const map = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, -1])) as Record<ImportField, number>;
  const used = new Set<number>();
  for (const [field, re] of HEADER_HINTS) {
    const i = header.findIndex((h, idx) => !used.has(idx) && re.test(h));
    if (i >= 0) {
      map[field] = i;
      used.add(i);
    }
  }
  return map;
}

/** True when the first row looks like column names rather than a lead. */
export function looksLikeHeader(row: string[]): boolean {
  return (
    row.some((c) => HEADER_HINTS.some(([, re]) => re.test(c))) &&
    !row.some((c) => c.replace(/\D/g, "").length >= 8)
  );
}

export type ImportLead = {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  area: string;
  budget: string;
  type: "buyer" | "seller" | "landlord" | "tenant" | "other";
  language: "en" | "ar" | "hi" | "ru";
  enquiry: string;
  created_at: string | null;
};

const TYPES = ["buyer", "seller", "landlord", "tenant", "other"] as const;
export const phoneKey = (phone: string) =>
  phone
    .replace(/\D/g, "")
    .replace(/^00/, "")
    .replace(/^0(?=5\d{8}$)/, "971");

function cleanPhone(raw: string): string {
  const digits = phoneKey(raw);
  if (digits.length < 8 || digits.length > 15) return "";
  return `+${digits}`;
}

function cleanDate(raw: string, now: Date): string | null {
  if (!raw) return null;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(raw); // day first, as used in the UAE
  const t = dmy ? Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 8) : Date.parse(raw);
  if (!Number.isFinite(t) || t > now.getTime() || t < Date.UTC(2000, 0, 1)) return null;
  return new Date(t).toISOString();
}

export type ImportPreview = {
  leads: ImportLead[];
  skipped: { row: number; reason: string }[];
  duplicatesInFile: number;
};

/** Turn table rows into clean leads. Rows without a name and a usable phone are skipped with a reason. */
export function buildLeads(
  rows: string[][],
  mapping: Record<ImportField, number>,
  opts: { defaultSource?: LeadSource; firstRowNumber?: number; now?: Date } = {},
): ImportPreview {
  const now = opts.now ?? new Date();
  const first = opts.firstRowNumber ?? 1;
  const out: ImportPreview = { leads: [], skipped: [], duplicatesInFile: 0 };
  const seen = new Set<string>();
  const get = (r: string[], f: ImportField) =>
    mapping[f] >= 0 ? (r[mapping[f]] ?? "").trim() : "";
  rows.slice(0, IMPORT_MAX_ROWS).forEach((r, i) => {
    const name = get(r, "name").slice(0, 200);
    const rawPhone = get(r, "phone");
    const phone = cleanPhone(rawPhone);
    if (!name && !phone)
      return void out.skipped.push({ row: first + i, reason: "No name and no phone" });
    if (rawPhone && !phone)
      return void out.skipped.push({
        row: first + i,
        reason: `Phone "${rawPhone.slice(0, 20)}" is not a full number`,
      });
    const key = phone ? phoneKey(phone) : `name:${name.toLowerCase()}`;
    if (seen.has(key)) return void out.duplicatesInFile++;
    seen.add(key);
    const typeRaw = get(r, "type").toLowerCase();
    const src = get(r, "source");
    out.leads.push({
      name,
      phone,
      email: get(r, "email").slice(0, 200),
      source: src ? normaliseSource(src) : (opts.defaultSource ?? "Other"),
      area: get(r, "area").slice(0, 200),
      budget: get(r, "budget").slice(0, 200),
      type:
        TYPES.find((t) => typeRaw.includes(t)) ?? (typeRaw.includes("rent") ? "tenant" : "buyer"),
      language: languageBucket(get(r, "language")),
      enquiry: get(r, "notes").slice(0, 2000),
      created_at: cleanDate(get(r, "date"), now),
    });
  });
  if (rows.length > IMPORT_MAX_ROWS)
    out.skipped.push({
      row: first + IMPORT_MAX_ROWS,
      reason: `Only the first ${IMPORT_MAX_ROWS} rows are imported at a time`,
    });
  return out;
}

export { LEAD_SOURCES };
