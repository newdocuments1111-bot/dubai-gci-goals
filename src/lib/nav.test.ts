import { describe, expect, it } from "vitest";
import { activePage, greeting, searchablePages, sectionFor, visibleSections } from "./nav";

const owner = { isOwner: true, isHq: false };
const agent = { isOwner: false, isHq: false };
const hq = { isOwner: false, isHq: true };

describe("nav", () => {
  it("groups the app into five main sections", () => {
    expect(visibleSections(owner).main.map((s) => s.label)).toEqual([
      "Today",
      "Leads",
      "Deals",
      "Listings",
      "Insights",
    ]);
  });

  it("hides owner-only pages from agents but keeps their sections", () => {
    const a = visibleSections(agent);
    const insights = a.main.find((s) => s.id === "insights");
    expect(insights?.pages.map((p) => p.to)).not.toContain("/stats");
    expect(a.settings?.pages.map((p) => p.to)).not.toContain("/team");
    expect(a.tools?.pages.map((p) => p.to)).not.toContain("/hq");
  });

  it("shows HQ only to HQ admins", () => {
    expect(visibleSections(hq).tools?.pages.map((p) => p.to)).toContain("/hq");
    expect(searchablePages(owner).map((p) => p.to)).not.toContain("/hq");
  });

  it("finds the section for pages and detail pages", () => {
    expect(sectionFor("/pipeline")).toBe("leads");
    expect(sectionFor("/lead/abc")).toBe("leads");
    expect(sectionFor("/listing/abc")).toBe("listings");
    expect(sectionFor("/settings/whatsapp")).toBe("settings");
    expect(sectionFor("/owner/weekly-report")).toBe("insights");
    expect(sectionFor("/")).toBe("tools");
    expect(sectionFor("/nowhere")).toBeNull();
  });

  it("prefers the longest matching page", () => {
    expect(activePage("/settings/whatsapp")?.label).toBe("WhatsApp");
    expect(activePage("/settings")?.label).toBe("General");
  });

  it("greets by Dubai time", () => {
    expect(greeting(new Date("2026-11-18T04:00:00Z"))).toBe("Good morning");
    expect(greeting(new Date("2026-11-18T10:00:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-11-18T16:00:00Z"))).toBe("Good evening");
  });
});
