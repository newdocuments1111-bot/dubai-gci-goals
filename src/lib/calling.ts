/**
 * Safe Calling: a reminder of the UAE telemarketing rules before an agent calls a client.
 * Rules as reported for Cabinet Decisions 56 and 57 of 2024: marketing calls only from 9am to 6pm
 * UAE time, at most one call a day and two a week to the same person, never to someone who asked
 * not to be called. Browser-safe and pure. It does not check the national Do Not Call Registry.
 */

export type CallLevel = "ok" | "warn" | "stop";

export type CallCheck = {
  level: CallLevel;
  /** Short sentences for the agent, most serious first. Empty when level is "ok". */
  messages: string[];
  /** ISO time of the first moment every rule is met again; null when calling is fine now or never allowed. */
  nextAllowed: string | null;
};

/** Calling opens at 09:00 and closes at 18:00 (18:00 itself is closed), UAE time. */
export const CALL_OPEN_HOUR = 9;
export const CALL_CLOSE_HOUR = 18;
export const CALLS_PER_DAY = 1;
export const CALLS_PER_WEEK = 2;

export const CALL_RULES_NOTE =
  "A reminder of the UAE calling rules. It does not check the national Do Not Call Registry.";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Asia/Dubai is UTC+4 all year: no daylight saving. */
const DUBAI_OFFSET = 4 * HOUR;

/** Start of the Dubai day (00:00 UAE time) that holds this moment, as a UTC timestamp. */
const dubaiDayStart = (ms: number) => Math.floor((ms + DUBAI_OFFSET) / DAY) * DAY - DUBAI_OFFSET;

/** The same moment, or the next opening time when it falls outside calling hours. */
function nextOpen(ms: number) {
  const day = dubaiDayStart(ms);
  if (ms < day + CALL_OPEN_HOUR * HOUR) return day + CALL_OPEN_HOUR * HOUR;
  if (ms >= day + CALL_CLOSE_HOUR * HOUR) return day + DAY + CALL_OPEN_HOUR * HOUR;
  return ms;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "today at 9:00 am", "tomorrow at 9:00 am" or "on Monday 23 Nov at 2:15 pm", in UAE time. */
export function callTimeText(when: string | Date, now: Date) {
  const ms = new Date(when).getTime();
  const local = new Date(ms + DUBAI_OFFSET);
  const hour = local.getUTCHours();
  const clock = `${hour % 12 || 12}:${String(local.getUTCMinutes()).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
  const days = Math.round((dubaiDayStart(ms) - dubaiDayStart(now.getTime())) / DAY);
  if (days === 0) return `today at ${clock}`;
  if (days === 1) return `tomorrow at ${clock}`;
  return `on ${WEEKDAYS[local.getUTCDay()]} ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} at ${clock}`;
}

/**
 * Check whether the agent may call this client now.
 * `callTimes` are the times of calls already made to the client (any agent, any outcome).
 */
export function callCheck({
  now,
  doNotCall,
  callTimes,
}: {
  now: Date;
  doNotCall: boolean;
  callTimes: readonly (string | Date)[];
}): CallCheck {
  if (doNotCall)
    return {
      level: "stop",
      messages: ["This client asked not to be called. Do not call them."],
      nextAllowed: null,
    };

  const nowMs = now.getTime();
  const today = dubaiDayStart(nowMs);
  // Newest first. A time that is not a real date is ignored; a time slightly in the future (clock
  // difference between devices) still counts.
  const times = callTimes
    .map((t) => new Date(t).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a);
  const inWeek = times.filter((t) => t > nowMs - WEEK);
  const todayCount = times.filter((t) => t >= today && t < today + DAY).length;

  const closed = nextOpen(nowMs) !== nowMs;
  const weekFull = inWeek.length >= CALLS_PER_WEEK;
  const dayFull = todayCount >= CALLS_PER_DAY;

  const messages: string[] = [];
  let level: CallLevel = "ok";
  let earliest = nowMs;

  if (closed) {
    level = "stop";
    messages.push("It is outside calling hours. Calls are allowed from 9am to 6pm UAE time.");
  }
  if (weekFull) {
    level = "stop";
    messages.push(
      "This client was already called twice in the last 7 days. The limit is two calls a week.",
    );
    // The week has room again once the second newest call is 7 days old.
    const second = inWeek[CALLS_PER_WEEK - 1];
    if (second !== undefined) earliest = Math.max(earliest, second + WEEK);
  }
  if (dayFull) {
    if (level === "ok") level = "warn";
    messages.push("This client was already called today. The limit is one call a day.");
    earliest = Math.max(earliest, today + DAY);
  }

  if (level === "ok") return { level, messages, nextAllowed: null };
  const next = new Date(nextOpen(earliest));
  messages.push(`You can call again ${callTimeText(next, now)} UAE time.`);
  return { level, messages, nextAllowed: next.toISOString() };
}
