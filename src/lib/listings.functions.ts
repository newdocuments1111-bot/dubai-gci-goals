import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isOwnerEmail } from './owner';
import { listingSchema, needsCheck, mapsLink } from './listings';
import { z } from 'zod';

export const getListings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
  const { data, error } = await context.supabase.from('listings').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('Could not load listings.');
  const paths = [...new Set((data ?? []).flatMap(r => [...r.photos, ...r.videos]).filter(p => !p.startsWith('https://')))];
  const mediaUrls: Record<string,string> = {};
  if (paths.length) {
    const { data: signed } = await context.supabase.storage.from('listing-media').createSignedUrls(paths, 3600);
    for (const item of signed ?? []) if (item.path && item.signedUrl) {
      const browserUrl = process.env['VITE_SUPABASE_URL'];
      const serverUrl = process.env['SUPABASE_URL'];
      mediaUrls[item.path] = browserUrl && serverUrl ? item.signedUrl.replace(serverUrl, browserUrl) : item.signedUrl;
    }
  }
  return { listings: data ?? [], mediaUrls };
});
export const saveListing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().optional(), listing: listingSchema }))
  .handler(async ({ data, context }) => {
    if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
    const row = { ...data.listing, maps_url: mapsLink(data.listing), needs_check: needsCheck(data.listing.last_checked), updated_at: new Date().toISOString() };
    const result = data.id ? await context.supabase.from('listings').update(row).eq('id', data.id).select('id').single() : await context.supabase.from('listings').insert(row).select('id').single();
    if (result.error) throw new Error('Could not save listing.');
    return result.data;
  });
export const importListings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.array(listingSchema).min(1).max(500))
  .handler(async ({ data, context }) => {
    if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
    const { error } = await context.supabase.from('listings').insert(data.map(r => ({ ...r, maps_url: mapsLink(r), source: 'csv', needs_check: needsCheck(r.last_checked) })));
    if (error) throw new Error('Import failed. No listings were added.');
    return { count: data.length };
  });
export const deleteListing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
    const { data: row } = await context.supabase.from('listings').select('photos,videos').eq('id', data).single();
    const { error } = await context.supabase.from('listings').delete().eq('id', data);
    if (error) throw new Error('Could not delete listing.');
    const paths = [...(row?.photos ?? []), ...(row?.videos ?? [])].filter(p => p.startsWith('listings/'));
    if (paths.length) await context.supabase.storage.from('listing-media').remove(paths);
    return { success: true };
  });
export const confirmListings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
  const last_checked = new Date().toISOString();
  const { error } = await context.supabase.from('listings').update({ last_checked, needs_check: false, updated_at: last_checked }).not('id','is',null);
  if (error) throw new Error('Could not confirm listings.');
  return { last_checked };
});
export const setListingStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(['Available', 'Reserved', 'Sold']) }))
  .handler(async ({ data, context }) => {
    if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
    const { data: row, error: readError } = await context.supabase.from('listings').select('permit_number').eq('id', data.id).single();
    if (readError || !row) throw new Error('Could not find listing.');
    if (data.status === 'Available' && !row.permit_number.trim()) return { success: false, message: 'Add a DLD / Trakheesi permit number in Edit before marking this listing Available.' };
    const { error } = await context.supabase.from('listings').update({ status: data.status, updated_at: new Date().toISOString() }).eq('id', data.id).select('id').single();
    if (error) throw new Error('Could not change status.');
    return { success: true, message: '' };
  });
export const duplicateListing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
    const { data: original, error: readError } = await context.supabase.from('listings').select('*').eq('id', data).single();
    if (readError || !original) throw new Error('Could not find listing.');
    const copied: string[] = [];
    try {
      const copyMedia = async (paths: string[]) => {
        const result: string[] = [];
        for (const path of paths) {
          if (path.startsWith('https://')) { result.push(path); continue; }
          const destination = `listings/${crypto.randomUUID()}.${path.split('.').pop() || 'bin'}`;
          const { error } = await context.supabase.storage.from('listing-media').copy(path, destination);
          if (error) throw new Error('Could not copy listing media.');
          copied.push(destination); result.push(destination);
        }
        return result;
      };
      const listing = listingSchema.parse({ ...original, title: `${original.title.slice(0, 190)} (copy)`, status: 'Reserved', permit_number: '', photos: await copyMedia(original.photos), videos: await copyMedia(original.videos) });
      const { data: row, error } = await context.supabase.from('listings').insert({ ...listing, maps_url: mapsLink(listing), is_sample: original.is_sample, source: 'manual', needs_check: needsCheck(listing.last_checked) }).select('id').single();
      if (error || !row) throw new Error('Could not duplicate listing.');
      return row;
    } catch (error) {
      if (copied.length) await context.supabase.storage.from('listing-media').remove(copied);
      throw error;
    }
  });