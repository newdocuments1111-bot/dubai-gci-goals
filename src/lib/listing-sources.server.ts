import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { listingSchema, needsCheck, type ListingInput } from './listings';

/** Future integrations plug into this interface. Only a verified source check
 * may supply last_checked; a successful sync alone must not renew stale data.
 * The nightly scheduler currently calls refresh_listing_checks directly.
 * When an adapter is connected, call this orchestrator from an authenticated
 * managed callback at the same 20:00 UTC slot instead of the SQL-only job. */
export interface ListingSource {
  name: 'hubspot' | 'property-finder';
  /** Each connected source belongs to exactly one agency. */
  agencyId: string;
  fetch: () => Promise<Array<{ externalId: string; listing: ListingInput }>>;
}

export async function syncListingSources(client: SupabaseClient<Database>, sources: ListingSource[]) {
  const results: Array<{ source: string; count: number; success: boolean }> = [];
  for (const source of sources) {
    try {
      const rows = (await source.fetch()).map(({ externalId, listing }) => {
        if (!externalId || externalId.length > 200) throw new Error('Invalid external listing identity');
        const validated = listingSchema.parse(listing);
        return { ...validated, agency_id: source.agencyId, source: source.name, external_id: externalId, needs_check: needsCheck(validated.last_checked), updated_at: new Date().toISOString() };
      });
      // Explicit lookup avoids conflict inference against a partial index.
      for (const row of rows) {
        const { data: existing, error: lookupError } = await client.from('listings').select('id').eq('agency_id',row.agency_id).eq('source',row.source).eq('external_id',row.external_id).maybeSingle();
        if (lookupError) throw lookupError;
        const result = existing ? await client.from('listings').update(row).eq('id',existing.id) : await client.from('listings').insert(row);
        if (result.error) throw result.error;
      }
      results.push({ source: source.name, count: rows.length, success: true });
    } catch { results.push({ source: source.name, count: 0, success: false }); }
  }
  const { error } = await client.rpc('refresh_listing_checks');
  if (error) throw new Error('Could not refresh inventory checks');
  return results;
}