import { Input } from '@/components/ui/input';
import { nearbyFields, amenityFields, aiTextFields, optionalNumber } from '@/lib/listing-ai-details';
import type { ListingInput } from '@/lib/listings';

export function ListingAiFields({ form, set, busy, uploadFloorPlan, removeFloorPlan }: {
  form: ListingInput; set: <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => void; busy: boolean;
  uploadFloorPlan: (files: FileList | null) => void; removeFloorPlan: () => void;
}) {
  const selectStyle = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
  return <fieldset disabled={busy} className="space-y-4 border-t border-border pt-5"><legend className="font-semibold">Details for AI <span className="text-xs font-normal text-muted-foreground">· Optional</span></legend>
    <h4 className="text-sm font-medium">Nearby · approximate drive times</h4>
    <div className="grid gap-4 sm:grid-cols-2">{nearbyFields.map(([key,label]) => <label key={key} className="text-sm">{label}<Input className="mt-1" value={form[key]} onChange={e => set(key,e.target.value)} placeholder="Place · approx. 10 min drive" /></label>)}</div>
    <div className="grid gap-4 sm:grid-cols-2">{amenityFields.map(([key,label]) => <label key={key} className="text-sm">{label}<select className={selectStyle} value={form[key] === null ? '' : String(form[key])} onChange={e => set(key,e.target.value === '' ? null : e.target.value === 'true')}><option value="">Not provided</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
      <label className="text-sm">Parking spaces<Input className="mt-1" type="number" min="0" max="100" value={form.parking_spaces ?? ''} onChange={e => set('parking_spaces',optionalNumber(e.target.value))} /></label>
      <label className="text-sm">Furnishing<select className={selectStyle} value={form.furnishing} onChange={e => set('furnishing',e.target.value as ListingInput['furnishing'])}><option value="">Not provided</option><option value="furnished">Furnished</option><option value="unfurnished">Unfurnished</option></select></label>
      {aiTextFields.map(([key,label]) => <label key={key} className={`text-sm ${key === 'agent_highlights' || key === 'do_not_mention' ? 'sm:col-span-2' : ''}`}>{label}<textarea className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2" value={form[key]} onChange={e => set(key,e.target.value)} /></label>)}
      <label className="text-sm">Service charge (AED / sq ft / year)<Input className="mt-1" type="number" min="0" step="any" value={form.service_charge_aed_sqft_year ?? ''} onChange={e => set('service_charge_aed_sqft_year',optionalNumber(e.target.value))} /></label>
      <label className="text-sm">Video tour link<Input className="mt-1" type="url" value={form.video_tour_url} onChange={e => set('video_tour_url',e.target.value)} /></label>
    </div>
    {form.completion === 'off-plan' && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Developer<Input className="mt-1" value={form.developer} onChange={e => set('developer',e.target.value)} /></label><label className="text-sm">Payment plan<Input className="mt-1" value={form.payment_plan} onChange={e => set('payment_plan',e.target.value)} /></label><label className="text-sm">Construction complete (%)<Input className="mt-1" type="number" min="0" max="100" step="any" value={form.construction_percent ?? ''} onChange={e => set('construction_percent',optionalNumber(e.target.value))} /></label></div>}
    <label className="block text-sm">Floor plan upload<Input aria-label="Upload floor plan" className="mt-1" type="file" accept="application/pdf,image/*" onChange={e => uploadFloorPlan(e.target.files)} /></label>
    {form.floor_plan && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked onChange={removeFloorPlan} />Floor plan attached</label>}
  </fieldset>;
}