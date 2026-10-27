import { describe, expect, it } from 'vitest';
import { appIsSubscribed, connectionSummary, describeIncoming, META_APP_ID, missingScopes, isStopMessage, normalizeRecipients, sendBlockReason, splitWebhookPayload, withinServiceWindow } from './whatsapp';

const settings = { phone_number_id: '1429713293548712', test_mode: true, test_recipients: ['919989649633', '918328448065'] };
const now = new Date('2026-10-27T10:00:00Z');
const recent = '2026-10-27T09:00:00Z';

describe('test-mode safety list', () => {
  it('allows a number on the safety list while test mode is on', () => {
    expect(sendBlockReason({ settings, to: '+91 99896 49633', stopped: false, lastInboundAt: recent, now })).toBeNull();
  });
  it('refuses any other number while test mode is on', () => {
    expect(sendBlockReason({ settings, to: '+971501234567', stopped: false, lastInboundAt: recent, now })).toMatch(/Test mode is on/);
  });
  it('allows other numbers once test mode is off', () => {
    expect(sendBlockReason({ settings: { ...settings, test_mode: false }, to: '+971501234567', stopped: false, lastInboundAt: recent, now })).toBeNull();
  });
  it('cleans typed numbers to digits', () => {
    expect(normalizeRecipients(['+91 99896 49633', '00918328448065', '+919989649633', '12'])).toEqual(['919989649633', '918328448065']);
  });
});

describe('24-hour rule', () => {
  it('is open 23 hours after the buyer last wrote', () => {
    expect(withinServiceWindow('2026-10-26T11:00:00Z', now)).toBe(true);
  });
  it('is closed 24 hours after the buyer last wrote', () => {
    expect(withinServiceWindow('2026-10-26T10:00:00Z', now)).toBe(false);
    expect(sendBlockReason({ settings, to: '919989649633', stopped: false, lastInboundAt: '2026-10-26T09:00:00Z', now })).toMatch(/24-hour/);
  });
  it('is closed when the buyer never wrote on WhatsApp', () => {
    expect(withinServiceWindow(null, now)).toBe(false);
  });
});

describe('STOP words', () => {
  it.each(['STOP', 'stop.', 'Unsubscribe', 'please unsubscribe me', 'توقف', 'إلغاء', 'stop messaging me'])('stops on "%s"', w => {
    expect(isStopMessage(w)).toBe(true);
  });
  it.each(['Is there a bus stop nearby?', 'Hi, 2BHK in Marina', "don't cancel my viewing"])('does not stop on "%s"', w => {
    expect(isStopMessage(w)).toBe(false);
  });
  it('never sends to a stopped client', () => {
    expect(sendBlockReason({ settings, to: '919989649633', stopped: true, lastInboundAt: recent, now })).toMatch(/asked to stop/);
  });
});

describe('webhook payload', () => {
  const body = { entry: [{ id: '1135797042296710', changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: '1429713293548712' }, contacts: [{ wa_id: '919989649633', profile: { name: 'Ravi' } }],
    messages: [{ id: 'wamid.A', from: '919989649633', type: 'text', text: { body: 'Hi' } }],
    statuses: [{ id: 'wamid.B', status: 'delivered', timestamp: '1761559200' }],
  } }] }] };
  it('stores each message and status once by its id', () => {
    const events = splitWebhookPayload(body);
    expect(events.map(e => e.delivery_key)).toEqual(['message:wamid.A', 'status:wamid.B:delivered']);
    expect(events[0]!.phone_number_id).toBe('1429713293548712');
  });
  it('reads button replies and locations as text', () => {
    expect(describeIncoming({ type: 'interactive', interactive: { button_reply: { title: 'Yes, book it' } } }).content).toBe('Yes, book it');
    expect(describeIncoming({ type: 'location', location: { latitude: 25.08, longitude: 55.14, name: 'Marina Walk' } }).content).toContain('https://www.google.com/maps?q=25.08,55.14');
  });
});

describe('connection check', () => {
  const okFindings = {
    token: { valid: true, missing: [], expiresAt: 0 },
    subscription: { subscribed: true, fixedNow: false },
    phone: { ok: true, number: '+1 555-172-9366', name: 'Test Number', status: 'CONNECTED', quality: 'GREEN', mode: 'LIVE' },
  };
  it('needs both WhatsApp permissions on the token', () => {
    expect(missingScopes(['whatsapp_business_messaging', 'public_profile'])).toEqual(['whatsapp_business_management']);
    expect(missingScopes(['whatsapp_business_messaging', 'whatsapp_business_management'])).toEqual([]);
  });
  it('detects our app only by its own app id, not Meta’s test app', () => {
    const metaOnly = { data: [{ whatsapp_business_api_data: { id: '2202427980234937' } }] };
    expect(appIsSubscribed(metaOnly)).toBe(false);
    expect(appIsSubscribed({ data: [...metaOnly.data, { whatsapp_business_api_data: { id: META_APP_ID } }] })).toBe(true);
    expect(META_APP_ID).toBe('969605275709145');
  });
  it('is not ready while the app is unsubscribed', () => {
    expect(connectionSummary({ ...okFindings, subscription: { subscribed: false, fixedNow: false } }).ok).toBe(false);
  });
  it('is not ready when a permission is missing', () => {
    expect(connectionSummary({ ...okFindings, token: { valid: true, missing: ['whatsapp_business_management'] } }).ok).toBe(false);
  });
  it('is ready when token, subscription and number all pass, and keeps the note within 500 characters', () => {
    const r = connectionSummary(okFindings);
    expect(r.ok).toBe(true);
    expect(r.detail.length).toBeLessThanOrEqual(500);
  });
});
