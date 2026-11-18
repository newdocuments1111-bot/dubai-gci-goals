/** Agent alerts: what each alert says on a phone and in WhatsApp. Browser-safe and tested. */

export const DELIVERED_KINDS = ["assigned", "pool", "reminder"] as const;
export type DeliveredKind = (typeof DELIVERED_KINDS)[number];

export const ALERT_TEMPLATE = {
  name: "agent_new_lead_alert",
  language: "en",
  category: "utility",
  // Meta does not accept a variable at the very start or end of the body.
  body: "New lead for you: {{1}} from {{2}}, {{3}}. Open it here: {{4}} and reply within 10 minutes.",
  examples: ["Sara K", "Bayut", "Dubai Marina", "https://dubai-gci-goals.lovable.app/lead/123"],
} as const;

export function alertTitle(kind: string): string {
  if (kind === "assigned") return "New lead for you";
  if (kind === "reminder") return "Lead still waiting";
  if (kind === "pool") return "Lead back in the pool";
  if (kind === "hot") return "Hot lead";
  return "Alert";
}

export function alertIcon(kind: string): string {
  return kind === "hot"
    ? "🔥"
    : kind === "assigned"
      ? "📥"
      : kind === "reminder"
        ? "⏰"
        : kind === "pool"
          ? "↩️"
          : "⚠️";
}

/** The phone notification for one alert. */
export function pushMessage(alert: {
  id: string;
  kind: string;
  message: string;
  lead_id: string | null;
}) {
  return {
    title: alertTitle(alert.kind),
    body: alert.message.slice(0, 180),
    url: alert.lead_id ? `/lead/${alert.lead_id}` : "/inbox",
    tag: alert.lead_id ? `lead-${alert.lead_id}` : `alert-${alert.id}`,
  };
}

/** {{1}}–{{4}} for the WhatsApp template; WhatsApp parameters may not hold new lines or long runs of spaces. */
export function templateParams(
  lead: { name: string | null; source: string; area: string | null },
  link: string,
): string[] {
  const clean = (s: string, fallback: string) =>
    s.replace(/\s+/g, " ").trim().slice(0, 60) || fallback;
  return [
    clean(lead.name ?? "", "a new client"),
    clean(lead.source, "a portal"),
    clean(lead.area ?? "", "area not given"),
    link,
  ];
}

/** Mobile number as digits with country code, or null when it can't receive WhatsApp. */
export function mobileDigits(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (d.length < 9 || d.length > 15) return null;
  return d.startsWith("0") ? `971${d.slice(1)}` : d;
}

/** "now", "4 min", "3 h", "2 d" since an alert. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "now";
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} d`;
}
