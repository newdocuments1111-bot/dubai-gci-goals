import { describe, it, expect } from 'vitest';
import { checklistFor, deleteBlocked, documentPath, isLeadDocumentPath, POA_ITEM } from './documents';

describe('checklistFor', () => {
  it('buyer (individual) includes mortgage pre-approval letter', () => {
    expect(checklistFor('buyer')).toContain('Mortgage pre-approval letter (if financing)');
    expect(checklistFor('buyer')).toContain('Passport');
    expect(checklistFor('buyer')).toContain('Source of funds');
  });
  it('buyer company, seller, landlord and tenant checklists', () => {
    expect(checklistFor('buyer', { company: true })).toContain('Ultimate beneficial owner (UBO) declaration');
    expect(checklistFor('seller')).toContain('Title deed');
    expect(checklistFor('landlord')).toEqual(['Title deed', 'Passport', 'Emirates ID / visa (if resident)']);
    expect(checklistFor('tenant')).toEqual(['Passport', 'Visa', 'Emirates ID']);
  });
  it('adds POA when signing for someone else', () => {
    expect(checklistFor('seller', { poa: true })).toContain(POA_ITEM);
  });
});

describe('documentPath', () => {
  it('uses one folder per lead inside the agency folder and strips unsafe characters', () => {
    expect(documentPath('agency-1', 'lead-1', 'passport copy.pdf', 1000)).toBe('agency-1/lead-1/1000-passport_copy.pdf');
    expect(documentPath('agency-1', 'lead-1', '../../x.pdf', 1000)).toBe('agency-1/lead-1/1000-.._.._x.pdf');
  });
});

describe('isLeadDocumentPath', () => {
  it('only accepts a file directly in this lead folder of this agency', () => {
    expect(isLeadDocumentPath('agency-1/lead-1/1000-a.pdf', 'agency-1', 'lead-1')).toBe(true);
    expect(isLeadDocumentPath('agency-1/lead-2/1000-a.pdf', 'agency-1', 'lead-1')).toBe(false);
    expect(isLeadDocumentPath('agency-2/lead-1/1000-a.pdf', 'agency-1', 'lead-1')).toBe(false);
    expect(isLeadDocumentPath('agency-1/lead-1/../lead-2/a.pdf', 'agency-1', 'lead-1')).toBe(false);
    expect(isLeadDocumentPath('agency-1/lead-1/sub/a.pdf', 'agency-1', 'lead-1')).toBe(false);
  });
});

describe('deleteBlocked', () => {
  it('blocks deletion inside the retention period and allows it after', () => {
    const now = Date.parse('2026-10-16T00:00:00Z');
    expect(deleteBlocked('2026-01-01T00:00:00Z', 5, now)).toBe(true);
    expect(deleteBlocked('2020-01-01T00:00:00Z', 5, now)).toBe(false);
    expect(deleteBlocked('not-a-date', 5, now)).toBe(true);
  });
});
