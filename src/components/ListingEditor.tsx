import { useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { emptyListing, listingSchema, type Listing, type ListingInput } from '@/lib/listings';
import { saveListing } from '@/lib/listings.functions';
import { ListingAiFields } from './ListingAiFields';
import { useMembership } from '@/hooks/use-membership';

export function ListingEditor({ listing, mediaUrls, onClose, onSaved }: { listing?: Listing | undefined; mediaUrls: Record<string,string>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ListingInput>(listing ? listingSchema.parse(listing) : emptyListing());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [previews, setPreviews] = useState<Record<string,string>>(mediaUrls);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const save = useServerFn(saveListing);
  const { agencyId } = useMembership();
  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => setForm(f => ({ ...f, [key]: value }));
  async function cleanup(paths: string[]) {
    for (const bucket of ['listing-media','listing-photos']) {
      const selected = paths.filter(p => bucket === 'listing-photos' ? p.startsWith('photos/') && !p.startsWith('photos/sample-') : p.startsWith('listings/'));
      if (selected.length) await supabase.storage.from(bucket).remove(selected);
    }
  }
  async function upload(files: FileList | null, kind: 'photos' | 'videos' | 'floor_plan') {
    if (!files?.length) return;
    setBusy(true); setError('');
    const paths: string[] = [];
    try {
      for (const file of Array.from(files).slice(0,kind === 'floor_plan' ? 1 : undefined)) {
        const validType = kind === 'floor_plan' ? file.type === 'application/pdf' || file.type.startsWith('image/') : file.type.startsWith(kind === 'photos' ? 'image/' : 'video/');
        if (file.size > 50 * 1024 * 1024 || !validType) throw new Error('Choose valid media files under 50 MB.');
        const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
        const path = `${kind === 'photos' ? 'photos' : 'listings'}/${agencyId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(kind === 'photos' ? 'listing-photos' : 'listing-media').upload(path, file, { contentType: file.type });
        if (error) throw new Error('Upload failed. Please try again.');
        paths.push(path);
        setPreviews(p => ({ ...p, [path]: URL.createObjectURL(file) }));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setForm(f => kind === 'floor_plan' ? { ...f, floor_plan: paths[0] ?? f.floor_plan } : { ...f, [kind]: [...f[kind], ...paths] }); setUploaded(u => [...u, ...paths]); setBusy(false); }
  }
  async function close() {
    if (busy) return;
    if (uploaded.length) await cleanup(uploaded);
    onClose();
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (form.status === 'Available' && !form.permit_number.trim()) { setError('Add a DLD / Trakheesi permit number before marking this listing Available. You can save it as Reserved instead.'); return; }
    const parsed = listingSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues.map(i => `${i.path.join(' ')}: ${i.message}`).join('; ')); return; }
    setBusy(true);
    try {
      await save({ data: { id: listing?.id, listing: parsed.data } });
      const removed = [...(listing?.photos ?? []), ...(listing?.videos ?? []), listing?.floor_plan ?? '', ...uploaded].filter(p => p && ![...form.photos, ...form.videos, form.floor_plan].includes(p));
      if (removed.length) await cleanup(removed);
      await onSaved(); onClose();
    } catch { setError('Could not save listing. Your changes are still here.'); }
    finally { setBusy(false); }
  }
  const field = (label: string, key: 'title' | 'community' | 'project' | 'maps_url' | 'permit_number', type = 'text') => <label className="space-y-1 text-sm"><span>{label}</span><Input type={type} required={key === 'title'} value={form[key]} onChange={e => set(key,e.target.value)} /></label>;
  const selectStyle = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
  return <Dialog open onOpenChange={open => { if (!open) void close(); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg" onInteractOutside={e => { if (busy) e.preventDefault(); }} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }}>
    <DialogTitle>{listing ? 'Edit listing' : 'Add listing'}</DialogTitle><DialogDescription>{listing?.is_sample ? 'Sample — fictional property' : 'Private inventory'}</DialogDescription>
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field('Title','title')}</div>
        {field('Community / area','community')}{field('Building / project','project')}
        <label className="space-y-1 text-sm">Type<select className={selectStyle} value={form.property_type} onChange={e => set('property_type',e.target.value as ListingInput['property_type'])}>{['apartment','villa','townhouse'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="space-y-1 text-sm">Bedrooms<Input type="number" min="0" max="30" value={form.bedrooms} onChange={e => set('bedrooms',Number(e.target.value))} /></label>
        <label className="space-y-1 text-sm">Size (sq ft)<Input type="number" min="0" step="any" value={form.size_sqft} onChange={e => set('size_sqft',Number(e.target.value))} /></label>
        <label className="space-y-1 text-sm">Price (AED)<Input type="number" min="0" step="any" value={form.price_aed} onChange={e => set('price_aed',Number(e.target.value))} /></label>
        <label className="space-y-1 text-sm">Completion<select className={selectStyle} value={form.completion} onChange={e => set('completion',e.target.value as ListingInput['completion'])}><option value="ready">Ready</option><option value="off-plan">Off-plan</option></select></label>
        <label className="space-y-1 text-sm">Handover date<Input type="date" value={form.handover_date ?? ''} onChange={e => set('handover_date',e.target.value || null)} /></label>
        <label className="space-y-1 text-sm">Status<select className={selectStyle} value={form.status} onChange={e => set('status',e.target.value as ListingInput['status'])}>{['Available','Reserved','Sold'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="space-y-1 text-sm">Last checked (Dubai)<Input type="date" max={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date())} value={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date(form.last_checked))} onChange={e => { if (e.target.value) set('last_checked',new Date(`${e.target.value}T00:00:00+04:00`).toISOString()); }} /></label>
        <div>{field('Google Maps link','maps_url','url')}<p className="mt-1 text-xs text-muted-foreground">Leave blank to use the building and community in Google Maps.</p></div>{field('DLD / Trakheesi permit number','permit_number')}
        <label className="space-y-1 text-sm">Permit ends on<Input type="date" value={form.permit_expires_on ?? ''} onChange={e => set('permit_expires_on',e.target.value || null)} /><span className="block text-xs text-muted-foreground">The last day of the permit. Adverts must come down after it.</span></label>
        <label className="space-y-1 text-sm sm:col-span-2">Description<textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" value={form.description} onChange={e => set('description',e.target.value)} /></label>
      </fieldset>
      <section className="space-y-3"><h3 className="text-sm font-semibold">Photos</h3><label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary"><Upload className="size-4" />Upload photos<input aria-label="Upload photos" className="sr-only" type="file" accept="image/*" multiple disabled={busy} onChange={e => void upload(e.target.files,'photos')} /></label>
      <div className="grid grid-cols-3 gap-2">{form.photos.map((p,i) => <div key={p} className="relative"><img alt={`Photo ${i+1}`} src={p.startsWith('https://') ? p : previews[p]} className="aspect-[4/3] w-full rounded-md object-cover" /><Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 size-7" aria-label={`Remove photo ${i+1}`} disabled={busy} onClick={() => set('photos',form.photos.filter(x => x!==p))}><X className="size-4" /></Button></div>)}</div></section>
      <section className="space-y-3"><h3 className="text-sm font-semibold">Videos</h3><label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary"><Upload className="size-4" />Upload videos<input aria-label="Upload videos" type="file" className="sr-only" accept="video/*" multiple disabled={busy} onChange={e => void upload(e.target.files,'videos')} /></label><div className="flex gap-2"><Input aria-label="Video link" placeholder="https://…" value={videoLink} onChange={e => setVideoLink(e.target.value)} /><Button type="button" variant="outline" disabled={busy || !videoLink} onClick={() => { if (!/^https:\/\//i.test(videoLink)) { setError('Use an https:// video link.'); return; } set('videos',[...form.videos,videoLink]); setVideoLink(''); }}>Add link</Button></div>
        {form.videos.map((p,i) => <div key={p} className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm">{p.startsWith('https://') ? p : `Uploaded video ${i+1}`}</span><Button type="button" size="icon" variant="ghost" aria-label={`Remove video ${i+1}`} disabled={busy} onClick={() => set('videos',form.videos.filter(x => x!==p))}><X className="size-4" /></Button></div>)}</section>
      <ListingAiFields form={form} set={set} busy={busy} uploadFloorPlan={files => void upload(files,'floor_plan')} removeFloorPlan={() => set('floor_plan','')} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void close()}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving / uploading…' : 'Save listing'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}