import { z } from 'zod';
import Papa from 'papaparse';
import type { Tables } from '@/integrations/supabase/types';

export type Listing = Tables<'listings'>;
export const DAY_MS = 24 * 60 * 60 * 1000;
const safeUrl = z.string().max(2000).refine(v => !v || /^https:\/\//i.test(v), 'Use an https:// link');
const media = z.string().max(2000).refine(v => /^https:\/\//i.test(v) || /^listings\/[a-zA-Z0-9/_\-.]+$/.test(v), 'Invalid media path');
export const listingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  community: z.string().trim().max(200), project: z.string().trim().max(200),
  property_type: z.enum(['apartment', 'villa', 'townhouse']),
  bedrooms: z.number().int().min(0).max(30), size_sqft: z.number().finite().min(0).max(10000000),
  price_aed: z.number().finite().min(0).max(100000000000),
  completion: z.enum(['ready', 'off-plan']),
  handover_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v; }, 'Invalid handover date').nullable(),
  status: z.enum(['Available', 'Reserved', 'Sold']), description: z.string().max(20000),
  photos: z.array(media).max(50), videos: z.array(media).max(20), maps_url: safeUrl,
  permit_number: z.string().trim().max(100),
  last_checked: z.string().datetime({ offset: true }).refine(v => new Date(v).getTime() <= Date.now() + 60000, 'Last checked cannot be in the future'),
});
export type ListingInput = z.infer<typeof listingSchema>;
export const emptyListing = (): ListingInput => ({ title: '', community: '', project: '', property_type: 'apartment', bedrooms: 0, size_sqft: 0, price_aed: 0, completion: 'ready', handover_date: null, status: 'Available', description: '', photos: [], videos: [], maps_url: '', permit_number: '', last_checked: new Date().toISOString() });
export function needsCheck(lastChecked: string, now = Date.now()) {
  const time = Date.parse(lastChecked);
  return !Number.isFinite(time) || time > now || now - time > DAY_MS;
}
export function eligibleForAI(listing: Pick<Listing, 'status' | 'last_checked'>, now = Date.now()) {
  return listing.status === 'Available' && !needsCheck(listing.last_checked, now);
}
export function dubaiDate(timestamp: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}
export const csvColumns = ['title','community','project','property_type','bedrooms','size_sqft','price_aed','completion','handover_date','status','description','maps_url','permit_number','last_checked','photos','videos'];
export function parseListingsCsv(text: string): ListingInput[] {
  const parsed = Papa.parse<Record<string,string>>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim().toLowerCase().replace(/^\uFEFF/, '') });
  if (parsed.errors.length) throw new Error(`CSV error: ${parsed.errors[0]?.message}`);
  if (!parsed.meta.fields?.includes('title')) throw new Error('CSV needs a title column. Download the template for supported columns.');
  if (!parsed.data.length || parsed.data.length > 500) throw new Error('Import between 1 and 500 listings at a time.');
  return parsed.data.map((r, i) => {
    const input = { ...emptyListing(), ...Object.fromEntries(Object.entries(r).filter(([k]) => csvColumns.includes(k))),
      bedrooms: Number(r.bedrooms || 0), size_sqft: Number(r.size_sqft || 0), price_aed: Number(r.price_aed || 0),
      property_type: r.property_type?.trim().toLowerCase() || 'apartment', completion: r.completion?.trim().toLowerCase() || 'ready',
      status: r.status?.trim() || 'Available', handover_date: r.handover_date?.trim() || null,
      last_checked: r.last_checked ? new Date(r.last_checked).toISOString() : new Date().toISOString(),
      photos: r.photos ? r.photos.split('|').map(v => v.trim()).filter(Boolean) : [],
      videos: r.videos ? r.videos.split('|').map(v => v.trim()).filter(Boolean) : [],
    };
    const result = listingSchema.safeParse(input);
    if (!result.success) throw new Error(`Row ${i + 2}: ${result.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
    return result.data;
  });
}