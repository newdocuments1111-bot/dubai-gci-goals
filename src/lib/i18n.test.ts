import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirOf, hasArabic, isLang, tr, trTitle, trf } from "./i18n";
import { MAIN_SECTIONS, SETTINGS_SECTION, TOOLS_SECTION } from "./nav";

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
      "inbox.tsx",
      "leads.tsx",
      "viewings.tsx",
      "follow-ups.tsx",
      "deals.tsx",
      "pipeline.tsx",
      "dashboard.tsx",
    ]) {
      const source = readFileSync(`src/routes/_authenticated/${page}`, "utf8");
      // t("…") and t('…') calls with a fixed text.
      for (const m of source.matchAll(/\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g)) {
        const text = (m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1");
        if (!hasArabic(text)) missing.push(`${page}: ${text}`);
      }
    }
    expect(missing).toEqual([]);
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
