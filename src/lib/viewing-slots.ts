import { defaultSettings, isWorkingDay } from './settings';

export type SlotSettings = Omit<Pick<typeof defaultSettings, 'working_days' | 'holidays' | 'work_start' | 'work_end' | 'viewing_minutes'>, 'working_days'> & { working_days: readonly string[] };
export function calculateFreeSlots(settings: SlotSettings, booked: string[], now = Date.now()) {
  const duration = settings.viewing_minutes * 60000;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const taken = booked.map(Date.parse);
  const [sh = 0, sm = 0] = settings.work_start.split(':').map(Number);
  const [eh = 0, em = 0] = settings.work_end.split(':').map(Number);
  const slots: string[] = [];
  for (let d = 0; d < 14 && slots.length < 40; d++) {
    const date = new Date(now + d * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
    if (!isWorkingDay(date, settings)) continue;
    for (let mins = sh * 60 + sm; mins + settings.viewing_minutes <= eh * 60 + em && slots.length < 40; mins += settings.viewing_minutes) {
      const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
      const start = Date.parse(`${date}T${hh}:${mm}:00+04:00`);
      if (start > now + 3600000 && !taken.some(t => start < t + duration && start + duration > t)) slots.push(new Date(start).toISOString());
    }
  }
  return slots;
}