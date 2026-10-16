import { z } from 'zod';
import Papa from 'papaparse';
import type { Tables } from '@/integrations/supabase/types';

export type MarketTransaction = Tables<'market_transactions'>;

export const marketRowSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates'),
  area: z.string().trim().min(1, 'Area is required').max(200),
  building: z.string().trim().max(200),
  property_type: z.string().trim().max(100),
  size_sqft: z.number().finite().min(0).max(10000000),
  price_aed: z.number().finite().min(0).max(100000000000),
});
export type MarketRow = z.infer<typeof marketRowSchema>;

export const marketCsvColumns = ['transaction_date', 'area', 'building', 'property_type', 'size_sqft', 'price_aed'];

export function parseMarketCsv(text: string): MarketRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim().toLowerCase().replace(/^﻿/, '') });
  if (parsed.errors.length) throw new Error(`CSV error: ${parsed.errors[0]?.message}`);
  if (!parsed.meta.fields?.includes('area') || !parsed.meta.fields?.includes('price_aed')) throw new Error('CSV needs at least area and price_aed columns. Download the template for supported columns.');
  if (!parsed.data.length || parsed.data.length > 5000) throw new Error('Import between 1 and 5,000 transactions at a time.');
  return parsed.data.map((r, i) => {
    const input = {
      transaction_date: (r['transaction_date'] || r['date'] || '').trim().slice(0, 10),
      area: (r['area'] || '').trim(), building: (r['building'] || '').trim(), property_type: (r['property_type'] || r['type'] || '').trim(),
      size_sqft: Number(r['size_sqft'] || r['size'] || 0), price_aed: Number(String(r['price_aed'] || r['price'] || '').replace(/[, ]/g, '')),
    };
    const result = marketRowSchema.safeParse(input);
    if (!result.success) throw new Error(`Row ${i + 2}: ${result.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
    return result.data;
  });
}

/** Real past sales for an area/building — the only data value updates may use. */
export function salesForArea(rows: MarketTransaction[], area: string, building?: string) {
  const match = rows.filter(r => r.area === area && (!building || r.building === building));
  const scoped = match.length ? match : rows.filter(r => r.area === area);
  return scoped.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
}
