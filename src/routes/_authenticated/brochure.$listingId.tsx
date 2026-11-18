import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  brochureAmenities,
  brochureFacts,
  brochureNearby,
  brochureCheck,
  brochurePrice,
} from "@/lib/brochure";
import { dubaiToday } from "@/lib/advert";
import { listingPhotos } from "@/lib/listing-media";
import { listingsQuery } from "@/lib/listings-query";
import { getBrochureContact } from "@/lib/listings.functions";

const contactQuery = queryOptions({
  queryKey: ["brochure-contact"],
  queryFn: () => getBrochureContact(),
});

export const Route = createFileRoute("/_authenticated/brochure/$listingId")({
  head: () => ({
    meta: [{ title: "Listing brochure — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(listingsQuery),
      context.queryClient.ensureQueryData(contactQuery),
    ]),
  component: BrochurePage,
});

/** A one-page sheet for a client. Print or save as PDF from the browser; nothing is sent from here. */
function BrochurePage() {
  const { listingId } = Route.useParams();
  const { data } = useSuspenseQuery(listingsQuery);
  const { data: contact } = useSuspenseQuery(contactQuery);
  const listing = data.listings.find((l) => l.id === listingId);
  if (!listing)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Button asChild variant="outline">
          <Link to="/listings">
            <ArrowLeft className="size-4" />
            Back to listings
          </Link>
        </Button>
        <h1 className="mt-8 text-2xl font-semibold">Listing not found</h1>
      </main>
    );
  const photos = listingPhotos(listing, data.mediaUrls).slice(0, 5);
  const facts = brochureFacts(listing);
  const amenities = brochureAmenities(listing);
  const nearby = brochureNearby(listing);
  const check = brochureCheck(listing, contact, dubaiToday());
  const ready = check.blockers.length === 0;
  const place = [listing.project, listing.community].filter(Boolean).join(", ");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/listing/$listingId"
          params={{ listingId: listing.id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Listing
        </Link>
        {ready && (
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print or save as PDF
          </Button>
        )}
      </div>
      {!ready && (
        <div role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm">
          <p className="font-semibold">This brochure cannot be shared yet:</p>
          <ul className="mt-1 list-disc space-y-1 ps-5">
            {check.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {check.warnings.length > 0 && (
        <ul className="mb-4 list-disc space-y-1 rounded-md bg-secondary py-2 pe-3 ps-8 text-sm print:hidden">
          {check.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {/* A blocked brochure is not drawn at all, so it cannot be printed or saved from the browser. */}
      {ready && (
        <article className="rounded-xl border border-border bg-background p-6 sm:p-8 print:border-0 print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold tracking-tight">{listing.title}</h1>
              {place && <p className="mt-1 text-muted-foreground">{place}</p>}
            </div>
            <p className="text-2xl font-semibold tracking-tight">{brochurePrice(listing)}</p>
          </header>

          {photos.length > 0 && (
            <section className="grid gap-2 py-5 sm:grid-cols-4 print:grid-cols-4 print:py-3">
              <img
                src={photos[0]}
                alt={listing.title}
                className="aspect-[4/3] w-full rounded-lg object-cover sm:col-span-4 print:col-span-4 print:aspect-auto print:h-[60mm]"
              />
              {photos.slice(1).map((p, i) => (
                <img
                  key={p}
                  src={p}
                  alt={`${listing.title}, photo ${i + 2}`}
                  className="aspect-[4/3] w-full rounded-lg object-cover print:aspect-auto print:h-[24mm]"
                />
              ))}
            </section>
          )}

          <section className="grid gap-x-6 gap-y-3 py-5 text-sm sm:grid-cols-3 print:grid-cols-4 print:py-3">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="break-words font-medium">{value}</p>
              </div>
            ))}
          </section>

          {listing.description && (
            <section className="break-inside-avoid border-t border-border py-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                About this home
              </h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {listing.description}
              </p>
            </section>
          )}

          {(amenities.length > 0 || nearby.length > 0) && (
            <section className="grid break-inside-avoid gap-6 border-t border-border py-5 text-sm sm:grid-cols-2 print:grid-cols-2">
              {amenities.length > 0 && (
                <div>
                  <h2 className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Amenities
                  </h2>
                  <ul className="mt-2 list-disc space-y-1 ps-5">
                    {amenities.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {nearby.length > 0 && (
                <div>
                  <h2 className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Nearby
                  </h2>
                  <dl className="mt-2 space-y-1">
                    {nearby.map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </section>
          )}

          <footer className="flex break-inside-avoid flex-wrap items-end justify-between gap-4 border-t border-border pt-5 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
              <p className="font-semibold">{contact.agent || contact.agency}</p>
              {contact.mobile && <p dir="ltr">{contact.mobile}</p>}
              {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
            </div>
            <div className="text-end">
              <p className="font-semibold">{contact.agency}</p>
              {contact.reraBrn && (
                <p className="text-muted-foreground">RERA ORN / BRN: {contact.reraBrn}</p>
              )}
              {listing.permit_number && (
                <p className="text-muted-foreground">Permit number: {listing.permit_number}</p>
              )}
            </div>
          </footer>
          <p className="mt-4 text-xs text-muted-foreground">
            Details are given in good faith and may change. Price and availability are confirmed
            only in writing by the agency.
          </p>
        </article>
      )}
    </main>
  );
}
