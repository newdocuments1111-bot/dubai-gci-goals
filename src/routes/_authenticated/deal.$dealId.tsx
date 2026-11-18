import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleDot,
  Copy,
  FileText,
  Receipt,
  SkipForward,
  Undo2,
} from "lucide-react";
import {
  addDealPayment,
  deleteDealPayment,
  getDealRoom,
  issueInvoice,
  updateDealTerms,
  updateStep,
} from "@/lib/dealroom.functions";
import { setDealStatus } from "@/lib/deals.functions";
import {
  currentStep,
  formDraft,
  formsFor,
  progress,
  stepDocInVault,
  stepState,
  type FormKind,
} from "@/lib/dealroom";
import { DRAFT_LABEL } from "@/lib/paperwork";
import { PaperworkDialog } from "@/components/PaperworkDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const roomQuery = (id: string) =>
  queryOptions({ queryKey: ["deal-room", id], queryFn: () => getDealRoom({ data: id }) });

export const Route = createFileRoute("/_authenticated/deal/$dealId")({
  head: () => ({
    meta: [
      { title: "Deal Room — Dubai AI GCI" },
      { name: "description", content: "One deal from the first form to the title deed." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(roomQuery(params.dealId)),
  component: DealRoomPage,
});

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Dubai",
      })
    : "";
const isoDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }) : "";
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
const PAYMENT_LABEL: Record<string, string> = {
  deposit: "Deposit received",
  commission_received: "Commission received",
  co_broker_paid: "Paid to co-broker",
  agent_paid: "Paid to agent",
  other: "Other",
};
const card = "rounded-xl border border-border bg-background p-4 shadow-xs";

