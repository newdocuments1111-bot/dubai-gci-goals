/** Calendar files (.ics) for viewings: opens in Google, Apple and Outlook calendars. Browser-safe and tested. */

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");

/** Lines longer than 75 bytes must be folded (RFC 5545). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function icsEvent(e: {
  id: string;
  title: string;
  startIso: string;
  minutes: number;
  location?: string;
  description?: string;
  now?: Date;
}): string {
  const start = new Date(e.startIso);
  const end = new Date(start.getTime() + e.minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dubai AI GCI//Viewings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@dubai-ai-gci`,
    `DTSTAMP:${stamp(e.now ?? new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Viewing in 1 hour",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}

export function viewingEvent(
  v: {
    id: string;
    kind: string;
    starts_at: string;
    leadName?: string | null;
    listingTitle?: string | null;
    community?: string | null;
  },
  minutes = 30,
) {
  const what = v.kind === "valuation" ? "Valuation" : "Viewing";
  return icsEvent({
    id: v.id,
    title: [what, v.leadName, v.listingTitle].filter(Boolean).join(" · "),
    startIso: v.starts_at,
    minutes,
    location: [v.listingTitle, v.community].filter(Boolean).join(", "),
    description: `${what} booked in Dubai AI GCI.`,
  });
}

/** Save a calendar file from the browser. */
export function downloadIcs(filename: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
