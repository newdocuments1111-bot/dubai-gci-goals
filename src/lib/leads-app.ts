import { z } from 'zod';
import type { Tables } from '@/integrations/supabase/types';

export type Lead = Tables<'leads'>;
export type ChatMessage = Tables<'chat_messages'>;

export const leadSchema = z.object({
  name: z.string().trim().max(200),
  phone: z.string().trim().max(50),
  type: z.enum(['buyer', 'seller', 'landlord', 'tenant', 'other']),
  source: z.enum(['Bayut', 'Property Finder', 'Instagram', 'WhatsApp', 'Website', 'Referral', 'Other']),
  timezone: z.string().trim().max(100),
});
export type LeadInput = z.infer<typeof leadSchema>;

/** Score from the 3 signs: budget, location, move-in time. */
export function scoreLead(learned: Record<string, unknown>): 'Hot' | 'Warm' | 'Cold' {
  const signs = ['budget', 'location', 'move_in'].filter(k => Boolean(learned[k])).length;
  return signs >= 3 ? 'Hot' : signs === 2 ? 'Warm' : 'Cold';
}

/** Non-urgent messages are never sent between 9pm and 8am in the client's time zone. */
export function inQuietHours(timezone: string, now = new Date()) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now));
    return hour >= 21 || hour < 8;
  } catch { return false; }
}

/** Guess a time zone from an international phone code. */
export function timezoneFromPhone(phone: string) {
  const p = phone.replace(/[\s-]/g, '');
  const map: [string, string][] = [
    ['+971', 'Asia/Dubai'], ['+44', 'Europe/London'], ['+91', 'Asia/Kolkata'], ['+92', 'Asia/Karachi'],
    ['+7', 'Europe/Moscow'], ['+86', 'Asia/Shanghai'], ['+33', 'Europe/Paris'], ['+49', 'Europe/Berlin'],
    ['+1', 'America/New_York'], ['+61', 'Australia/Sydney'], ['+966', 'Asia/Riyadh'], ['+974', 'Asia/Qatar'],
  ];
  return map.find(([code]) => p.startsWith(code))?.[1] ?? 'Asia/Dubai';
}

/** AML red flags: cash >= AED 55,000, crypto/virtual assets, third-party payments, refusing ID, rushed deals. Never shown to the client. */
export function amlRedFlags(text: string) {
  const t = text.toLowerCase();
  const flags: string[] = [];
  const cashMatch = t.match(/(?:aed|dhs|dirham)?\s*([\d,]+(?:\.\d+)?)\s*(?:cash|in cash)/) || (t.includes('cash') ? t.match(/([\d,]+(?:\.\d+)?)\s*(?:aed|dhs|dirham)/) : null);
  if (cashMatch && Number(cashMatch[1]?.replace(/,/g, '')) >= 55000) flags.push('cash payment of AED 55,000 or more');
  if (/\b(crypto|bitcoin|btc|usdt|usdc|ethereum|virtual asset)/.test(t)) flags.push('crypto or virtual asset payment');
  if (/third[- ]party|someone else (will|is) pay|another person (will|is) pay|my (friend|cousin|brother|partner) will pay/.test(t)) flags.push('payment from a third party');
  if (/won'?t (show|give|provide) (my )?(id|passport)|refus(e|ing) (id|to show id)|no id\b/.test(t)) flags.push('refusing ID or source of funds');
  if (/(very |super )?(urgent|rushed)|today (or|&) ?today|close (the deal )?today|asap.{0,20}deal/.test(t)) flags.push('very rushed or unusual deal');
  return flags;
}
