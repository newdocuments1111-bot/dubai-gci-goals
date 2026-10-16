import { describe, it, expect } from 'vitest';
import { isWorkingDay, defaultSettings } from './settings';

describe('isWorkingDay', () => {
  it('respects working days and holidays', () => {
    // 2026-10-19 is a Monday in Dubai
    expect(isWorkingDay('2026-10-19', defaultSettings)).toBe(true);
    // 2026-10-17 is a Saturday
    expect(isWorkingDay('2026-10-17', defaultSettings)).toBe(false);
    // 2026-12-02 is a pre-filled UAE holiday (Wednesday)
    expect(isWorkingDay('2026-12-02', defaultSettings)).toBe(false);
  });
});
