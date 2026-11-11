import { describe, it, expect } from 'vitest';
import { isWorkingDay, defaultSettings } from './settings';

describe('isWorkingDay', () => {
  it('respects working days and holidays', () => {
    // 2026-10-19 is a Monday in Dubai
    expect(isWorkingDay('2026-10-19', defaultSettings)).toBe(true);
    // Agencies open 24/7 by default; explicit schedules still restrict days and holidays.
    expect(isWorkingDay('2026-10-17', defaultSettings)).toBe(true);
    expect(isWorkingDay('2026-10-17', { working_days: ['Monday'], holidays: [] })).toBe(false);
    expect(isWorkingDay('2026-12-02', { ...defaultSettings, holidays: ['2026-12-02'] })).toBe(false);
  });
});
