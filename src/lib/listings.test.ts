import { describe, it, expect } from 'vitest';
import { DAY_MS, needsCheck, eligibleForAI, parseListingsCsv, listingSchema, emptyListing, mapsLink, whatsappMessage, matchesListing, defaultListingFilters, type Listing } from './listings';
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
    const rows = parseListingsCsv('title,price_aed,description,videos,permit_number\n"Marina, apartment",2400000,"Bright, spacious",https://example.com/a|https://example.com/b,123');
    expect(rows[0]?.title).toBe('Marina, apartment'); expect(rows[0]?.price_aed).toBe(2400000); expect(rows[0]?.videos).toHaveLength(2);
  });
  it('rejects invalid statuses instead of partially importing', () => { expect(() => parseListingsCsv('title,status\nOne,Available\nTwo,Unknown')).toThrow('Row 3'); });
  it('allows precisely the three requested statuses', () => { for (const status of ['Available','Reserved','Sold']) expect(listingSchema.safeParse({ ...emptyListing(), title: 'Test', status, permit_number: '123' }).success).toBe(true); expect(listingSchema.safeParse({ ...emptyListing(), title: 'Test', status: 'Needs check' }).success).toBe(false); });
});
describe('listing actions', () => {
  const now = Date.parse('2026-10-16T20:00:00Z');
  const listing = { ...emptyListing(), title: 'Marina apartment', project: 'Marina Gate', community: 'Dubai Marina', bedrooms: 2, size_sqft: 1400, price_aed: 2400000, last_checked: new Date(now).toISOString() };
  it('requires a permit for Available but not Reserved or Sold', () => {
    expect(listingSchema.safeParse({ ...listing, permit_number: '  ' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, permit_number: '123' }).success).toBe(true);
    for (const status of ['Reserved', 'Sold']) expect(listingSchema.safeParse({ ...listing, status }).success).toBe(true);
  });
  it('creates a map search from building, community and Dubai unless a map exists', () => {
    expect(mapsLink(listing)).toBe('https://www.google.com/maps/search/?api=1&query=Marina%20Gate%20Dubai%20Marina%20Dubai');
    expect(mapsLink({ ...listing, maps_url: 'https://maps.google.com/?q=Dubai' })).toBe('https://maps.google.com/?q=Dubai');
  });
  it('includes WhatsApp price only for Available and checked within 24 hours', () => {
    expect(whatsappMessage(listing, 'https://example.com/photo.jpg', now)).toContain('AED 2,400,000');
    expect(whatsappMessage({ ...listing, last_checked: new Date(now - DAY_MS).toISOString() }, undefined, now)).toContain('AED 2,400,000');
    expect(whatsappMessage({ ...listing, last_checked: new Date(now - DAY_MS - 1).toISOString() }, undefined, now)).not.toContain('AED');
    for (const status of ['Reserved', 'Sold'] as const) expect(whatsappMessage({ ...listing, status }, undefined, now)).not.toContain('AED');
    const text = whatsappMessage(listing, 'https://example.com/photo.jpg', now);
    for (const detail of ['Marina apartment', 'Dubai Marina', '2 beds', '1,400 sq ft', 'Ready', mapsLink(listing), 'https://example.com/photo.jpg']) expect(text).toContain(detail);
  });
  it('combines title/building search with all requested filters and inclusive prices', () => {
    const row = listing as Listing;
    const filters = { ...defaultListingFilters, search: 'gate', community: 'Dubai Marina', status: 'Available', bedrooms: '2', completion: 'ready', minPrice: '2400000', maxPrice: '2400000' };
    expect(matchesListing(row, filters, now)).toBe(true);
    for (const change of [{ search: 'villa' }, { community: 'Downtown' }, { status: 'Sold' }, { bedrooms: '3' }, { completion: 'off-plan' }, { minPrice: '2400001' }, { maxPrice: '2399999' }]) expect(matchesListing(row, { ...filters, ...change }, now)).toBe(false);
  });
});