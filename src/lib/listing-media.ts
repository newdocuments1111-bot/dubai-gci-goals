import type { Listing } from './listings';

export function mediaUrl(path: string, urls: Record<string, string>) { return path.startsWith('https://') ? path : urls[path]; }
export function listingPhotos(row: Listing, urls: Record<string, string>) {
  if (row.photos.length) return row.photos.map(p => mediaUrl(p, urls)).filter((p): p is string => Boolean(p));
  return [];
}