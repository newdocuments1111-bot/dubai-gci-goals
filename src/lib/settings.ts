import { z } from 'zod';

export const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;

export const settingsSchema = z.object({
  agent_name: z.string().trim().max(200),
  agency_name: z.string().trim().max(200),
  rera_brn: z.string().trim().max(100),
  working_days: z.array(z.enum(WEEKDAYS)).min(1),
  work_start: z.string().regex(/^\d{2}:\d{2}$/),
  work_end: z.string().regex(/^\d{2}:\d{2}$/),
  viewing_minutes: z.number().int().min(10).max(480),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100),
  compliance_email: z.string().trim().max(200).refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'),
  retention_years: z.number().int().min(1).max(30),
  mortgage_partner: z.string().trim().max(200),
});
export type AppSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: AppSettings = {
  agent_name: '', agency_name: '', rera_brn: '',
  working_days: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
  work_start: '09:00', work_end: '18:00', viewing_minutes: 30,
  holidays: ['2026-01-01','2026-03-20','2026-03-21','2026-03-22','2026-05-27','2026-05-28','2026-06-26','2026-08-30','2026-12-01','2026-12-02','2026-12-03'],
  compliance_email: '', retention_years: 5, mortgage_partner: '',
};

/** True when the date (YYYY-MM-DD) is a working day and not a holiday. */
export function isWorkingDay(date: string, settings: Pick<AppSettings, 'working_days' | 'holidays'>) {
  if (settings.holidays.includes(date)) return false;
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Asia/Dubai' });
  return (settings.working_days as readonly string[]).includes(day);
}
