import { ListingBuyers } from '@/components/ListingBuyers';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, MapPin, Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ListingEditor } from '@/components/ListingEditor';
import { ListingGallery } from '@/components/ListingGallery';
import { ListingAiDetails } from '@/components/ListingAiDetails';
import { ListingShareButton } from '@/components/ListingShareButton';
import { listingsQuery } from '@/lib/listings-query';
import { deleteListing, duplicateListing } from '@/lib/listings.functions';
import { dubaiDate, mapsLink, needsCheck } from '@/lib/listings';
import { listingPhotos, mediaUrl } from '@/lib/listing-media';

export const Route = createFileRoute('/_authenticated/listing/$listingId')({
  head: () => ({ meta: [
    { title: 'Property details — Dubai AI GCI' },
    { name: 'description', content: 'Private Dubai listing photos, videos, permit and property details.' },
    { property: 'og:title', content: 'Property details — Dubai AI GCI' },
    { property: 'og:description', content: 'Private property details and availability in Dubai AI GCI.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  component: ListingDetails,
});

function ListingDetails() {
  const { listingId } = Route.useParams();
  const { data } = useSuspenseQuery(listingsQuery);
  const listing = data.listings.find(row => row.id === listingId);
  const client = useQueryClient(), navigate = useNavigate();
  const remove = useServerFn(deleteListing), duplicate = useServerFn(duplicateListing);
  const [editing, setEditing] = useState(false), [deleting, setDeleting] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reload = async () => { await client.invalidateQueries({ queryKey: listingsQuery.queryKey }); };
  if (!listing) return <main className="mx-auto max-w-5xl px-4 py-8"><Button asChild variant="outline"><Link to="/listings"><ArrowLeft className="size-4" />Back to listings</Link></Button><h1 className="mt-8 text-2xl font-bold">Listing not found</h1></main>;
  const photos = listingPhotos(listing, data.mediaUrls);
  const details = [
    ['Community / area', listing.community], ['Building / project', listing.project], ['Type', listing.property_type],
    ['Bedrooms', String(listing.bedrooms)], ['Size', `${listing.size_sqft.toLocaleString()} sq ft`], ['Price', `AED ${listing.price_aed.toLocaleString()}`],
    ['Status', listing.status], ['Completion', listing.completion === 'off-plan' ? 'Off-plan' : 'Ready'], ['Handover date', listing.handover_date],
    ['DLD / Trakheesi permit', listing.permit_number], ['Last checked (Dubai)', dubaiDate(listing.last_checked)],
  ];
  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
    <Button asChild variant="ghost" className="mb-5 px-0"><Link to="/listings"><ArrowLeft className="size-4" />Back to listings</Link></Button>
    <header className="mb-6"><div className="mb-3 flex flex-wrap gap-2"><span className="rounded bg-secondary px-2 py-1 text-xs font-semibold">{listing.status}</span>{listing.is_sample && <span className="rounded bg-secondary px-2 py-1 text-xs">Sample — fictional property</span>}{needsCheck(listing.last_checked) && <span className="rounded bg-warning px-2 py-1 text-xs font-semibold text-warning-foreground">Needs check</span>}</div><h1 className="break-words text-3xl font-bold">{listing.title}</h1><p className="mt-2 text-muted-foreground">{listing.community}</p></header>
    <div className="grid min-w-0 gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0"><ListingGallery key={listing.id} photos={photos} title={listing.title} />
        {listing.videos.length > 0 && <section className="mt-6 space-y-3"><h2 className="text-lg font-semibold">Videos</h2>{listing.videos.map((path, i) => path.startsWith('listings/') || /\.(mp4|webm|mov)(\?|$)/i.test(path) ? <video key={path} src={mediaUrl(path, data.mediaUrls)} controls preload="metadata" className="w-full rounded-lg" /> : <Button key={path} asChild variant="outline"><a href={path} target="_blank" rel="noopener noreferrer">Open video {i + 1}</a></Button>)}</section>}
      </div>
      <div className="min-w-0"><h2 className="mb-4 text-lg font-semibold">Property details</h2><dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">{details.map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value || 'Not provided'}</dd></div>)}</dl>
        <section className="mt-7 border-t border-border pt-5"><h2 className="font-semibold">Description</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{listing.description || 'No description provided.'}</p></section>
        <div className="mt-6 grid gap-3"><Button asChild variant="outline"><a href={mapsLink(listing)} target="_blank" rel="noopener noreferrer"><MapPin className="size-4" />Open in Google Maps</a></Button><ListingShareButton listing={listing} photo={photos[0]} />
          <Button asChild variant="outline"><Link to="/brochure/$listingId" params={{ listingId: listing.id }}><FileText className="size-4" />Brochure (print or PDF)</Link></Button>
          <div className="grid grid-cols-2 gap-2"><Button onClick={() => setEditing(true)}><Pencil className="size-4" />Edit</Button><Button variant="destructive" onClick={() => setDeleting(true)}><Trash2 className="size-4" />Delete</Button></div>
          <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const result = await duplicate({ data: listing.id }); await reload(); await navigate({ to: '/listing/$listingId', params: { listingId: result.id } }); setEditing(true); } catch { setError('Could not duplicate listing. Please try again.'); } finally { setBusy(false); } }}><Copy className="size-4" />Duplicate listing</Button>
        </div>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </div>
    <ListingAiDetails listing={listing} mediaUrls={data.mediaUrls} />
    <ListingBuyers listing={listing} />
    {editing && <ListingEditor listing={listing} mediaUrls={data.mediaUrls} onClose={() => setEditing(false)} onSaved={reload} />}
    <Dialog open={deleting} onOpenChange={open => { if (!busy) setDeleting(open); }}><DialogContent><DialogTitle>Delete listing?</DialogTitle><DialogDescription>{listing.title} and its uploaded media will be removed permanently.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleting(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await remove({ data: listing.id }); setDeleting(false); await reload(); await navigate({ to: '/listings' }); } catch { setError('Could not delete listing. Please try again.'); } finally { setBusy(false); } }}>Delete listing</Button></div></DialogContent></Dialog>
  </div></main>;
}