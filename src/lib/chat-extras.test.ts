import { describe, expect, it } from 'vitest';
import { DEMO_MESSAGE_LIMIT, demoProperties, leadsCsv, revivalEligible } from './chat-extras';
import type { Lead } from './leads-app';
describe('requested chat extras rules', () => {
  it('limits the demo to 20 messages per day', () => { expect(DEMO_MESSAGE_LIMIT).toBe(20); });
  it('has only sample properties, with no contact data', () => {
    expect(demoProperties.every(p => p.sample)).toBe(true);
    expect(demoProperties.some(p => 'phone' in p || 'lead_id' in p)).toBe(false);
  });
  it('exports the requested eight fields and prevents formula injection', () => {
    const lead = { name: '=EVIL()', phone: '+971123', source: 'Website', score: 'Hot', learned: { location: 'Marina', budget: 2000000, move_in: 'December' }, last_message_at: '2026-10-18T08:00:00Z' } as Lead;
    const csv = leadsCsv([lead]);
    expect(csv.split('\r\n')[0]).toBe('name,phone,source,score,area,budget,timing,last message date');
    expect(csv).toContain("'=EVIL()"); expect(csv).toContain('Marina,2000000,December,2026-10-18T08:00:00Z');
  });
  it('requires consent for old-lead revival', () => { expect(revivalEligible({ opted_in: false, stopped: false, last_message_at: '2026-08-01T00:00:00Z' }, new Date('2026-10-18'))).toBe(false); });
  it('never revives stopped leads', () => { expect(revivalEligible({ opted_in: true, stopped: true, last_message_at: '2026-08-01T00:00:00Z' }, new Date('2026-10-18'))).toBe(false); });
  it('drafts only after 30 inactive days', () => {
    expect(revivalEligible({ opted_in: true, stopped: false, last_message_at: '2026-10-01T00:00:00Z' }, new Date('2026-10-18'))).toBe(false);
    expect(revivalEligible({ opted_in: true, stopped: false, last_message_at: '2026-08-01T00:00:00Z' }, new Date('2026-10-18'))).toBe(true);
  });
});