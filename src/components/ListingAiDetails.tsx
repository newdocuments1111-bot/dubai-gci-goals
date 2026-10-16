import { Button } from '@/components/ui/button';
import { nearbyFields, amenityFields, aiTextFields } from '@/lib/listing-ai-details';
import type { Listing } from '@/lib/listings';
import { mediaUrl } from '@/lib/listing-media';

export function ListingAiDetails({ listing, mediaUrls }: { listing: Listing; mediaUrls: Record<string,string> }) {
  const details = [
    ...nearbyFields.map(([key,label]) => [label,listing[key]]),
    ...amenityFields.map(([key,label]) => [label,listing[key] === null ? '' : listing[key] ? 'Yes' : 'No']),
    ['Parking spaces',listing.parking_spaces?.toString()], ['Furnishing',listing.furnishing],
    ...aiTextFields.map(([key,label]) => [label,listing[key]]),
    ['Service charge',listing.service_charge_aed_sqft_year === null ? '' : `AED ${listing.service_charge_aed_sqft_year} / sq ft / year`],
    ...(listing.completion === 'off-plan' ? [['Developer',listing.developer], ['Payment plan',listing.payment_plan], ['Construction complete',listing.construction_percent === null ? '' : `${listing.construction_percent}%`]] : []),
  ];
  const floorPlan = mediaUrl(listing.floor_plan,mediaUrls);
  return <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl font-semibold">Details for AI</h2>{listing.is_sample && <p className="mt-2 text-sm text-muted-foreground">Sample — fictional details and approximate drive times, not verified property information.</p>}
    <dl className="mt-5 grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-3">{details.map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value || 'Not provided'}</dd></div>)}</dl>
    <div className="mt-5 flex flex-wrap gap-3">{listing.video_tour_url && <Button asChild variant="outline"><a href={listing.video_tour_url} target="_blank" rel="noopener noreferrer">Open video tour</a></Button>}{floorPlan && <Button asChild variant="outline"><a href={floorPlan} target="_blank" rel="noopener noreferrer">Open floor plan</a></Button>}</div>
  </section>;
}