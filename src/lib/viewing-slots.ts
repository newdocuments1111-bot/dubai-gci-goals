import { defaultSettings, isWorkingDay } from "./settings";

export type SlotSettings = Omit<
  Pick<typeof defaultSettings, "working_days" | "holidays" | "work_start" | "work_end" | "viewing_minutes">,
  "working_days"
> & { working_days: readonly string[] };
export function calculateFreeSlots(settings: SlotSettings, booked: string[], now = Date.now()) {
  const duration = settings.viewing_minutes * 60000;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const taken = booked.map(Date.parse);
  const [sh = 0, sm = 0] = settings.work_start.split(":").map(Number);
  const [eh = 0, em = 0] = settings.work_end.split(":").map(Number);
  const slots: string[] = [];
  for (let d = 0; d < 14 && slots.length < 300; d++) {
    const date = new Date(now + d * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    if (!isWorkingDay(date, settings)) continue;
    for (
      let mins = sh * 60 + sm;
      mins + settings.viewing_minutes <= eh * 60 + em && slots.length < 300;
      mins += settings.viewing_minutes
    ) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0"),
        mm = String(mins % 60).padStart(2, "0");
      const start = Date.parse(`${date}T${hh}:${mm}:00+04:00`);
      if (start > now + 3600000 && !taken.some((t) => start < t + duration && start + duration > t))
        slots.push(new Date(start).toISOString());
    }
  }
  return slots;
}

/**
 * The client chooses the time. True when an appointment starting at `startMs` is at least 1 hour from now, within
 * 60 days and does not overlap another booked appointment. In-person meetings must also fall on a working day inside
 * working hours; online meetings (`anyHour`) may be at any hour that suits the client.
 */
export function isTimeFree(
  settings: SlotSettings,
  booked: string[],
  startMs: number,
  now = Date.now(),
  anyHour = false,
) {
  const duration = settings.viewing_minutes * 60000;
  if (!Number.isFinite(startMs) || !Number.isFinite(duration) || duration <= 0) return false;
  if (startMs <= now + 3600000 || startMs > now + 60 * 86400000) return false;
  if (!anyHour) {
    const date = new Date(startMs).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    if (!isWorkingDay(date, settings)) return false;
    const at = (hm: string) => {
      const [h = 0, m = 0] = hm.split(":").map(Number);
      return Date.parse(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+04:00`);
    };
    if (startMs < at(settings.work_start) || startMs + duration > at(settings.work_end)) return false;
  }
  return !booked.map(Date.parse).some((t) => startMs < t + duration && startMs + duration > t);
}

/** Free times closest to the time the client asked for. Online meetings may be at any hour; in-person ones only in working hours. */
export function nearestFreeTimes(
  settings: SlotSettings,
  booked: string[],
  targetMs: number,
  anyHour: boolean,
  count = 2,
  now = Date.now(),
) {
  if (!anyHour) return nearestSlots(calculateFreeSlots(settings, booked, now), targetMs, count);
  const step = 30 * 60000;
  const found: string[] = [];
  for (let k = 1; k <= 96 && found.length < count; k++)
    for (const t of [targetMs - k * step, targetMs + k * step])
      if (found.length < count && isTimeFree(settings, booked, t, now, true)) found.push(new Date(t).toISOString());
  return found.sort();
}

/** The free slots closest to the time the client asked for, in time order. */
export function nearestSlots(slots: string[], targetMs: number, count = 2) {
  return [...slots]
    .sort((a, b) => Math.abs(Date.parse(a) - targetMs) - Math.abs(Date.parse(b) - targetMs))
    .slice(0, count)
    .sort();
}

/** Add-to-Google-Calendar link for a booked appointment, plus an online meeting link for online meetings (no calendar account needed). */
export function meetingLinks(appointmentId: string, startIso: string, minutes: number, title: string, online = true) {
  const meet = online ? `https://meet.jit.si/EliteVisions-${appointmentId}` : "";
  const fmt = (ms: number) =>
    new Date(ms)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const start = Date.parse(startIso);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(start + minutes * 60000)}`,
    details: online ? `Join online: ${meet}` : "Appointment in Dubai",
    ...(online ? { location: meet } : {}),
  });
  return { meet, calendar: `https://calendar.google.com/calendar/render?${params.toString()}` };
}
