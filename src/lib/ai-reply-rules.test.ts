import { describe,it,expect } from 'vitest';
import { defaultReplyRules, defaultFees, feesSummary, openingPreview, replySettingsSchema } from './ai-reply-rules';

const base = { agency_name:'', rules:defaultReplyRules, fees:defaultFees, voice_replies:false };

describe('reply settings', () => {
  it('uses the editable agency name in the opening', () => {
    expect(openingPreview({ ...base, agency_name:'Dubai Homes' })).toBe('Welcome to Dubai Homes 👋 We help buyers and investors find apartments, townhouses and villas across Dubai. How can we help you today?');
  });
  it('keeps Voice replies off unless it is switched on', () => {
    expect(replySettingsSchema.parse({ agency_name:'', rules:defaultReplyRules, fees:defaultFees }).voice_replies).toBe(false);
    expect(replySettingsSchema.parse({ ...base, voice_replies:true }).voice_replies).toBe(true);
  });
  it('requires all rules and rejects empty rule values', () => {
    expect(replySettingsSchema.safeParse(base).success).toBe(true);
    expect(replySettingsSchema.safeParse({ ...base, rules:{ ...defaultReplyRules,booking:'' } }).success).toBe(false);
  });
  it('defaults to DLD 4%, admin 2,000–4,000, trustee 2,000–4,000, NOC 500–5,000, mortgage 0.25%', () => {
    expect(defaultFees).toEqual({ dld_transfer_pct:4, admin_fee_min:2000, admin_fee_max:4000, trustee_fee_min:2000, trustee_fee_max:4000, developer_noc_min:500, developer_noc_max:5000, mortgage_registration_pct:0.25 });
  });
  it('rejects negative fee amounts', () => {
    expect(replySettingsSchema.safeParse({ ...base, fees:{ ...defaultFees, dld_transfer_pct:-1 } }).success).toBe(false);
  });
  it('summarises the editable fees for the AI', () => {
    expect(feesSummary(defaultFees)).toBe('DLD transfer fee 4% of the price (usually paid by the buyer), admin fee AED 2,000–4,000, Trustee office fee AED 2,000–4,000, developer NOC AED 500–5,000 (paid by the seller, varies by developer), mortgage registration 0.25% of the loan.');
  });
  it('fees rule says amounts are approximate and the agent confirms', () => {
    expect(defaultReplyRules.fees).toContain('approximate');
    expect(defaultReplyRules.fees).toContain('agent will confirm');
  });
});