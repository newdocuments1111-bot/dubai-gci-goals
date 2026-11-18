import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { getPayoutSource } from "@/lib/hh.functions";
import { SOURCES, aed, formatDay, labelOf, monthOf, ownerPayout } from "@/lib/hh";
import { Button } from "@/components/ui/button";

const sourceQuery = (homeId: string) =>
  queryOptions({
    queryKey: ["holiday-homes-payout", homeId],
    queryFn: () => getPayoutSource({ data: homeId }),
  });

export const Route = createFileRoute("/_authenticated/holiday-homes_/payout/$homeId/$month")({
  head: () => ({
    meta: [
      { title: "Draft payout statement — Dubai AI GCI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sourceQuery(params.homeId)),
  component: PayoutPage,
});

const money = (n: number) => aed(n).replace("AED ", "");

/** Printable draft payout statement for one home and one month. Print or save as PDF from the browser; nothing is sent or paid. */
function PayoutPage() {
  const { homeId, month } = Route.useParams();
  const { data } = useSuspenseQuery(sourceQuery(homeId));
  const m = monthOf(month);
  const back = (
    <Link
      to="/holiday-homes"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4 rtl:rotate-180" /> Holiday homes
    </Link>
  );
  if (!m)
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {back}
        <p className="rounded-xl border border-border bg-background p-5 text-sm">
          That month is not valid. Go back and pick a month.
        </p>
      </main>
    );
  const { home } = data;
  const p = ownerPayout({
    managementFeePercent: Number(home.management_fee_percent),
    bookings: data.bookings,
    month: m,
  });
  const place = [home.building, home.community].filter(Boolean).join(", ");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        {back}
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print or save as PDF
        </Button>
      </div>
      {!data.complete && (
        <p role="status" className="mb-4 rounded-md bg-warning/15 px-3 py-2 text-sm print:hidden">
          There are more bookings than could be loaded, so this draft may be missing some rows. Do
          not send it.
        </p>
      )}
      <article className="rounded-xl border border-border bg-background p-6 sm:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xl font-semibold">{data.agencyName}</p>
            <p className="text-sm text-muted-foreground">Holiday home management</p>
          </div>
          <div className="text-end">
            <p className="text-2xl font-semibold tracking-tight">Draft payout statement</p>
            <p className="text-sm">{m.label}</p>
            <p className="text-sm text-muted-foreground">
              {formatDay(m.from)} to {formatDay(m.to)}
            </p>
          </div>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner</p>
            <p className="font-medium">{home.owner_name || "Not entered"}</p>
            {home.owner_phone && (
              <p className="text-sm text-muted-foreground">{home.owner_phone}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Home</p>
            <p className="font-medium">{home.name}</p>
            {place && <p className="text-sm text-muted-foreground">{place}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Prepared</p>
            <p className="font-medium">{formatDay(data.today)}</p>
            <p className="text-sm text-muted-foreground">Amounts in AED</p>
          </div>
        </section>

        <section className="mb-6 break-inside-avoid rounded-md border border-border p-4 text-sm print:border-x-0 print:px-0">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">Occupancy in {m.label}</span>
            <span className="font-medium tabular-nums">
              {p.occupancy.bookedNights} of {p.occupancy.nightsInMonth} nights (
              {p.occupancy.percent}%)
            </span>
          </div>
        </section>

        {!p.lines.length ? (
          <p className="text-sm">No bookings checked out in this month.</p>
        ) : (
          <div className="space-y-4">
            {p.lines.map((l) => (
              <section
                key={l.bookingId}
                className="break-inside-avoid rounded-md border border-border p-4 print:border-x-0 print:border-t-0 print:px-0"
              >
                <h2 className="font-medium">{l.guestName || "Guest"}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatDay(l.checkIn)} to {formatDay(l.checkOut)} · {l.nights} night
                  {l.nights === 1 ? "" : "s"} · {labelOf(SOURCES, l.source)}
                </p>
                <dl className="mt-2 space-y-1 text-sm">
                  <Row label="Booking amount" value={money(l.amount)} />
                  <Row label="Channel fee" value={`−${money(l.channelFee)}`} />
                  <Row label="Cleaning" value={`−${money(l.cleaning)}`} />
                  <Row
                    label={`Management fee, ${p.feePercent}% of the amount after the channel fee`}
                    value={`−${money(l.managementFee)}`}
                  />
                  <Row label="Payout for this booking" value={money(l.payout)} strong />
                </dl>
              </section>
            ))}
          </div>
        )}

        <section className="mt-6 break-inside-avoid border-t border-border pt-4">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Totals</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row
              label={`Booking amount (${p.lines.length} booking${p.lines.length === 1 ? "" : "s"})`}
              value={money(p.totals.amount)}
            />
            <Row label="Less channel fees" value={`−${money(p.totals.channelFee)}`} />
            <Row label="Less cleaning" value={`−${money(p.totals.cleaning)}`} />
            <Row
              label={`Less management fee (${p.feePercent}%)`}
              value={`−${money(p.totals.managementFee)}`}
            />
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
              <dt className="font-semibold">Payout to owner</dt>
              <dd className="text-lg font-semibold tabular-nums">{aed(p.totals.payout)}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            Draft for review. It is built from the bookings and amounts the agency keeps in its CRM:
            bookings that are not cancelled and whose check-out falls in the month. The amounts were
            typed in by the agency and were not read from Airbnb, Booking.com or a bank. It is not a
            tax invoice, a bank statement or an accounting ledger, and no payment has been made by
            this document. Please check it against the booking sites and the bank before any payment
            is made.
          </p>
        </footer>
      </article>
    </main>
  );
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex items-baseline justify-between gap-4 ${strong ? "font-medium" : ""}`}>
    <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
);
