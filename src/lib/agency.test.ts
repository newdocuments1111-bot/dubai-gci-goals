import { describe, expect, it } from 'vitest';
import { averageReplyMinutes, canInvite, canOwnerSetOthersGoal, canSetOwnGoal, dealMath, gciSummary, goalProgress, hoursSaved, isMissedLead, loginLimitMessage, rankLeaderboard } from './agency';

describe('deal GCI', () => {
  it('GCI = price × commission %, agent share = GCI × split %, agency share = rest', () => {
    expect(dealMath({ price: 2_000_000, commissionPercent: 2, splitPercent: 50 })).toEqual({ gci: 40_000, agentShare: 20_000, agencyShare: 20_000 });
    expect(dealMath({ price: 120_000, commissionPercent: 5, splitPercent: 70 })).toEqual({ gci: 6_000, agentShare: 4_200, agencyShare: 1_800 });
  });
  it('counts only closed deals and uses each agent split (default 50%)', () => {
    const now = new Date('2026-10-20T10:00:00Z');
    const s = gciSummary([
      { agent_id: 'a', price_aed: 1_000_000, commission_percent: 2, status: 'closed', closed_at: '2026-10-05T10:00:00Z', ai_handled: true },
      { agent_id: 'a', price_aed: 1_000_000, commission_percent: 2, status: 'closed', closed_at: '2026-03-05T10:00:00Z', ai_handled: false },
      { agent_id: 'b', price_aed: 5_000_000, commission_percent: 2, status: 'under offer', closed_at: null, ai_handled: true },
    ], [{ user_id: 'a', display_name: 'A', email: '', split_percent: 60, annual_gci_goal_aed: null, role: 'agent' }], now);
    expect(s.month).toBe(20_000);
    expect(s.year).toBe(40_000);
    expect(s.agencyYear).toBe(16_000);
    expect(s.aiHandledDeals).toBe(1);
  });
});

describe('logins and goals', () => {
  it('blocks invites at the plan limit with the Elite Visions message', () => {
    expect(canInvite(2, 3)).toBe(true);
    expect(canInvite(3, 3)).toBe(false);
    expect(loginLimitMessage(3)).toBe('Your plan has 3 logins. Contact Elite Visions to add more.');
  });
  it('follows the goal setting mode', () => {
    expect(canSetOwnGoal('owner', false)).toBe(false);
    expect(canSetOwnGoal('agent', false)).toBe(true);
    expect(canSetOwnGoal('both', false)).toBe(true);
    expect(canOwnerSetOthersGoal('agent')).toBe(false);
    expect(canOwnerSetOthersGoal('owner')).toBe(true);
  });
  it('caps goal progress at 100%', () => {
    expect(goalProgress(250_000, 1_000_000)).toBe(25);
    expect(goalProgress(2_000_000, 1_000_000)).toBe(100);
    expect(goalProgress(10, null)).toBe(0);
  });
});

describe('owner tools', () => {
  it('hours saved = AI replies × 2 minutes by default', () => {
    expect(hoursSaved(90, 2)).toBe(3);
  });
  it('a lead is missed after 15 minutes without a reply', () => {
    const now = new Date('2026-10-20T10:20:00Z');
    expect(isMissedLead([{ role: 'client', created_at: '2026-10-20T10:00:00Z' }], 15, now)).toBe(true);
    expect(isMissedLead([{ role: 'client', created_at: '2026-10-20T10:10:00Z' }], 15, now)).toBe(false);
    expect(isMissedLead([{ role: 'client', created_at: '2026-10-20T10:00:00Z' }, { role: 'ai', created_at: '2026-10-20T10:01:00Z' }], 15, now)).toBe(false);
  });
  it('averages reply time and ranks by GCI, then reply speed', () => {
    expect(averageReplyMinutes([
      { lead_id: 'l', role: 'client', created_at: '2026-10-20T10:00:00Z' },
      { lead_id: 'l', role: 'owner', created_at: '2026-10-20T10:04:00Z' },
      { lead_id: 'l', role: 'client', created_at: '2026-10-20T11:00:00Z' },
      { lead_id: 'l', role: 'ai', created_at: '2026-10-20T11:02:00Z' },
    ])).toBe(3);
    const ranked = rankLeaderboard([
      { userId: 'slow', name: 'S', gciYear: 10, avgReplyMinutes: 30, viewings: 1 },
      { userId: 'fast', name: 'F', gciYear: 10, avgReplyMinutes: 2, viewings: 1 },
      { userId: 'top', name: 'T', gciYear: 99, avgReplyMinutes: null, viewings: 0 },
    ]);
    expect(ranked.map(r => r.userId)).toEqual(['top', 'fast', 'slow']);
  });
});
