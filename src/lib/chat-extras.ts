import Papa from 'papaparse';
import type { Lead } from './leads-app';

export const DEMO_MESSAGE_LIMIT = 20;
export const demoProperties = [
  { sample: true, title: 'Sample Marina apartment', community: 'Dubai Marina', bedrooms: 2, size_sqft: 1250, price_aed: 2000000, amenities: 'Pool, gym, parking', status: 'Available' },
  { sample: true, title: 'Sample JVC townhouse', community: 'JVC', bedrooms: 3, size_sqft: 2200, price_aed: 2800000, amenities: 'Garden, parking', status: 'Available' },
  { sample: true, title: 'Sample Dubai Hills villa', community: 'Dubai Hills', bedrooms: 4, size_sqft: 3400, price_aed: 6500000, amenities: 'Garden, community park', status: 'Available' },
] as const;
export function leadsCsv(leads: Pick<Lead, 'name' | 'phone' | 'source' | 'score' | 'learned' | 'last_message_at'>[]) {
  return Papa.unparse(leads.map(l => {
    const facts = l.learned as Record<string, unknown>;
    return { name: l.name, phone: l.phone, source: l.source, score: l.score, area: facts['location'] ?? '', budget: facts['budget'] ?? '', timing: facts['move_in'] ?? '', 'last message date': l.last_message_at ?? '' };
  }), { escapeFormulae: true, columns: ['name','phone','source','score','area','budget','timing','last message date'] });
}
export function revivalEligible(lead: Pick<Lead, 'opted_in' | 'stopped' | 'last_message_at'>, now = new Date()) {
  return lead.opted_in && !lead.stopped && Boolean(lead.last_message_at && new Date(lead.last_message_at).getTime() < now.getTime() - 30 * 86400000);
}
export function downloadCsv(csv: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = 'dubai-ai-gci-leads.csv'; link.click(); URL.revokeObjectURL(url);
}