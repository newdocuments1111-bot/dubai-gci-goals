import { downloadIcs, viewingEvent } from '@/lib/calendar';
import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookViewing, freeSlots, listViewings, setViewingStatus } from '@/lib/viewings.functions';
import { listLeads } from '@/lib/leads-app.functions';
import { getListings } from '@/lib/listings.functions';
import { dubaiDate } from '@/lib/listings';
import { useQuery } from '@tanstack/react-query';

const viewingsQuery = queryOptions({ queryKey: ['viewings'], queryFn: () => listViewings() });

export const Route = createFileRoute('/_authenticated/viewings')({
  head: () => ({ meta: [
    { title: 'Viewings — Dubai AI GCI' }, { name: 'description', content: 'Booked viewings and valuations with free slots from your working hours.' },
    { property: 'og:title', content: 'Viewings — Dubai AI GCI' }, { property: 'og:description', content: 'Owner-managed viewings and valuations.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(viewingsQuery),
  component: ViewingsPage,
});

function ViewingsPage() {
  const { data: viewings } = useSuspenseQuery(viewingsQuery);
  const { data: leads } = useQuery(queryOptions({ queryKey: ['leads'], queryFn: () => listLeads() }));
  const { data: listingsData } = useQuery(queryOptions({ queryKey: ['listings'], queryFn: () => getListings() }));
  const listings = listingsData?.listings;
  const { data: slots } = useQuery(queryOptions({ queryKey: ['free-slots'], queryFn: () => freeSlots() }));
  const client = useQueryClient();
  const book = useServerFn(bookViewing), setStatus = useServerFn(setViewingStatus);
  const [leadId, setLeadId] = useState(''), [listingId, setListingId] = useState(''), [kind, setKind] = useState<'viewing' | 'valuation'>('viewing'), [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: ['viewings'] });

  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Viewings</h1>
    <p className="mb-6 text-sm text-muted-foreground">Slots come from your Settings working days and hours, skipping holidays and existing bookings. Clients get a reminder with the map link the day before at 6pm their time.</p>
    <section className="mb-6 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
      <label className="text-sm">Lead<select aria-label="Lead" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={leadId} onChange={e => setLeadId(e.target.value)}>
        <option value="">Choose a lead…</option>{(leads ?? []).map(l => <option key={l.id} value={l.id}>{l.name || 'Unnamed'}</option>)}
      </select></label>
      <label className="text-sm">Listing (optional)<select aria-label="Listing" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={listingId} onChange={e => setListingId(e.target.value)}>
        <option value="">None</option>{(listings ?? []).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
      </select></label>
      <label className="text-sm">Type<select aria-label="Type" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={kind} onChange={e => setKind(e.target.value as 'viewing' | 'valuation')}>
        <option value="viewing">Viewing</option><option value="valuation">Valuation</option>
      </select></label>
      <label className="text-sm">Free slot (Dubai time)<select aria-label="Free slot" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={slot} onChange={e => setSlot(e.target.value)}>
        <option value="">Choose a slot…</option>{(slots ?? []).map(s => <option key={s} value={s}>{dubaiDate(s)}</option>)}
      </select></label>
      <div className="flex items-end gap-2 sm:col-span-2">
        <Button disabled={busy || !slot} onClick={async () => { setBusy(true); setError('');
          try { const r = await book({ data: { lead_id: leadId || null, listing_id: listingId || null, kind, starts_at: slot } });
            if (r.error) { setError(r.error); return; } setSlot(''); refresh(); client.invalidateQueries({ queryKey: ['free-slots'] }); }
          catch { setError('Could not book the viewing.'); } finally { setBusy(false); } }}>
          <CalendarPlus className="size-4" />Book slot
        </Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </section>
    {viewings.length === 0 && <p className="text-sm text-muted-foreground">No viewings booked yet.</p>}
    <div className="space-y-3">{viewings.map(v => (
      <article key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <div className="min-w-40 flex-1">
          <p className="font-semibold">{dubaiDate(v.starts_at)} <span className="text-xs font-normal text-muted-foreground">{v.kind}</span></p>
          <p className="text-sm text-muted-foreground">{(v.leads as { name?: string } | null)?.name ?? 'No lead'} {(v.listings as { title?: string } | null)?.title ? `· ${(v.listings as { title?: string } | null)?.title}` : ''}</p>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs ${v.status === 'booked' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{v.status}</span>
        {v.status === 'booked' && <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadIcs(`viewing-${dubaiDate(v.starts_at).replace(/[^\w]+/g, '-')}`, viewingEvent({ id: v.id, kind: v.kind, starts_at: v.starts_at, leadName: (v.leads as { name?: string } | null)?.name ?? null, listingTitle: (v.listings as { title?: string } | null)?.title ?? null }))}><CalendarPlus className="size-4" />Add to calendar</Button>
          <Button variant="outline" size="sm" onClick={async () => { await setStatus({ data: { id: v.id, status: 'done' } }); refresh(); }}>Mark as done</Button>
          <Button variant="ghost" size="sm" onClick={async () => { await setStatus({ data: { id: v.id, status: 'no-show' } }); refresh(); }}>No-show</Button>
        </div>}
      </article>))}
    </div>
  </main>;
}
