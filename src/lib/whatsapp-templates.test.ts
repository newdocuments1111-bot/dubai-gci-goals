import { describe, expect, it } from 'vitest';
import {
  consentRecordOk, dubaiSendWindow, ensureStopLine, mapMetaStatus, missingValues, outboxDecision, renderTemplate,
  templateNameFrom, templateProblems, toMetaBody,
} from './whatsapp-templates';

const settings = { phone_number_id: '123', test_mode: true, test_recipients: ['919989649633', '918328448065'] };
const lead = { phone: '+91 99896 49633', stopped: false, opted_in: true };
const approvedMarketing = { meta_status: 'approved', category: 'marketing' };
const inHours = new Date('2026-10-27T08:00:00Z'); // 12:00 Dubai
const base = { lead, consentOk: true, template: approvedMarketing, settings, lastMarketingSentAt: null, gapDays: 7, now: inHours };

describe('template writing', () => {
  it('adds "Reply STOP to stop" to marketing templates only, once', () => {
    expect(ensureStopLine('New villas in {{area}} this week, take a look', 'marketing')).toBe('New villas in {{area}} this week, take a look\n\nReply STOP to stop.');
    expect(ensureStopLine('Hello. Reply STOP to stop', 'marketing')).toBe('Hello. Reply STOP to stop');
    expect(ensureStopLine('Your viewing is confirmed', 'utility')).toBe('Your viewing is confirmed');
  });
  it('maps named blanks to Meta positions in order', () => {
    expect(toMetaBody('Hi {{name}}, {{property}} in {{area}} is ready')).toEqual({ metaBody: 'Hi {{1}}, {{2}} in {{3}} is ready', variables: ['name', 'property', 'area'] });
  });
  it('makes a valid Meta template name', () => {
    expect(templateNameFrom('New Launch – Marina!')).toBe('new_launch_marina');
  });
  it('rejects blanks at the start, missing examples and malformed blanks', () => {
    expect(templateProblems({ label: 'x', body: '{{name}} hello there friend', category: 'utility', examples: { name: 'Sara' } })).toContain('The message cannot start with a blank. Add a word first, e.g. "Hi {{name}}".');
    expect(templateProblems({ label: 'x', body: 'Hi {{name}}, we have new homes for you to see this week', category: 'marketing', examples: {} })).toContain('Add an example value for: name.');
    expect(templateProblems({ label: 'x', body: 'Hi {{ Name }} there', category: 'utility', examples: {} }).join(' ')).toContain('Blanks must look like');
    expect(templateProblems({ label: 'x', body: 'Hi {{name}}, we have new homes for you to see this week', category: 'marketing', examples: { name: 'Sara' } })).toEqual([]);
  });
  it('fills a preview and lists missing values', () => {
    expect(renderTemplate('Hi {{name}} in {{area}}', { name: 'Sara' })).toBe('Hi Sara in [area]');
    expect(missingValues(['name', 'area'], { name: 'Sara', area: '  ' })).toEqual(['area']);
  });
  it('maps Meta statuses', () => {
    expect(mapMetaStatus('APPROVED')).toBe('approved');
    expect(mapMetaStatus('REJECTED')).toBe('rejected');
    expect(mapMetaStatus('PAUSED')).toBe('paused');
    expect(mapMetaStatus('IN_APPEAL')).toBe('pending');
  });
});

describe('send rules (checked before every send)', () => {
  it('sends when every rule passes', () => {
    expect(outboxDecision(base)).toEqual({ action: 'send' });
  });
  it('blocks without opted_in or without a consent record', () => {
    expect(outboxDecision({ ...base, lead: { ...lead, opted_in: false } }).action).toBe('block');
    expect(outboxDecision({ ...base, consentOk: false }).action).toBe('block');
    expect(consentRecordOk('Agreed to future property check-ins')).toBe(true);
    expect(consentRecordOk('Withdrew future property check-in consent')).toBe(false);
    expect(consentRecordOk('Stopped all messages')).toBe(false);
    expect(consentRecordOk(null)).toBe(false);
  });
  it('blocks stopped clients', () => {
    expect(outboxDecision({ ...base, lead: { ...lead, stopped: true } })).toEqual({ action: 'block', reason: 'This client asked to stop. No more messages are sent.' });
  });
  it('blocks templates Meta has not approved', () => {
    const d = outboxDecision({ ...base, template: { meta_status: 'pending', category: 'marketing' } });
    expect(d).toEqual({ action: 'block', reason: 'The template is not approved by Meta (status: pending).' });
  });
  it('respects the test-mode safety list', () => {
    const d = outboxDecision({ ...base, lead: { ...lead, phone: '+971501234567' } });
    expect(d).toEqual({ action: 'block', reason: 'Test mode is on: only numbers on the safety list can receive messages.' });
  });
  it('allows one marketing message per 7 days, but not utility limits', () => {
    const sixDaysAgo = new Date(inHours.getTime() - 6 * 86_400_000).toISOString();
    const eightDaysAgo = new Date(inHours.getTime() - 8 * 86_400_000).toISOString();
    expect(outboxDecision({ ...base, lastMarketingSentAt: sixDaysAgo }).action).toBe('block');
    expect(outboxDecision({ ...base, lastMarketingSentAt: eightDaysAgo }).action).toBe('send');
    expect(outboxDecision({ ...base, template: { meta_status: 'approved', category: 'utility' }, lastMarketingSentAt: sixDaysAgo }).action).toBe('send');
  });
  it('schedules outside 9am–8pm Dubai for the next 9am', () => {
    expect(outboxDecision({ ...base, now: new Date('2026-10-27T16:00:00Z') })).toEqual({ action: 'schedule', at: new Date('2026-10-28T05:00:00Z') }); // 8pm Dubai
    expect(outboxDecision({ ...base, now: new Date('2026-10-27T04:59:00Z') })).toEqual({ action: 'schedule', at: new Date('2026-10-27T05:00:00Z') }); // 8:59am
    expect(dubaiSendWindow(new Date('2026-10-27T05:00:00Z')).open).toBe(true); // 9:00am
    expect(dubaiSendWindow(new Date('2026-10-27T15:59:00Z')).open).toBe(true); // 7:59pm
    expect(dubaiSendWindow(new Date('2026-10-27T22:00:00Z')).nextOpen).toEqual(new Date('2026-10-28T05:00:00Z')); // 2am
  });
  it('blocks when a blank is not filled', () => {
    expect(outboxDecision({ ...base, missing: ['price'] })).toEqual({ action: 'block', reason: 'Fill in: price.' });
  });
});
