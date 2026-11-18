import { describe, expect, it } from "vitest";
import { dirOf, hasArabic, isLang, tr, trTitle } from "./i18n";
import { MAIN_SECTIONS, SETTINGS_SECTION, TOOLS_SECTION } from "./nav";

describe("app language", () => {
  it("has Arabic for every menu section and page", () => {
    const labels = [...MAIN_SECTIONS, SETTINGS_SECTION, TOOLS_SECTION].flatMap((s) => [
      s.label,
      ...s.pages.map((p) => p.label),
    ]);
    expect(labels.filter((l) => !hasArabic(l))).toEqual([]);
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
