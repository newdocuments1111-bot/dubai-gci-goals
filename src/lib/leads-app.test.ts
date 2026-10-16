import { describe, it, expect } from 'vitest';
import { scoreLead, inQuietHours, timezoneFromPhone, amlRedFlags } from './leads-app';

describe('scoreLead', () => {
  it('3 signs = Hot, 2 = Warm, 1 or 0 = Cold', () => {
    expect(scoreLead({ budget: '2M', location: 'Marina', move_in: 'June' })).toBe('Hot');
    expect(scoreLead({ budget: '2M', location: 'Marina' })).toBe('Warm');
    expect(scoreLead({ budget: '2M' })).toBe('Cold');
    expect(scoreLead({})).toBe('Cold');
  });
});

describe('inQuietHours', () => {
  it('blocks 9pm–8am in the client time zone', () => {
    expect(inQuietHours('Asia/Dubai', new Date('2026-10-16T19:00:00Z'))).toBe(true); // 23:00 Dubai
    expect(inQuietHours('Asia/Dubai', new Date('2026-10-16T08:00:00Z'))).toBe(false); // 12:00 Dubai
    expect(inQuietHours('Asia/Dubai', new Date('2026-10-16T03:00:00Z'))).toBe(true); // 07:00 Dubai
  });
  it('never throws on a bad time zone', () => {
    expect(inQuietHours('not/a-zone')).toBe(false);
  });
});

describe('timezoneFromPhone', () => {
  it('maps country codes', () => {
    expect(timezoneFromPhone('+971501234567')).toBe('Asia/Dubai');
    expect(timezoneFromPhone('+44 7700 900000')).toBe('Europe/London');
    expect(timezoneFromPhone('+919876543210')).toBe('Asia/Kolkata');
    expect(timezoneFromPhone('')).toBe('Asia/Dubai');
  });
});

describe('amlRedFlags', () => {
  it('flags cash of AED 55,000 or more', () => {
    expect(amlRedFlags('I will pay 60,000 AED cash').join()).toContain('55,000');
    expect(amlRedFlags('I will pay 20,000 AED cash')).toEqual([]);
  });
  it('flags crypto, third-party payments, ID refusal and rushed deals', () => {
    expect(amlRedFlags('can I pay in bitcoin?').join()).toContain('crypto');
    expect(amlRedFlags('my cousin will pay for me').join()).toContain('third party');
    expect(amlRedFlags("I won't show my ID").join()).toContain('refusing ID');
    expect(amlRedFlags('I need to close the deal today, very urgent').length).toBeGreaterThan(0);
  });
  it('stays quiet on normal messages', () => {
    expect(amlRedFlags('Hi, I am looking for a 2 bed in Marina, budget 2M')).toEqual([]);
  });
});
