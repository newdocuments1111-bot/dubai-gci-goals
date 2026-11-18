/**
 * App navigation: five main sections plus Settings and Tools. Browser-safe, tested.
 * Pages keep their own URLs; this module only groups them and decides who sees what.
 * The role filter is cosmetic: every server function re-checks access.
 */

export type NavRole = { isOwner: boolean; isHq: boolean };
export type NavShow = "owner" | "manager" | "hq";
export type NavPage = { to: string; label: string; show?: NavShow };
export type NavSectionId =
  "today" | "leads" | "deals" | "listings" | "insights" | "settings" | "tools";
export type NavSection = { id: NavSectionId; label: string; pages: NavPage[] };

export const MAIN_SECTIONS: readonly NavSection[] = [
  { id: "today", label: "Today", pages: [{ to: "/dashboard", label: "Today" }] },
  {
    id: "leads",
    label: "Leads",
    pages: [
      { to: "/inbox", label: "Inbox" },
      { to: "/leads", label: "List" },
      { to: "/pipeline", label: "Board" },
      { to: "/viewings", label: "Viewings" },
      { to: "/follow-ups", label: "Follow-ups" },
    ],
  },
  { id: "deals", label: "Deals", pages: [{ to: "/deals", label: "Deals" }] },
  {
    id: "listings",
    label: "Listings",
    pages: [
      { to: "/listings", label: "Listings" },
      { to: "/owners", label: "Owners" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    pages: [
      { to: "/stats", label: "Statistics", show: "owner" },
      { to: "/owner/weekly-report", label: "Weekly report", show: "manager" },
      { to: "/ads", label: "Ads" },
      { to: "/market-insights", label: "Market insights" },
      { to: "/market-data", label: "Market data" },
    ],
  },
];

export const SETTINGS_SECTION: NavSection = {
  id: "settings",
  label: "Settings",
  pages: [
    { to: "/settings", label: "General" },
    { to: "/team", label: "Team", show: "owner" },
    { to: "/settings/alerts", label: "My alerts" },
    { to: "/settings/routing", label: "Lead routing", show: "owner" },
    { to: "/settings/whatsapp", label: "WhatsApp", show: "owner" },
    { to: "/templates", label: "Templates", show: "manager" },
    { to: "/queue", label: "Send queue" },
    { to: "/ai-reply-rules", label: "AI reply rules", show: "owner" },
    { to: "/test-chat", label: "Test chat" },
    { to: "/uae-knowledge", label: "UAE knowledge" },
  ],
};

export const TOOLS_SECTION: NavSection = {
  id: "tools",
  label: "Tools",
  pages: [
    { to: "/", label: "GCI calculator" },
    { to: "/hq", label: "Elite Visions HQ", show: "hq" },
  ],
};

const ALL_SECTIONS: readonly NavSection[] = [...MAIN_SECTIONS, SETTINGS_SECTION, TOOLS_SECTION];

/** Detail pages that belong to a section without being in its tabs. */
const DETAIL_PREFIXES: readonly { prefix: string; section: NavSectionId }[] = [
  { prefix: "/lead/", section: "leads" },
  { prefix: "/listing/", section: "listings" },
];

export function canSee(page: NavPage, role: NavRole): boolean {
  if (!page.show) return true;
  if (page.show === "owner") return role.isOwner;
  if (page.show === "manager") return role.isOwner || role.isHq;
  return role.isHq;
}

/** The section with only the pages this person may open; null when none are left. */
export function visibleSection(section: NavSection, role: NavRole): NavSection | null {
  const pages = section.pages.filter((p) => canSee(p, role));
  return pages.length ? { ...section, pages } : null;
}

export function visibleSections(role: NavRole) {
  return {
    main: MAIN_SECTIONS.map((s) => visibleSection(s, role)).filter((s): s is NavSection => !!s),
    settings: visibleSection(SETTINGS_SECTION, role),
    tools: visibleSection(TOOLS_SECTION, role),
  };
}

const matches = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

/** The page whose URL best matches (longest match wins, so /settings/whatsapp beats /settings). */
export function activePage(pathname: string): NavPage | null {
  let best: NavPage | null = null;
  for (const s of ALL_SECTIONS)
    for (const p of s.pages)
      if (matches(pathname, p.to) && (!best || p.to.length > best.to.length)) best = p;
  return best;
}

export function sectionFor(pathname: string): NavSectionId | null {
  const page = activePage(pathname);
  if (page) return ALL_SECTIONS.find((s) => s.pages.includes(page))?.id ?? null;
  return DETAIL_PREFIXES.find((d) => pathname.startsWith(d.prefix))?.section ?? null;
}

/** Every page this person may open, for the Ctrl+K search. */
export function searchablePages(role: NavRole) {
  return ALL_SECTIONS.flatMap((s) =>
    s.pages
      .filter((p) => canSee(p, role))
      .map((p) => ({
        ...p,
        section: s.label,
        title: p.label === s.label ? p.label : `${s.label} · ${p.label}`,
      })),
  );
}

export function greeting(date: Date, timeZone = "Asia/Dubai"): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(date),
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
