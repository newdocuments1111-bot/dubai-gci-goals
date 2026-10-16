import { describe, it, expect } from 'vitest';
import { DAY_MS, needsCheck, eligibleForAI, parseListingsCsv, listingSchema, emptyListing } from './listings';
describe('listing freshness', () => {
  const now = Date.parse('2026-10-16T20:00:00Z');
  it('needs a check after 24 hours', () => { expect(needsCheck(new Date(now - DAY_MS - 1).toISOString(), now)).toBe(true); expect(needsCheck(new Date(now - DAY_MS).toISOString(), now)).toBe(false); });
  it('allows only Available and recently checked inventory for future AI', () => {
    expect(eligibleForAI({ status: 'Available', last_checked: new Date(now).toISOString() }, now)).toBe(true);
    expect(eligibleForAI({ status: 'Reserved', last_checked: new Date(now).toISOString() }, now)).toBe(false);
    expect(eligibleForAI({ status: 'Sold', last_checked: new Date(now).toISOString() }, now)).toBe(false);
    expect(eligibleForAI({ status: 'Available', last_checked: new Date(now - DAY_MS - 1).toISOString() }, now)).toBe(false);
  });
  it('rejects a future or invalid check date', () => { expect(needsCheck('invalid', now)).toBe(true); expect(needsCheck(new Date(now+1).toISOString(), now)).toBe(true); });
});
describe('listing import and validation', () => {
  it('reads quoted descriptions and multiple video links', () => {
    const rows = parseListingsCsv('title,price_aed,description,videos\n"Marina, apartment",2400000,"Bright, spacious",https://example.com/a|https://example.com/b');
    expect(rows[0]?.title).toBe('Marina, apartment'); expect(rows[0]?.price_aed).toBe(2400000); expect(rows[0]?.videos).toHaveLength(2);
  });
  it('rejects invalid statuses instead of partially importing', () => { expect(() => parseListingsCsv('title,status\nOne,Available\nTwo,Unknown')).toThrow('Row 3'); });
  it('allows precisely the three requested statuses', () => { for (const status of ['Available','Reserved','Sold']) expect(listingSchema.safeParse({ ...emptyListing(), title: 'Test', status }).success).toBe(true); expect(listingSchema.safeParse({ ...emptyListing(), title: 'Test', status: 'Needs check' }).success).toBe(false); });
});