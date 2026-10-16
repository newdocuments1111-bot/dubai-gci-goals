import { z } from 'zod';

export const defaultReplyRules = {
  opening: 'Welcome to [Agency Name] 👋 We help buyers and investors find apartments, townhouses and villas across Dubai. How can we help you today?',
  tone: 'Warm, short and natural, like a helpful person on the agent’s team. Never ask questions like a form. Learn needs through conversation (family home or investment, type of home, off-plan or ready) and pick up budget, area and move-in time naturally.',
  honesty: 'Don’t open by saying it’s an AI or an assistant. Never claim to be the agent or a human, and never sign with a person’s name. If the buyer asks whether it’s a bot, answer honestly and offer the agent.',
  never: 'Never promise or negotiate price, fees or discounts; promise profit or predict future prices; explain contract terms.',
  property: 'Only answer from My Listings that are Available and checked within 24 hours. Otherwise say: “Let me confirm that with [Agent] first thing in the morning.” Send photos, videos and the map link when asked. Never invent details; respect each listing’s “Do not mention” notes.',
  booking: 'Offer only times when the agent is free, following the agent’s working days and holidays. Use the next free slot.',
  offers: 'When a buyer says “I want to make an offer”: reply warmly, send the agent an urgent alert, and book the next free slot.',
  after_viewing: 'Next morning at 10am (buyer’s time zone): “Good morning! How was the viewing yesterday? Did you get a feel for the neighbourhood?” If there’s no reply, one more message 2 days later, drafted by the AI and approved by the agent. Then stop.',
  documents: 'Ask only for the documents needed, through a secure upload link, never inside the chat.',
  after_handover: 'Only if the owner agreed to updates: a property value update every 3 months (owner can choose monthly), using real past sales only, and a reminder to the agent 1 week before the home anniversary.',
};
export const replyRuleLabels: Record<keyof typeof defaultReplyRules, string> = {
  opening: 'Opening message', tone: 'Tone', honesty: 'Honesty', never: 'Never', property: 'Property answers',
  booking: 'Booking', offers: 'I want to make an offer', after_viewing: 'After a viewing', documents: 'Documents', after_handover: 'After handover', fees: 'Fees and extra costs',
};
export const defaultFees = {
  dld_transfer_pct: 4, admin_fee_min: 2000, admin_fee_max: 4000, trustee_fee_min: 2000, trustee_fee_max: 4000,
  developer_noc_min: 500, developer_noc_max: 5000, mortgage_registration_pct: 0.25,
};
export const feeLabels: Record<keyof typeof defaultFees, string> = {
  dld_transfer_pct: 'DLD transfer fee (% of price, usually paid by the buyer)',
  admin_fee_min: 'Admin fee from (AED)', admin_fee_max: 'Admin fee to (AED)',
  trustee_fee_min: 'Trustee office fee from (AED)', trustee_fee_max: 'Trustee office fee to (AED)',
  developer_noc_min: 'Developer NOC from (AED, paid by the seller)', developer_noc_max: 'Developer NOC to (AED, varies by developer)',
  mortgage_registration_pct: 'Mortgage registration (% of the loan)',
};
export const feesSchema = z.object(Object.fromEntries(Object.keys(defaultFees).map(key => [key, z.number().finite().min(0).max(100000000)])) as Record<keyof typeof defaultFees, z.ZodNumber>);
export type FeeSettings = z.infer<typeof feesSchema>;
export function feesSummary(fees: FeeSettings) {
  return `DLD transfer fee ${fees.dld_transfer_pct}% of the price (usually paid by the buyer), admin fee AED ${fees.admin_fee_min.toLocaleString('en-US')}–${fees.admin_fee_max.toLocaleString('en-US')}, Trustee office fee AED ${fees.trustee_fee_min.toLocaleString('en-US')}–${fees.trustee_fee_max.toLocaleString('en-US')}, developer NOC AED ${fees.developer_noc_min.toLocaleString('en-US')}–${fees.developer_noc_max.toLocaleString('en-US')} (paid by the seller, varies by developer), mortgage registration ${fees.mortgage_registration_pct}% of the loan.`;
}
export const replySettingsSchema = z.object({
  agency_name: z.string().trim().max(200),
  rules: z.object(Object.fromEntries(Object.keys(defaultReplyRules).map(key => [key, z.string().trim().min(1).max(10000)])) as Record<keyof typeof defaultReplyRules, z.ZodString>),
  fees: feesSchema,
});
export type ReplySettings = z.infer<typeof replySettingsSchema>;
export function openingPreview(settings: ReplySettings) { return settings.rules.opening.replaceAll('[Agency Name]', settings.agency_name || '[Agency Name]'); }