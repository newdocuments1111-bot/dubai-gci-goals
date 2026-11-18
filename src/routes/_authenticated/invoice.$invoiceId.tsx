import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { getInvoice } from "@/lib/dealroom.functions";
import { Button } from "@/components/ui/button";

const invoiceQuery = (id: string) =>
  queryOptions({ queryKey: ["invoice", id], queryFn: () => getInvoice({ data: id }) });

export const Route = createFileRoute("/_authenticated/invoice/$invoiceId")({
  head: () => ({
    meta: [{ title: "Commission invoice — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(invoiceQuery(params.invoiceId)),
  component: InvoicePage,
});

type Snapshot = {
  agency: { name: string; rera_brn: string; trn: string; bank: string };
  client: { name: string; phone: string };
  property: string;
  dealType: string;
  price: number;
  totalCommissionPercent: number;
  coBrokerName: string;
  coBrokerPercent: number;
  vatPercent: number;
  gci: number;
  vat: number;
  total: number;
};

const aed = (n: number) =>
  `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Printable commission invoice. Amounts are frozen at issue time; print or save as PDF from the browser. */
function InvoicePage() {
  const { invoiceId } = Route.useParams();
  const { data } = useSuspenseQuery(invoiceQuery(invoiceId));
  const s = data.snapshot as unknown as Snapshot;
  const issued = new Date(data.issued_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
  const ourPercent = s.totalCommissionPercent * (1 - s.coBrokerPercent / 100);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to="/deal/$dealId"
          params={{ dealId: data.deal_id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Deal Room
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print or save as PDF
        </Button>
      </div>
      <article className="rounded-xl border border-border bg-background p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xl font-semibold">{s.agency.name}</p>
            {s.agency.rera_brn && (
              <p className="text-sm text-muted-foreground">RERA ORN / BRN: {s.agency.rera_brn}</p>
            )}
            {s.agency.trn && <p className="text-sm text-muted-foreground">TRN: {s.agency.trn}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight">
              {s.agency.trn ? "Tax invoice" : "Invoice"}
            </p>
            <p className="text-sm">{data.number}</p>
            <p className="text-sm text-muted-foreground">{issued}</p>
          </div>
        </header>
        <section className="grid gap-4 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</p>
            <p className="font-medium">{s.client.name || "________"}</p>
            {s.client.phone && <p className="text-sm text-muted-foreground">{s.client.phone}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Property</p>
            <p className="font-medium">{s.property || "________"}</p>
            <p className="text-sm text-muted-foreground">
              {s.dealType === "rent" ? "Annual rent" : "Sale price"}: {aed(s.price)}
            </p>
          </div>
        </section>
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-3">
                Brokerage commission, {Math.round(ourPercent * 100) / 100}% of {aed(s.price)}
                {s.coBrokerPercent > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    Our share of {s.totalCommissionPercent}% total, shared with{" "}
                    {s.coBrokerName || "the co-broker"} under Form I
                  </span>
                )}
              </td>
              <td className="py-3 text-right">{aed(s.gci)}</td>
            </tr>
            <tr>
              <td className="pt-3 text-muted-foreground">VAT {s.vatPercent}%</td>
              <td className="pt-3 text-right">{aed(s.vat)}</td>
            </tr>
            <tr>
              <td className="pt-2 font-semibold">Total due</td>
              <td className="pt-2 text-right text-lg font-semibold">{aed(s.total)}</td>
            </tr>
          </tbody>
        </table>
        {s.agency.bank && (
          <section className="mt-8 border-t border-border pt-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment details</p>
            <p className="whitespace-pre-line">{s.agency.bank}</p>
          </section>
        )}
      </article>
    </main>
  );
}
