import { describe,it,expect } from 'vitest';
import { defaultReplyRules, openingPreview, replySettingsSchema } from './ai-reply-rules';

describe('reply settings', () => {
  it('uses the editable agency name in the opening', () => {
    expect(openingPreview({ agency_name:'Dubai Homes',rules:defaultReplyRules })).toBe('Welcome to Dubai Homes 👋 We help buyers and investors find apartments, townhouses and villas across Dubai. How can we help you today?');
  });
  it('requires all rules and rejects empty rule values', () => {
    expect(replySettingsSchema.safeParse({ agency_name:'',rules:defaultReplyRules }).success).toBe(true);
    expect(replySettingsSchema.safeParse({ agency_name:'',rules:{ ...defaultReplyRules,booking:'' } }).success).toBe(false);
  });
});