import { z } from "zod";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const settingsSchema = z.object({
  agent_name: z.string().trim().max(200),
  agency_name: z.string().trim().max(200),
  rera_brn: z.string().trim().max(100),
  working_days: z.array(z.enum(WEEKDAYS)).min(1),
  work_start: z.string().regex(/^\d{2}:\d{2}$/),
  work_end: z.string().regex(/^\d{2}:\d{2}$/),
  viewing_minutes: z.number().int().min(10).max(480),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100),
  compliance_email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  retention_years: z.number().int().min(1).max(30),
  mortgage_partner: z.string().trim().max(200),
  missed_lead_minutes: z.number().int().min(1).max(1440),
  minutes_per_ai_reply: z.number().min(0).max(120),
  annual_gci_goal_aed: z.number().min(0).max(100_000_000_000).default(0),
});
export type AppSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: AppSettings = {
  agent_name: "",
  agency_name: "",
  rera_brn: "",
  // Open 24/7 by default; each agency or agent narrows its own hours and holidays in Settings.
  working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  work_start: "00:00",
  work_end: "23:59",
  viewing_minutes: 30,
  holidays: [],
  compliance_email: "",
  retention_years: 5,
  mortgage_partner: "",
  missed_lead_minutes: 15,
  minutes_per_ai_reply: 2,
  annual_gci_goal_aed: 0,
};

/** True when the date (YYYY-MM-DD) is a working day and not a holiday. */
export function isWorkingDay(date: string, settings: { working_days: readonly string[]; holidays: readonly string[] }) {
  if (settings.holidays.includes(date)) return false;
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Dubai" });
  return (settings.working_days as readonly string[]).includes(day);
}
