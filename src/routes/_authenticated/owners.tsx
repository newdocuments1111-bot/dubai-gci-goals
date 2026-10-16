import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteOwner, emptyOwner, listOwners, saveOwner, type OwnerInput } from '@/lib/owners.functions';

const ownersQuery = queryOptions({ queryKey: ['owners'], queryFn: () => listOwners() });

export const Route = createFileRoute('/_authenticated/owners')({
  head: () => ({ meta: [
    { title: 'Owners — Dubai AI GCI' }, { name: 'description', content: 'Past buyers and landlords who agreed to value updates and reminders.' },
    { property: 'og:title', content: 'Owners — Dubai AI GCI' }, { property: 'og:description', content: 'Owner-managed past-client list.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ownersQuery),
  component: OwnersPage,
});

function OwnersPage() {
  const { data: owners } = useSuspenseQuery(ownersQuery);
  const client = useQueryClient();
  const save = useServerFn(saveOwner), del = useServerFn(deleteOwner);
  const [editing, setEditing] = useState<(OwnerInput & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: ownersQuery.queryKey });
  const set = <K extends keyof OwnerInput>(key: K, value: OwnerInput[K]) => setEditing(f => f ? { ...f, [key]: value } : f);

  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <div className="mb-6 flex items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Owners</h1><p className="mt-1 text-sm text-muted-foreground">Only owners who agreed to updates receive messages. Value updates use real past sales from Market Data only.</p></div>
      <Button onClick={() => setEditing(emptyOwner())}><Plus className="size-4" />Add owner</Button>
    </div>
    {owners.length === 0 && <p className="text-sm text-muted-foreground">No owners yet.</p>}
    <div className="space-y-3">{owners.map(o => (
      <article key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <div className="min-w-40 flex-1">
          <p className="font-semibold">{o.name} <span className="text-xs font-normal text-muted-foreground">{o.kind}</span></p>
          <p className="text-sm text-muted-foreground">{[o.building, o.area].filter(Boolean).join(', ') || 'No area'}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          {o.handover_date && <p>Handover: {o.handover_date}</p>}
          {o.lease_end && <p>Lease ends: {o.lease_end}</p>}
          <p>Updates: {o.agreed_to_updates ? `Yes, ${o.update_frequency === 'monthly' ? 'monthly' : 'every 3 months'}` : 'Not agreed'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing({ id: o.id, name: o.name, phone: o.phone, agreed_to_updates: o.agreed_to_updates, handover_date: o.handover_date, kind: o.kind as 'owner' | 'investor', update_frequency: o.update_frequency as 'quarterly' | 'monthly', area: o.area, building: o.building, lease_end: o.lease_end })}>Edit</Button>
          <Button variant="ghost" size="sm" aria-label={`Delete ${o.name}`} onClick={async () => { if (!confirm(`Delete ${o.name}?`)) return; await del({ data: o.id }); refresh(); }}><Trash2 className="size-4" /></Button>
        </div>
      </article>))}
    </div>
    {editing && <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 p-4" role="dialog" aria-label="Edit owner">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{editing.id ? 'Edit owner' : 'Add owner'}</h2><Button variant="ghost" size="sm" aria-label="Close" onClick={() => setEditing(null)}><X className="size-4" /></Button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Name<Input className="mt-1" maxLength={200} value={editing.name} onChange={e => set('name', e.target.value)} /></label>
          <label className="text-sm">Phone<Input className="mt-1" maxLength={50} value={editing.phone} onChange={e => set('phone', e.target.value)} /></label>
          <label className="text-sm">Area<Input className="mt-1" maxLength={200} value={editing.area} onChange={e => set('area', e.target.value)} /></label>
          <label className="text-sm">Building<Input className="mt-1" maxLength={200} value={editing.building} onChange={e => set('building', e.target.value)} /></label>
          <label className="text-sm">Handover date<Input className="mt-1" type="date" value={editing.handover_date ?? ''} onChange={e => set('handover_date', e.target.value || null)} /></label>
          <label className="text-sm">Lease end (rental owners)<Input className="mt-1" type="date" value={editing.lease_end ?? ''} onChange={e => set('lease_end', e.target.value || null)} /></label>
          <label className="text-sm">Type<select aria-label="Type" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editing.kind} onChange={e => set('kind', e.target.value as 'owner' | 'investor')}><option value="owner">Owner-occupier</option><option value="investor">Investor</option></select></label>
          <label className="text-sm">Update frequency<select aria-label="Update frequency" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editing.update_frequency} onChange={e => set('update_frequency', e.target.value as 'quarterly' | 'monthly')}><option value="quarterly">Every 3 months</option><option value="monthly">Monthly</option></select></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={editing.agreed_to_updates} onChange={e => set('agreed_to_updates', e.target.checked)} />Agreed to updates</label>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <Button className="mt-4" disabled={busy || !editing.name.trim()} onClick={async () => { setBusy(true); setError('');
          try { await save({ data: editing }); setEditing(null); refresh(); } catch { setError('Could not save the owner.'); } finally { setBusy(false); } }}>
          <Save className="size-4" />{busy ? 'Saving…' : 'Save owner'}
        </Button>
      </div>
    </div>}
  </main>;
}
