import { describe, expect, it } from 'vitest';
import { appointmentTransition, chatLeadScore, mergeLearned, chatAnswerSchema } from './chat-policy';
import { calculateFreeSlots } from './viewing-slots';

const slots: [string, string] = ['2026-10-19T05:00:00.000Z', '2026-10-19T05:30:00.000Z'];
describe('Test Chat appointment rules', () => {
  it('does not offer times before agreement to an invitation', () => {
    expect(appointmentTransition(undefined, 'accept', slots)).toBeUndefined();
    expect(appointmentTransition(undefined, 'invite', slots)).toEqual({ phase: 'invited', slots: [] });
  });
  it('offers two free times only after agreement', () => {
    expect(appointmentTransition({ phase: 'invited', slots: [] }, 'accept', [...slots, '2026-10-19T06:00:00.000Z'])).toEqual({ phase: 'offered', slots });
  });
  it('books only the chosen previously offered free time', () => {
    const offered = { phase: 'offered' as const, slots };
    expect(appointmentTransition(offered, 'choose', slots, 1)).toEqual({ phase: 'booked', slots: [slots[1]] });
    expect(appointmentTransition(offered, 'choose', [slots[0]], 1)).toEqual(offered);
    expect(appointmentTransition({ phase: 'invited', slots: [] }, 'choose', slots, 0)?.phase).toBe('invited');
  });
  it('does not book when the client has not chosen a time', () => {
    expect(appointmentTransition({ phase: 'offered', slots }, 'choose', slots)?.phase).toBe('offered');
  });
  it('respects declined appointments', () => {
    expect(appointmentTransition({ phase: 'invited', slots: [] }, 'decline', slots)).toBeUndefined();
  });
});
describe('Hot leads', () => {
  it('does not stop a conversation on a false string or omitted optional flags', () => {
    expect(chatAnswerSchema.parse({ reply: 'Hello', stopped: 'false', flag: null }).stopped).toBe(false);
    expect(chatAnswerSchema.parse({ reply: 'Stopped', stopped: 'true' }).stopped).toBe(true);
  });
  it('makes three known signs Hot without a model hot flag', () => {
    expect(chatLeadScore({ budget: '2M AED', location: 'Marina', move_in: 'June' }, 'none')).toBe('Hot');
  });
  it('makes viewing intent Hot even without qualification facts', () => {
    expect(chatLeadScore({}, 'viewing')).toBe('Hot');
  });
  it('makes offer intent Hot even without qualification facts', () => {
    expect(chatLeadScore({}, 'offer')).toBe('Hot');
  });
  it('keeps known budget, area and move-in when omitted in a later answer', () => {
    expect(mergeLearned({ budget: '2M', location: 'Marina' }, { budget: null, location: '', move_in: 'June', _appointment: 'forged' })).toEqual({ budget: '2M', location: 'Marina', move_in: 'June' });
  });
});
describe('appointment availability from Settings', () => {
  const settings = { working_days: ['Monday'], holidays: [], work_start: '09:00', work_end: '10:30', viewing_minutes: 30 };
  const now = Date.parse('2026-10-18T08:00:00Z');
  it('uses Settings hours and duration, excluding booked times', () => {
    expect(calculateFreeSlots(settings, [slots[0]], now).slice(0, 2)).toEqual([slots[1], '2026-10-19T06:00:00.000Z']);
  });
  it('excludes holidays from Settings', () => {
    expect(calculateFreeSlots({ ...settings, holidays: ['2026-10-19'] }, [], now)).not.toContain(slots[0]);
  });
  it('excludes appointments overlapping a booking', () => {
    expect(calculateFreeSlots(settings, ['2026-10-19T05:15:00.000Z'], now)).not.toContain(slots[0]);
    expect(calculateFreeSlots(settings, ['2026-10-19T05:15:00.000Z'], now)).not.toContain(slots[1]);
  });
});