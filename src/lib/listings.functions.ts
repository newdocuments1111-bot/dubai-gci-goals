import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { listingSchema, needsCheck, mapsLink } from './listings';
import { z } from 'zod';

export const getListings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data, error } = await context.supabase.from('listings').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('Could not load listings.');
  const paths = [...new Set((data ?? []).flatMap(r => [...r.photos, ...r.videos, r.floor_plan]).filter(p => p && !p.startsWith('https://')))];
  const mediaUrls: Record<string,string> = {};
  if (paths.length) {
    for (const bucket of ['listing-media','listing-photos']) {
    const { data: signed } = await context.supabase.storage.from(bucket).createSignedUrls(paths.filter(p => bucket === 'listing-photos' ? p.startsWith('photos/') : !p.startsWith('photos/')), 3600);
    for (const item of signed ?? []) if (item.path && item.signedUrl) {
      const browserUrl = process.env['VITE_SUPABASE_URL'];
      const serverUrl = process.env['SUPABASE_URL'];
      mediaUrls[item.path] = browserUrl && serverUrl ? item.signedUrl.replace(serverUrl, browserUrl) : item.signedUrl;
    }
    }
  }
  return { listings: data ?? [], mediaUrls };
});
export const saveListing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().optional(), listing: listingSchema }))
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const row = { ...data.listing, maps_url: mapsLink(data.listing), needs_check: needsCheck(data.listing.last_checked), updated_at: new Date().toISOString() };
    const result = data.id ? await context.supabase.from('listings').update(row).eq('id', data.id).select('id').single() : await context.supabase.from('listings').insert(row).select('id').single();
    if (result.error) throw new Error('Could not save listing.');
    return result.data;
  });
export const importListings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.array(listingSchema).min(1).max(500))
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const { error } = await context.supabase.from('listings').insert(data.map(r => ({ ...r, maps_url: mapsLink(r), source: 'csv', needs_check: needsCheck(r.last_checked) })));
    if (error) throw new Error('Import failed. No listings were added.');
    return { count: data.length };
  });
export const deleteListing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const { data: row } = await context.supabase.from('listings').select('photos,videos,floor_plan').eq('id', data).single();
    const { error } = await context.supabase.from('listings').delete().eq('id', data);
    if (error) throw new Error('Could not delete listing.');
    const paths = [...(row?.photos ?? []), ...(row?.videos ?? []), row?.floor_plan ?? ''];
    for (const bucket of ['listing-media','listing-photos']) {
      const owned = paths.filter(p => bucket === 'listing-photos' ? p.startsWith('photos/') && !p.startsWith('photos/sample-') : p.startsWith('listings/'));
      if (owned.length) await context.supabase.storage.from(bucket).remove(owned);
    }
    return { success: true };
  });
export const confirmListings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const last_checked = new Date().toISOString();
  const { error } = await context.supabase.from('listings').update({ last_checked, needs_check: false, updated_at: last_checked }).not('id','is',null);
  if (error) throw new Error('Could not confirm listings.');
  return { last_checked };
});
export const setListingStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(['Available', 'Reserved', 'Sold']) }))
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const { data: row, error: readError } = await context.supabase.from('listings').select('permit_number').eq('id', data.id).single();
    if (readError || !row) throw new Error('Could not find listing.');
    if (data.status === 'Available' && !row.permit_number.trim()) return { success: false, message: 'Add a DLD / Trakheesi permit number in Edit before marking this listing Available.' };
    const { error } = await context.supabase.from('listings').update({ status: data.status, updated_at: new Date().toISOString() }).eq('id', data.id).select('id').single();
    if (error) throw new Error('Could not change status.');
    return { success: true, message: '' };
  });
export const duplicateListing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const { data: original, error: readError } = await context.supabase.from('listings').select('*').eq('id', data).single();
    if (readError || !original) throw new Error('Could not find listing.');
    const copied: { bucket: string; path: string }[] = [];
    try {
      const copyMedia = async (paths: string[]) => {
        const result: string[] = [];
        for (const path of paths) {
          if (path.startsWith('https://')) { result.push(path); continue; }
          const bucket = path.startsWith('photos/') ? 'listing-photos' : 'listing-media';
          const destination = `${bucket === 'listing-photos' ? 'photos' : 'listings'}/${crypto.randomUUID()}.${path.split('.').pop() || 'bin'}`;
          const { error } = await context.supabase.storage.from(bucket).copy(path, destination);
          if (error) throw new Error('Could not copy listing media.');
          copied.push({ bucket, path: destination }); result.push(destination);
        }
        return result;
      };
      const listing = listingSchema.parse({ ...original, title: `${original.title.slice(0, 190)} (copy)`, status: 'Reserved', permit_number: '', photos: await copyMedia(original.photos), videos: await copyMedia(original.videos), floor_plan: original.floor_plan ? (await copyMedia([original.floor_plan]))[0] ?? '' : '' });
      const { data: row, error } = await context.supabase.from('listings').insert({ ...listing, maps_url: mapsLink(listing), is_sample: original.is_sample, source: 'manual', needs_check: needsCheck(listing.last_checked) }).select('id').single();
      if (error || !row) throw new Error('Could not duplicate listing.');
      return row;
    } catch (error) {
      for (const item of copied) await context.supabase.storage.from(item.bucket).remove([item.path]);
      throw error;
    }
  });

export const getSharePhoto = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const { data: listing, error } = await context.supabase.from('listings').select('photos').eq('id',data).single();
  if (error || !listing) throw new Error('Could not load photo.');
  const first = listing.photos[0];
  if (!first) return { url: '', error: '' };
  let path = first;
  if (!path.startsWith('photos/')) {
    if (!path.startsWith('listings/')) return { url: '', error: 'Upload this photo to Lovable Cloud before sharing it.' };
    const { data: file, error: downloadError } = await context.supabase.storage.from('listing-media').download(path);
    if (downloadError || !file) throw new Error('Could not prepare photo.');
    path = `photos/${crypto.randomUUID()}.${first.split('.').pop() || 'jpg'}`;
    const { error: uploadError } = await context.supabase.storage.from('listing-photos').upload(path,file,{ contentType: file.type });
    if (uploadError) throw new Error('Could not prepare photo.');
    const { error: saveError } = await context.supabase.from('listings').update({ photos: [path,...listing.photos.slice(1)] }).eq('id',data);
    if (saveError) { await context.supabase.storage.from('listing-photos').remove([path]); throw new Error('Could not prepare photo.'); }
  }
  const base = process.env['VITE_SUPABASE_URL'];
  if (!base) throw new Error('Photo sharing is unavailable.');
  const url = `${base}/storage/v1/object/public/listing-photos/${path}`;
  // Probe the storage service, not arbitrary external URLs supplied in a listing.
  const serverBase = process.env['SUPABASE_URL'];
  if (!serverBase) throw new Error('Photo sharing is unavailable.');
  const response = await fetch(`${serverBase}/storage/v1/object/public/listing-photos/${path}`, { method: 'HEAD' });
  if (!response.ok) return { url: '', error: 'Photo sharing is blocked. A workspace owner must enable public buckets in Settings → Privacy & Security, then make listing-photos public.' };
  return { url, error: '' };
});