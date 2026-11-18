import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { getStatementSource } from "@/lib/pm.functions";
import { aed, dubaiToday, formatDay, monthPeriod, ownerStatement } from "@/lib/pm";
import { Button } from "@/components/ui/button";

const sourceQuery = (ownerId: string) =>
  queryOptions({
    queryKey: ["managed-statement", ownerId],
    queryFn: () => getStatementSource({ data: ownerId }),
  });

export const Route = createFileRoute("/_authenticated/managed_/statement/$ownerId/$month")({
  head: () => ({
    meta: [{ title: "Draft statement — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sourceQuery(params.ownerId)),
  component: StatementPage,
});

const money = (n: number) => aed(n).replace("AED ", "");

/** Printable draft statement for one landlord and one month. Print or save as PDF from the browser; nothing is sent. */
function StatementPage() {
  const { ownerId, month } = Route.useParams();
  const { data } = useSuspenseQuery(sourceQuery(ownerId));
  const period = monthPeriod(month);
  const back = (
    <Link
      to="/managed"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Managed properties
    </Link>
  );
  if (!period)
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {back}
        <p className="rounded-xl border border-border bg-background p-5 text-sm">
          That month is not valid. Go back and pick a month.
        </p>
      </main>
    );
  const s = ownerStatement({ ...data, from: period.from, to: period.to });
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
          There are more records than could be loaded, so this draft may be missing some rows. Do
          not send it.
        </p>
      )}
      <article className="rounded-xl border border-border bg-background p-6 sm:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xl font-semibold">{data.agencyName}</p>
            <p className="text-sm text-muted-foreground">Property management</p>
          </div>
          <div className="text-end">
            <p className="text-2xl font-semibold tracking-tight">Draft statement</p>
            <p className="text-sm">{period.label}</p>
            <p className="text-sm text-muted-foreground">
              {formatDay(period.from)} to {formatDay(period.to)}
            </p>
          </div>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Landlord</p>
            <p className="font-medium">{data.owner.name}</p>
            {data.owner.phone && (
              <p className="text-sm text-muted-foreground">{data.owner.phone}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Prepared</p>
            <p className="font-medium">{formatDay(dubaiToday())}</p>
            <p className="text-sm text-muted-foreground">Amounts in AED</p>
          </div>
        </section>

        {!s.lines.length ? (
          <p className="text-sm">No managed units are recorded for this landlord.</p>
        ) : (
          <>
            <div className="space-y-4">
              {s.lines.map((l) => (
                <section
                  key={l.unitId}
                  className="break-inside-avoid rounded-md border border-border p-4 print:border-x-0 print:border-t-0 print:px-0"
                >
                  <h2 className="font-medium">{l.unitLabel}</h2>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row
                      label={`Rent cleared (${l.chequesCleared} cheque${l.chequesCleared === 1 ? "" : "s"})`}
                      value={money(l.rentCleared)}
                    />
                    <Row
                      label={`Management fee, ${l.feePercent}% of rent cleared`}
                      value={`−${money(l.fee)}`}
                    />
                    {l.maintenanceItems.length ? (
                      l.maintenanceItems.map((m, i) => (
                        <Row
                          key={i}
                          label={`Maintenance: ${m.title} (${formatDay(m.date)})`}
                          value={`−${money(m.cost)}`}
                        />
                      ))
                    ) : (
                      <Row label="Maintenance paid by landlord" value={`−${money(0)}`} />
                    )}
                    <Row label="Net for this unit" value={money(l.net)} strong />
                  </dl>
                </section>
              ))}
            </div>

            <section className="mt-6 break-inside-avoid border-t border-border pt-4">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Totals</h2>
              <dl className="mt-2 space-y-1 text-sm">
                <Row label="Rent cleared in the period" value={money(s.totals.rentCleared)} />
                <Row label="Less management fee" value={`−${money(s.totals.fee)}`} />
                <Row
                  label="Less maintenance paid by landlord"
                  value={`−${money(s.totals.maintenance)}`}
                />
                <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
                  <dt className="font-semibold">Net to landlord</dt>
                  <dd className="text-lg font-semibold">{aed(s.totals.net)}</dd>
                </div>
              </dl>
            </section>
          </>
        )}

        <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            Draft for review. It is built from the records the agency keeps in its CRM: cheques
            marked cleared in the period and finished maintenance jobs marked as paid by the
            landlord. It is not a tax invoice, a bank statement or an accounting ledger, and it has
            not been filed with any authority. Please check it against the bank before any payment
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
