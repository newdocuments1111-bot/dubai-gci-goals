import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirOf, hasArabic, isLang, tr, trTitle, trf } from "./i18n";
import { MAIN_SECTIONS, SETTINGS_SECTION, TOOLS_SECTION } from "./nav";
import { PERIODS, REPORTS, periodLabel } from "./ask";
import { SELLER_STAGES } from "./sellers";

describe("app language", () => {
  it("has Arabic for every menu section and page", () => {
    const labels = [...MAIN_SECTIONS, SETTINGS_SECTION, TOOLS_SECTION].flatMap((s) => [
      s.label,
      ...s.pages.map((p) => p.label),
    ]);
    expect(labels.filter((l) => !hasArabic(l))).toEqual([]);
  });

  it("has Arabic for every text on the translated pages", () => {
    const missing: string[] = [];
    for (const page of [
      "src/routes/_authenticated/inbox.tsx",
      "src/routes/_authenticated/leads.tsx",
      "src/routes/_authenticated/viewings.tsx",
      "src/routes/_authenticated/follow-ups.tsx",
      "src/routes/_authenticated/deals.tsx",
      "src/routes/_authenticated/pipeline.tsx",
      "src/routes/_authenticated/dashboard.tsx",
      "src/routes/_authenticated/listings.tsx",
      "src/routes/_authenticated/owners.tsx",
      "src/components/AskCrm.tsx",
    ]) {
      const source = readFileSync(page, "utf8");
      // t("…") and t('…') calls with a fixed text.
      for (const m of source.matchAll(/\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g)) {
        const text = (m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1");
        if (!hasArabic(text)) missing.push(`${page}: ${text}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("has Arabic for the texts translated when shown (not seen by the scan above)", () => {
    const ask = readFileSync("src/lib/ask.ts", "utf8");
    // Column headings of every report: columns: ["Lead", "Phone", …]
    const columns = [...ask.matchAll(/columns:\s*\[([^\]]*)\]/g)].flatMap((m) =>
      [...(m[1] ?? "").matchAll(/"([^"]*)"/g)].map((c) => c[1] ?? ""),
    );
    expect(columns.length).toBeGreaterThan(20);
    const texts = [
      ...REPORTS.flatMap((r) => [r.label, r.example]),
      ...PERIODS.map(periodLabel),
      ...columns,
      "Leads overdue on a step",
      'Leads matching "{q}"',
      "AED per viewing uses the campaign's spend to date from the Ads page.",
      "I can't answer that one yet. These are the questions I can answer from your data:",
      "Only the agency owner can see that report. You can ask:",
      ...SELLER_STAGES.flatMap((s) => [s.label, s.hint]),
      // stored values shown through t(…): listing status, completion, property type, owner type, cheque badge
      ...["Available", "Reserved", "Sold", "Needs check", "off-plan", "ready"],
      ...["apartment", "villa", "townhouse", "owner", "investor"],
      ...["Bounced", "Cleared", "Deposited", "Due today"],
    ];
    expect(texts.filter((x) => !hasArabic(x))).toEqual([]);
  });

  it("fills blanks after translating", () => {
    expect(trf("en", "Export {n}", { n: 12 })).toBe("Export 12");
    expect(trf("ar", "Export {n}", { n: 12 })).toBe("تصدير 12");
    expect(trf("ar", "Step {n}", {})).toBe("المرحلة {n}");
  });

  it("translates, falls back and sets direction", () => {
    expect(tr("ar", "Today")).toBe("اليوم");
    expect(tr("en", "Today")).toBe("Today");
    expect(tr("ar", "Kingswear Properties")).toBe("Kingswear Properties");
    expect(trTitle("ar", "Leads · Board")).toBe("العملاء المحتملون · اللوحة");
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
    expect(isLang("fr")).toBe(false);
  });
});