function DealRoomPage() {
  const { dealId } = Route.useParams();
  const { data } = useSuspenseQuery(roomQuery(dealId));
  const client = useQueryClient();
  const navigate = useNavigate();
  const step = useServerFn(updateStep);
  const status = useServerFn(setDealStatus);
  const invoice = useServerFn(issueInvoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormKind | null>(null);
  const [paperwork, setPaperwork] = useState(false);
  const [editTerms, setEditTerms] = useState(false);
  const d = data.deal;
  const cur = currentStep(data.steps);
  const prog = progress(data.steps);
  const now = new Date();

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await client.invalidateQueries({ queryKey: ["deal-room", dealId] });
      void client.invalidateQueries({ queryKey: ["deals"] });
      void client.invalidateQueries({ queryKey: ["home"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const title = data.listing?.title || data.lead?.name || "Deal";
  const kindLabel =
    data.kind === "rent" ? "Rental" : data.kind === "sale_offplan" ? "Off-plan sale" : "Ready sale";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        to="/deals"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Deals
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {[
              kindLabel,
              aed(d.price_aed),
              data.lead ? `Client: ${data.lead.name || "Unnamed"}` : null,
              `Agent: ${data.agent.name}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {data.lead && (
              <>
                {" · "}
                <Link to="/lead/$leadId" params={{ leadId: data.lead.id }} className="underline">
                  Open lead
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Deal status"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={d.status}
            disabled={!data.canEdit || busy}
            onChange={(e) =>
              void run(() => status({ data: { id: d.id, status: e.target.value as "closed" } }))
            }
          >
            {["under offer", "closed", "fell through"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`${card} mb-4`}>
        <div className="flex items-center justify-between text-sm">
          <span>
            <strong>{prog.done}</strong> of {prog.total} steps done
            {cur && (
              <>
                {" · "}Next: <strong>{cur.label}</strong> ({cur.who}
                {cur.due_at ? `, due ${day(cur.due_at)}` : ""})
              </>
            )}
          </span>
          <span className="text-muted-foreground">{prog.percent}%</span>
        </div>
        <Progress value={prog.percent} className="mt-2" aria-label="Deal progress" />
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section aria-label="Steps" className={card}>
          <h2 className="mb-3 font-semibold">Steps</h2>
          <ol className="space-y-1">
            {data.steps.map((s) => {
              const st = stepState(s, cur, now);
              const inVault = stepDocInVault(data.kind, s.key, data.vaultFiles);
              return (
                <li
                  key={s.key}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 ${st === "current" ? "bg-primary/5" : st === "overdue" ? "bg-destructive/5" : ""}`}
                >
                  {st === "done" ? (
                    <CheckCircle2 className="size-5 shrink-0 text-primary" aria-label="Done" />
                  ) : st === "current" || st === "overdue" ? (
                    <CircleDot
                      className={`size-5 shrink-0 ${st === "overdue" ? "text-destructive" : "text-primary"}`}
                      aria-label="Now"
                    />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground" aria-label={st} />
                  )}
                  <div className="min-w-0 flex-1 basis-56">
                    <p
                      className={`text-sm ${st === "skipped" ? "text-muted-foreground line-through" : "font-medium"}`}
                    >
                      {s.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.who}
                      {s.done_at
                        ? ` · done ${day(s.done_at)}`
                        : s.due_at
                          ? ` · due ${day(s.due_at)}`
                          : ""}
                      {st === "overdue" && <span className="text-destructive"> · overdue</span>}
                      {inVault === true && (
                        <span className="text-primary"> · document in vault</span>
                      )}
                      {inVault === false && !s.skipped && <span> · document not in vault</span>}
                    </p>
                  </div>
                  {data.canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      {!s.done_at && !s.skipped && (
                        <>
                          <Input
                            type="date"
                            aria-label={`Due date for ${s.label}`}
                            className="h-8 w-36 text-xs"
                            value={isoDay(s.due_at)}
                            onChange={(e) =>
                              void run(() =>
                                step({
                                  data: {
                                    dealId,
                                    key: s.key,
                                    action: "due",
                                    ...(e.target.value ? { due: e.target.value } : {}),
                                  },
                                }),
                              )
                            }
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            disabled={busy}
                            onClick={() =>
                              void run(() => step({ data: { dealId, key: s.key, action: "done" } }))
                            }
                          >
                            Done
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Skip ${s.label}`}
                            title="Not needed for this deal"
                            disabled={busy}
                            onClick={() =>
                              void run(() => step({ data: { dealId, key: s.key, action: "skip" } }))
                            }
                          >
                            <SkipForward className="size-4" />
                          </Button>
                        </>
                      )}
                      {(s.done_at || s.skipped) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Undo ${s.label}`}
                          disabled={busy}
                          onClick={() =>
                            void run(() => step({ data: { dealId, key: s.key, action: "undo" } }))
                          }
                        >
                          <Undo2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Prepare a draft:</span>
            {formsFor(data.kind, d.co_broker_percent > 0 || !!d.co_broker_name).map((k) => (
              <Button key={k} variant="outline" size="sm" onClick={() => setForm(k)}>
                <FileText className="size-4" />
                Form {k}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPaperwork(true)}>
              <FileText className="size-4" />
              {d.deal_type === "rent" ? "Ejari + checklist" : "Form F + checklist"}
            </Button>
          </div>
        </section>

        <div className="space-y-4">
          <section aria-label="Money" className={card}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Money</h2>
              {data.canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditTerms(true)}
                >
                  Edit terms
                </Button>
              )}
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Commission {d.total_commission_percent}%</dt>
              <dd className="text-right">{aed(data.money.total)}</dd>
              {d.co_broker_percent > 0 && (
                <>
                  <dt className="text-muted-foreground">
                    {d.co_broker_name || "Co-broker"} {d.co_broker_percent}% (Form I)
                  </dt>
                  <dd className="text-right">−{aed(data.money.coBroker)}</dd>
                </>
              )}
              <dt className="font-medium">Our GCI</dt>
              <dd className="text-right font-medium">{aed(data.money.gci)}</dd>
              <dt className="text-muted-foreground">Agent split {data.agent.splitPercent}%</dt>
              <dd className="text-right">{aed(data.money.agentShare)}</dd>
              <dt className="text-muted-foreground">Agency share</dt>
              <dd className="text-right">{aed(data.money.agencyShare)}</dd>
              <dt className="text-muted-foreground">VAT {d.vat_percent}% on our invoice</dt>
              <dd className="text-right">{aed(data.money.vat)}</dd>
              <dt className="font-medium">Invoice total</dt>
              <dd className="text-right font-medium">{aed(data.money.invoiceTotal)}</dd>
            </dl>
            {data.canEdit && (
              <Button
                className="mt-3 w-full"
                disabled={busy || data.money.gci <= 0}
                onClick={() =>
                  void run(async () => {
                    await invoice({ data: dealId });
                  })
                }
              >
                <Receipt className="size-4" />
                Create commission invoice
              </Button>
            )}
            {data.invoices.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {data.invoices.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <Link
                      to="/invoice/$invoiceId"
                      params={{ invoiceId: i.id }}
                      className="underline"
                    >
                      {i.number}
                    </Link>
                    <span className="text-xs text-muted-foreground">{day(i.issued_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {!data.agency.trn && data.isOwner && (
              <p className="mt-2 text-xs text-muted-foreground">
                Add your TRN and bank details in{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void navigate({ to: "/settings/deals" })}
                >
                  Deals and fees
                </button>{" "}
                so they print on invoices.
              </p>
            )}
          </section>

          {data.costs && (
            <section aria-label="Buyer costs" className={card}>
              <h2 className="mb-2 font-semibold">What the buyer pays (estimate)</h2>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                {data.costs.rows.map((r) => (
                  <div key={r.label} className="contents">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="text-right">{aed(r.aed)}</dd>
                  </div>
                ))}
                <dt className="font-medium">On top of the price</dt>
                <dd className="text-right font-medium">{aed(data.costs.total)}</dd>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Confirm with the trustee office before telling the client. Figures are set in Deals
                and fees.
              </p>
            </section>
          )}

          <Payments data={data} dealId={dealId} run={run} busy={busy} />
        </div>
      </div>

      {form && (
        <FormDialog
          kind={form}
          onClose={() => setForm(null)}
          draft={formDraft(form, {
            dealType: d.deal_type as "sale" | "rent",
            client: { name: data.lead?.name ?? "", phone: data.lead?.phone ?? "" },
            sellerName: d.seller_name,
            coBrokerName: d.co_broker_name,
            coBrokerPercent: d.co_broker_percent,
            totalCommissionPercent: d.total_commission_percent,
            price: d.price_aed,
            property: data.listing,
            agency: {
              name: data.agency.name,
              rera_brn: data.agency.rera_brn,
              agent_name: data.agent.name,
            },
            today: todayIso(),
          })}
        />
      )}
      {paperwork && <PaperworkDialog dealId={dealId} onClose={() => setPaperwork(false)} />}
      {editTerms && (
        <TermsDialog data={data} dealId={dealId} onClose={() => setEditTerms(false)} run={run} />
      )}
    </main>
  );
}

type Room = Awaited<ReturnType<typeof getDealRoom>>;

function Payments({
  data,
  dealId,
  run,
  busy,
}: {
  data: Room;
  dealId: string;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  const add = useServerFn(addDealPayment);
  const remove = useServerFn(deleteDealPayment);
  const [kind, setKind] = useState("commission_received");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState("");
  return (
    <section aria-label="Payments" className={card}>
      <h2 className="mb-2 font-semibold">Payments</h2>
      {data.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {data.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1">
                {PAYMENT_LABEL[p.kind] ?? p.kind}
                {p.note && <span className="text-muted-foreground"> · {p.note}</span>}
                <span className="block text-xs text-muted-foreground">{p.paid_on}</span>
              </span>
              <span className="font-medium">{aed(p.amount_aed)}</span>
              {data.isOwner && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => void run(() => remove({ data: p.id }))}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.canEdit && (
        <form
          className="mt-3 grid grid-cols-2 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount.replace(/[^\d.]/g, ""));
            if (!n) return;
            void run(async () => {
              await add({
                data: { dealId, kind: kind as "other", amount_aed: n, paid_on: paidOn, note },
              });
              setAmount("");
              setNote("");
            });
          }}
        >
          <select
            aria-label="Payment type"
            className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {Object.entries(PAYMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Input
            aria-label="Amount in AED"
            placeholder="Amount (AED)"
            inputMode="decimal"
            className="h-9"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            aria-label="Paid on"
            type="date"
            className="h-9"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
          <Input
            aria-label="Note"
            placeholder="Note (cheque no., bank)"
            maxLength={300}
            className="col-span-2 h-9"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="col-span-2"
            disabled={busy || !amount.trim()}
          >
            Record payment
          </Button>
        </form>
      )}
    </section>
  );
}

function FormDialog({
  kind,
  draft,
  onClose,
}: {
  kind: FormKind;
  draft: { title: string; text: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{draft.title}</DialogTitle>
        <DialogDescription>
          Filled from this deal. Complete and sign the official RERA Form {kind}; this is only a
          draft to copy from.
        </DialogDescription>
        <span className="w-fit rounded bg-warning/15 px-2 py-0.5 text-xs font-medium">
          {DRAFT_LABEL}
        </span>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
          {draft.text}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={async () => {
            await navigator.clipboard.writeText(draft.text);
            setCopied(true);
          }}
        >
          <Copy className="size-4" />
          {copied ? "Copied" : "Copy draft"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function TermsDialog({
  data,
  dealId,
  onClose,
  run,
}: {
  data: Room;
  dealId: string;
  onClose: () => void;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const save = useServerFn(updateDealTerms);
  const d = data.deal;
  const [track, setTrack] = useState<"ready" | "offplan">(
    d.track === "offplan" ? "offplan" : "ready",
  );
  const [total, setTotal] = useState(String(d.total_commission_percent));
  const [coName, setCoName] = useState(d.co_broker_name);
  const [coPct, setCoPct] = useState(String(d.co_broker_percent));
  const [vat, setVat] = useState(String(d.vat_percent));
  const [loan, setLoan] = useState(d.loan_aed == null ? "" : String(d.loan_aed));
  const [seller, setSeller] = useState(d.seller_name);
  const num = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Deal terms</DialogTitle>
        <DialogDescription>Commission, co-broker (Form I) and how the deal runs.</DialogDescription>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await save({
                data: {
                  dealId,
                  track,
                  total_commission_percent: num(total),
                  co_broker_name: coName,
                  co_broker_percent: num(coPct),
                  vat_percent: num(vat),
                  loan_aed: loan.trim() ? num(loan) : null,
                  seller_name: seller,
                },
              });
              onClose();
            });
          }}
        >
          {d.deal_type === "sale" && (
            <label className="text-sm sm:col-span-2">
              Property
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={track}
                onChange={(e) => setTrack(e.target.value as "ready" | "offplan")}
              >
                <option value="ready">Ready (DLD transfer)</option>
                <option value="offplan">Off-plan (SPA and Oqood)</option>
              </select>
            </label>
          )}
          <label className="text-sm">
            Total commission %
            <Input
              className="mt-1 h-9"
              inputMode="decimal"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </label>
          <label className="text-sm">
            VAT %
            <Input
              className="mt-1 h-9"
              inputMode="decimal"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Co-broker agency
            <Input
              className="mt-1 h-9"
              maxLength={200}
              placeholder="None"
              value={coName}
              onChange={(e) => setCoName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Their share of commission %
            <Input
              className="mt-1 h-9"
              inputMode="decimal"
              value={coPct}
              onChange={(e) => setCoPct(e.target.value)}
            />
          </label>
          <label className="text-sm">
            {d.deal_type === "rent" ? "Landlord name" : "Seller name"}
            <Input
              className="mt-1 h-9"
              maxLength={200}
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
            />
          </label>
          {d.deal_type === "sale" && (
            <label className="text-sm">
              Mortgage loan (AED, if any)
              <Input
                className="mt-1 h-9"
                inputMode="decimal"
                value={loan}
                onChange={(e) => setLoan(e.target.value)}
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Our GCI = total commission minus the co-broker&apos;s share. It feeds Deals, Today, the
            Monday report and Ask your CRM.
          </p>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
