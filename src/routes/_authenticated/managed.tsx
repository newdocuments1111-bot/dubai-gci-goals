import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { Copy, Plus, Printer } from "lucide-react";
import {
  createLeaseCheques,
  deleteUnit,
  getManaged,
  saveLease,
  saveRenewalNote,
  saveTicket,
  saveUnit,
  setChequeStatus,
  setLeaseStatus,
  setTicketStatus,
} from "@/lib/pm.functions";
import {
  CHEQUE_STATUSES,
  LEASE_STATUSES,
  MAX_CHEQUES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  UNIT_STATUSES,
  UNIT_TYPES,
  WHO_PAYS,
  addDays,
  aed,
  chequeBuckets,
  chequeDueLabel,
  chequeReminder,
  chequeSchedule,
  defaultLeaseEnd,
  formatDay,
  isDay,
  labelOf,
  monthPeriod,
  nextCheque,
  ownerStatement,
  renewalReminder,
  renewals,
  unitLabel,
  type ChequeStatus,
  type TicketPriority,
  type TicketStatus,
  type UnitStatus,
  type WhoPays,
} from "@/lib/pm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const managedQuery = queryOptions({ queryKey: ["managed"], queryFn: () => getManaged() });

export const Route = createFileRoute("/_authenticated/managed")({
  head: () => ({
    meta: [{ title: "Managed properties — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(managedQuery),
  component: ManagedPage,
});

type Data = Awaited<ReturnType<typeof getManaged>>;
type Unit = Data["units"][number];
type Lease = Data["leases"][number];
type Cheque = Data["cheques"][number];
type Ticket = Data["tickets"][number];
/** Runs a change, shows what went wrong, and reloads the page data when it worked. */
type Run = (fn: () => Promise<unknown>) => Promise<boolean>;

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const cardCls = "rounded-xl border border-border bg-background p-4";
const emptyCls =
  "rounded-xl border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground";
const TONE = {
  late: "bg-destructive/10 text-destructive",
  soon: "bg-warning/15 text-warning-foreground",
  ok: "bg-muted text-muted-foreground",
  good: "bg-primary/10 text-primary",
} as const;
const Pill = ({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${TONE[tone]}`}>{children}</span>
);
const num = (s: string) => (s.trim() ? Number(s.replace(/[^\d.]/g, "")) || 0 : null);
const str = (n: number | null) => (n === null ? "" : String(n));

function ManagedPage() {
  const { data } = useSuspenseQuery(managedQuery);
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [unitForm, setUnitForm] = useState<UnitForm | null>(null);
  const [leaseForm, setLeaseForm] = useState<LeaseForm | null>(null);
  const [ticketForm, setTicketForm] = useState<TicketForm | null>(null);

  const run: Run = async (fn) => {
    setError("");
    try {
      const result = await fn();
      const message =
        result && typeof result === "object" && "error" in result ? String(result.error) : "";
      await client.invalidateQueries({ queryKey: ["managed"] });
      if (message) setError(message);
      return !message;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    }
  };

  const bounced = data.cheques.filter((c) => c.status === "bounced").length;
  const dueSoon = chequeBuckets(data.cheques, data.today).thisWeek.length;
  const renewalCount = renewals(data.leases, data.today).length;
  const openJobs = data.tickets.filter((t) => t.status === "open" || t.status === "assigned");

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Managed properties</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Homes you manage for landlords: tenants, rent cheques, renewals, maintenance and a draft
          statement for each landlord. These are your own records, not an accounting ledger. Nothing
          here is filed with Ejari or any authority, and no message is sent for you: reminders are
          drafts you copy and send yourself.
        </p>
      </div>

      {!data.complete && (
        <p role="status" className="rounded-md bg-warning/15 px-3 py-2 text-sm">
          There are more records than this page can load at once, so some older rows are missing
          from the lists and totals below.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="units">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="units">Units ({data.units.length})</TabsTrigger>
          <TabsTrigger value="cheques">
            Cheques{dueSoon + bounced > 0 ? ` (${dueSoon + bounced})` : ""}
          </TabsTrigger>
          <TabsTrigger value="renewals">
            Renewals{renewalCount > 0 ? ` (${renewalCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            Maintenance{openJobs.length > 0 ? ` (${openJobs.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="mt-4">
          <UnitsTab
            data={data}
            run={run}
            editUnit={setUnitForm}
            editLease={setLeaseForm}
            newTicket={(unitId) => setTicketForm(emptyTicket(unitId, data.today))}
          />
        </TabsContent>
        <TabsContent value="cheques" className="mt-4">
          <ChequesTab data={data} run={run} />
        </TabsContent>
        <TabsContent value="renewals" className="mt-4">
          <RenewalsTab data={data} run={run} editLease={setLeaseForm} />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <MaintenanceTab data={data} run={run} edit={setTicketForm} />
        </TabsContent>
        <TabsContent value="statements" className="mt-4">
          <StatementsTab data={data} />
        </TabsContent>
      </Tabs>

      {unitForm && <UnitDialog data={data} form={unitForm} setForm={setUnitForm} run={run} />}
      {leaseForm && <LeaseDialog data={data} form={leaseForm} setForm={setLeaseForm} run={run} />}
      {ticketForm && (
        <TicketDialog data={data} form={ticketForm} setForm={setTicketForm} run={run} />
      )}
    </main>
  );
}

// ---------- shared ----------

/** Copies a drafted message. Nothing is sent; if the browser refuses, the text is shown to copy by hand. */
function CopyDraft({ text, label = "Copy reminder" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
          } catch {
            setState("failed");
          }
        }}
      >
        <Copy className="size-4" />
        {state === "copied" ? "Copied" : label}
      </Button>
      {state === "failed" && (
        <div className="basis-full">
          <p role="alert" className="mb-1 text-xs text-destructive">
            Could not copy. Select the text below and copy it by hand.
          </p>
          <Textarea readOnly rows={6} value={text} className="text-sm" />
        </div>
      )}
    </>
  );
}

const useLookups = (data: Data) =>
  useMemo(() => {
    const unitById = new Map(data.units.map((u) => [u.id, u]));
    const leaseById = new Map(data.leases.map((l) => [l.id, l]));
    const ownerById = new Map(data.owners.map((o) => [o.id, o]));
    const activeLeaseByUnit = new Map(
      data.leases.filter((l) => l.status === "active").map((l) => [l.unit_id, l]),
    );
    const chequesByLease = new Map<string, Cheque[]>();
    for (const c of data.cheques)
      chequesByLease.set(c.lease_id, [...(chequesByLease.get(c.lease_id) ?? []), c]);
    return { unitById, leaseById, ownerById, activeLeaseByUnit, chequesByLease };
  }, [data]);

const unitName = (u: Unit | undefined) => (u ? unitLabel(u) : "Unit");

// ---------- units ----------

type UnitForm = {
  id?: string;
  owner_id: string;
  building: string;
  unit_number: string;
  community: string;
  unit_type: (typeof UNIT_TYPES)[number];
  bedrooms: string;
  size_sqft: string;
  status: UnitStatus;
  management_fee_percent: string;
  notes: string;
};
const emptyUnit = (ownerId: string): UnitForm => ({
  owner_id: ownerId,
  building: "",
  unit_number: "",
  community: "",
  unit_type: "apartment",
  bedrooms: "",
  size_sqft: "",
  status: "empty",
  management_fee_percent: "5",
  notes: "",
});
const unitToForm = (u: Unit): UnitForm => ({
  id: u.id,
  owner_id: u.owner_id,
  building: u.building,
  unit_number: u.unit_number,
  community: u.community,
  unit_type: (UNIT_TYPES as readonly string[]).includes(u.unit_type)
    ? (u.unit_type as UnitForm["unit_type"])
    : "apartment",
  bedrooms: str(u.bedrooms),
  size_sqft: str(u.size_sqft),
  status: u.status as UnitStatus,
  management_fee_percent: String(u.management_fee_percent),
  notes: u.notes,
});
const UNIT_TONE: Record<string, keyof typeof TONE> = {
  occupied: "good",
  empty: "ok",
  notice: "soon",
};

function UnitsTab({
  data,
  run,
  editUnit,
  editLease,
  newTicket,
}: {
  data: Data;
  run: Run;
  editUnit: (f: UnitForm) => void;
  editLease: (f: LeaseForm) => void;
  newTicket: (unitId: string) => void;
}) {
  const look = useLookups(data);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const endLease = useServerFn(setLeaseStatus);
  const makeCheques = useServerFn(createLeaseCheques);
  const needle = q.trim().toLowerCase();
  const units = data.units.filter((u) => {
    if (!needle) return true;
    const lease = look.activeLeaseByUnit.get(u.id);
    return [unitLabel(u), look.ownerById.get(u.owner_id)?.name, lease?.tenant_name]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  if (!data.owners.length)
    return (
      <p className={emptyCls}>
        Add the landlord first on the{" "}
        <Link to="/owners" className="font-medium underline">
          Owners page
        </Link>
        , then come back to add the home you manage for them.
      </p>
    );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-9 max-w-xs"
          placeholder="Search building, landlord or tenant"
          aria-label="Search units"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button
          size="sm"
          className="ms-auto"
          onClick={() => editUnit(emptyUnit(data.owners[0]!.id))}
        >
          <Plus className="size-4" />
          Add unit
        </Button>
      </div>
      {!units.length ? (
        <p className={emptyCls}>
          {data.units.length ? "No unit matches your search." : "No managed units yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          <li
            aria-hidden
            className="hidden gap-3 px-4 text-xs uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[2fr_1.4fr_1fr_1fr_1.3fr_auto]"
          >
            <span>Unit and landlord</span>
            <span>Tenant</span>
            <span>Rent a year</span>
            <span>Lease ends</span>
            <span>Next cheque</span>
            <span className="w-24" />
          </li>
          {units.map((u) => {
            const lease = look.activeLeaseByUnit.get(u.id);
            const cheques = lease ? (look.chequesByLease.get(lease.id) ?? []) : [];
            const next = nextCheque(cheques);
            const history = data.leases.filter((l) => l.unit_id === u.id && l.status !== "active");
            return (
              <li key={u.id} className={cardCls}>
                <div className="grid gap-x-3 gap-y-2 md:grid-cols-[2fr_1.4fr_1fr_1fr_1.3fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{unitLabel(u)}</span>
                      <Pill tone={UNIT_TONE[u.status] ?? "ok"}>
                        {labelOf(UNIT_STATUSES, u.status)}
                      </Pill>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {look.ownerById.get(u.owner_id)?.name ?? "Landlord"} ·{" "}
                      {u.bedrooms === null ? u.unit_type : `${u.bedrooms} bed ${u.unit_type}`} · fee{" "}
                      {Number(u.management_fee_percent)}%
                    </p>
                  </div>
                  <Field label="Tenant">{lease?.tenant_name || "No tenant"}</Field>
                  <Field label="Rent a year">
                    {lease ? aed(Number(lease.annual_rent_aed)) : "—"}
                  </Field>
                  <Field label="Lease ends">{lease ? formatDay(lease.end_date) : "—"}</Field>
                  <Field label="Next cheque">
                    {next ? (
                      <>
                        {aed(Number(next.amount_aed))} · {formatDay(next.due_date)}
                      </>
                    ) : (
                      "—"
                    )}
                  </Field>
                  <div className="flex gap-2 md:w-24 md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-expanded={open === u.id}
                      onClick={() => setOpen(open === u.id ? null : u.id)}
                    >
                      {open === u.id ? "Close" : "Open"}
                    </Button>
                  </div>
                </div>

                {open === u.id && (
                  <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => editUnit(unitToForm(u))}>
                        Edit unit
                      </Button>
                      {lease ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => editLease(leaseToForm(lease))}
                          >
                            Edit lease
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "End this lease? The unit will be marked empty. Cheques already recorded stay as they are.",
                                )
                              )
                                void run(() =>
                                  endLease({ data: { id: lease.id, status: "ended" } }),
                                );
                            }}
                          >
                            End lease
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => editLease(emptyLease(u.id, data.today))}>
                          <Plus className="size-4" />
                          Add lease
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => newTicket(u.id)}>
                        New maintenance job
                      </Button>
                    </div>

                    {lease && (
                      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        <p>
                          <span className="text-muted-foreground">Lease: </span>
                          {formatDay(lease.start_date)} to {formatDay(lease.end_date)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Deposit held: </span>
                          {aed(Number(lease.deposit_aed))}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Tenant phone: </span>
                          {lease.tenant_phone || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Tenant email: </span>
                          {lease.tenant_email || "—"}
                        </p>
                        <p className="sm:col-span-2">
                          <span className="text-muted-foreground">
                            Ejari number (your record):{" "}
                          </span>
                          {lease.ejari_number || "not entered"}
                        </p>
                      </div>
                    )}

                    {lease &&
                      (cheques.length ? (
                        <div>
                          <p className="mb-1 font-medium">Cheques</p>
                          <ul className="divide-y divide-border rounded-md border border-border">
                            {[...cheques]
                              .sort((a, b) => a.seq - b.seq)
                              .map((c) => (
                                <li
                                  key={c.id}
                                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                                >
                                  <span>
                                    {c.seq} of {cheques.length} · {aed(Number(c.amount_aed))} ·{" "}
                                    {formatDay(c.due_date)}
                                  </span>
                                  <ChequePill cheque={c} today={data.today} />
                                </li>
                              ))}
                          </ul>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Record banked, cleared or bounced on the Cheques tab.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-muted-foreground">This lease has no cheques yet.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void run(() => makeCheques({ data: lease.id }))}
                          >
                            Create {lease.cheque_count} cheque{lease.cheque_count === 1 ? "" : "s"}
                          </Button>
                        </div>
                      ))}

                    {history.length > 0 && (
                      <div>
                        <p className="mb-1 font-medium">Earlier leases</p>
                        <ul className="space-y-1 text-muted-foreground">
                          {history.map((l) => (
                            <li key={l.id}>
                              {l.tenant_name} · {formatDay(l.start_date)} to {formatDay(l.end_date)}{" "}
                              · {aed(Number(l.annual_rent_aed))} ·{" "}
                              {labelOf(LEASE_STATUSES, l.status)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {u.notes && (
                      <p className="whitespace-pre-line text-muted-foreground">{u.notes}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A value with its label shown only on phones, where the column headings are hidden. */
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <p className="min-w-0 text-sm">
    <span className="text-muted-foreground md:hidden">{label}: </span>
    {children}
  </p>
);

function ChequePill({ cheque, today }: { cheque: Cheque; today: string }) {
  const s = chequeDueLabel(cheque, today);
  const tone = s.late ? "late" : cheque.status === "cleared" ? "good" : "ok";
  return <Pill tone={tone}>{s.label}</Pill>;
}

function UnitDialog({
  data,
  form,
  setForm,
  run,
}: {
  data: Data;
  form: UnitForm;
  setForm: (f: UnitForm | null) => void;
  run: Run;
}) {
  const save = useServerFn(saveUnit);
  const del = useServerFn(deleteUnit);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof UnitForm>(key: K, value: UnitForm[K]) =>
    setForm({ ...form, [key]: value });
  const fee = num(form.management_fee_percent) ?? 0;
  const bedrooms = num(form.bedrooms);
  const problem = !form.building.trim()
    ? "Enter the building or villa name."
    : fee > 100
      ? "The management fee cannot be more than 100%."
      : bedrooms !== null && !Number.isInteger(bedrooms)
        ? "Bedrooms must be a whole number."
        : "";
  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{form.id ? "Edit unit" : "Add unit"}</DialogTitle>
        <DialogDescription>
          A home you manage for a landlord. Landlords are added on the Owners page.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Landlord
            <select
              className={`${selectCls} mt-1`}
              value={form.owner_id}
              onChange={(e) => set("owner_id", e.target.value)}
            >
              {data.owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.phone ? ` (${o.phone})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Building or villa
            <Input
              className="mt-1"
              maxLength={200}
              value={form.building}
              onChange={(e) => set("building", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Unit number
            <Input
              className="mt-1"
              maxLength={50}
              value={form.unit_number}
              onChange={(e) => set("unit_number", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Community
            <Input
              className="mt-1"
              maxLength={200}
              value={form.community}
              onChange={(e) => set("community", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Type
            <select
              className={`${selectCls} mt-1 capitalize`}
              value={form.unit_type}
              onChange={(e) => set("unit_type", e.target.value as UnitForm["unit_type"])}
            >
              {UNIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Bedrooms
            <Input
              className="mt-1"
              inputMode="numeric"
              value={form.bedrooms}
              onChange={(e) => set("bedrooms", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Size (sq ft)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.size_sqft}
              onChange={(e) => set("size_sqft", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Status
            <select
              className={`${selectCls} mt-1`}
              value={form.status}
              onChange={(e) => set("status", e.target.value as UnitStatus)}
            >
              {UNIT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Management fee (% of rent cleared)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.management_fee_percent}
              onChange={(e) => set("management_fee_percent", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Notes
            <Textarea
              className="mt-1"
              rows={2}
              maxLength={2000}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
        </div>
        {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          {form.id && data.isOwner ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Delete this unit? This cannot be undone.")) return;
                setBusy(true);
                await run(() => del({ data: form.id! }));
                setBusy(false);
                setForm(null);
              }}
            >
              Delete unit
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || Boolean(problem)}
              onClick={async () => {
                setBusy(true);
                const ok = await run(() =>
                  save({
                    data: {
                      id: form.id,
                      owner_id: form.owner_id,
                      building: form.building,
                      unit_number: form.unit_number,
                      community: form.community,
                      unit_type: form.unit_type,
                      bedrooms,
                      size_sqft: num(form.size_sqft),
                      status: form.status,
                      management_fee_percent: fee,
                      notes: form.notes,
                    },
                  }),
                );
                setBusy(false);
                if (ok) setForm(null);
              }}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- leases ----------

type LeaseForm = {
  id?: string;
  unit_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  lead_id: string;
  start_date: string;
  end_date: string;
  annual_rent_aed: string;
  cheque_count: string;
  deposit_aed: string;
  ejari_number: string;
  renews_lease_id: string | null;
};
const emptyLease = (unitId: string, today: string): LeaseForm => ({
  unit_id: unitId,
  tenant_name: "",
  tenant_phone: "",
  tenant_email: "",
  lead_id: "",
  start_date: today,
  end_date: defaultLeaseEnd(today),
  annual_rent_aed: "",
  cheque_count: "4",
  deposit_aed: "",
  ejari_number: "",
  renews_lease_id: null,
});
const leaseToForm = (l: Lease): LeaseForm => ({
  id: l.id,
  unit_id: l.unit_id,
  tenant_name: l.tenant_name,
  tenant_phone: l.tenant_phone,
  tenant_email: l.tenant_email,
  lead_id: l.lead_id ?? "",
  start_date: l.start_date,
  end_date: l.end_date,
  annual_rent_aed: String(l.annual_rent_aed),
  cheque_count: String(l.cheque_count),
  deposit_aed: String(l.deposit_aed),
  ejari_number: l.ejari_number,
  renews_lease_id: null,
});
/** A new lease for the same tenant, starting the day after the current one ends. Rent is left for a person to type. */
const renewalForm = (l: Lease): LeaseForm => {
  const start = addDays(l.end_date, 1);
  const { id: _old, ...same } = leaseToForm(l);
  return {
    ...same,
    start_date: start,
    end_date: defaultLeaseEnd(start),
    annual_rent_aed: "",
    ejari_number: "",
    renews_lease_id: l.id,
  };
};

function LeaseDialog({
  data,
  form,
  setForm,
  run,
}: {
  data: Data;
  form: LeaseForm;
  setForm: (f: LeaseForm | null) => void;
  run: Run;
}) {
  const save = useServerFn(saveLease);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LeaseForm>(key: K, value: LeaseForm[K]) =>
    setForm({ ...form, [key]: value });
  const unit = data.units.find((u) => u.id === form.unit_id);
  const rent = num(form.annual_rent_aed) ?? 0;
  const count = Number(form.cheque_count);
  const datesOk = isDay(form.start_date) && isDay(form.end_date);
  const problem = !form.tenant_name.trim()
    ? "Enter the tenant's name."
    : !datesOk
      ? "Enter the start and end dates."
      : form.end_date <= form.start_date
        ? "The end date must be after the start."
        : rent <= 0
          ? "Enter the annual rent."
          : "";
  const preview = form.id ? [] : chequeSchedule(rent, count, form.start_date);
  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>
          {form.id ? "Edit lease" : form.renews_lease_id ? "Record renewal" : "Add lease"}
        </DialogTitle>
        <DialogDescription>
          {unitName(unit)}. This is your record of the lease. It is not registered with Ejari from
          here.
          {form.renews_lease_id &&
            " Saving marks the current lease as renewed and starts this one."}
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.leads.length > 0 && (
            <label className="text-sm sm:col-span-2">
              Link to a lead (optional)
              <select
                className={`${selectCls} mt-1`}
                value={form.lead_id}
                onChange={(e) => {
                  const lead = data.leads.find((l) => l.id === e.target.value);
                  setForm({
                    ...form,
                    lead_id: e.target.value,
                    tenant_name: form.tenant_name || lead?.name || "",
                    tenant_phone: form.tenant_phone || lead?.phone || "",
                  });
                }}
              >
                <option value="">Not linked</option>
                {form.lead_id && !data.leads.some((l) => l.id === form.lead_id) && (
                  <option value={form.lead_id}>Linked lead</option>
                )}
                {data.leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name || "No name"}
                    {l.phone ? ` (${l.phone})` : ""}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                Your 300 newest leads are listed.
              </span>
            </label>
          )}
          <label className="text-sm">
            Tenant name
            <Input
              className="mt-1"
              maxLength={200}
              value={form.tenant_name}
              onChange={(e) => set("tenant_name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Tenant phone
            <Input
              className="mt-1"
              maxLength={50}
              value={form.tenant_phone}
              onChange={(e) => set("tenant_phone", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Tenant email
            <Input
              className="mt-1"
              type="email"
              maxLength={200}
              value={form.tenant_email}
              onChange={(e) => set("tenant_email", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Start date
            <Input
              className="mt-1"
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  start_date: e.target.value,
                  // Keep a one-year lease one year long when the start moves.
                  end_date:
                    isDay(e.target.value) &&
                    isDay(form.start_date) &&
                    form.end_date === defaultLeaseEnd(form.start_date)
                      ? defaultLeaseEnd(e.target.value)
                      : form.end_date,
                })
              }
            />
          </label>
          <label className="text-sm">
            End date
            <Input
              className="mt-1"
              type="date"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Annual rent (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.annual_rent_aed}
              onChange={(e) => set("annual_rent_aed", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Number of cheques
            <select
              className={`${selectCls} mt-1`}
              value={form.cheque_count}
              disabled={Boolean(form.id)}
              onChange={(e) => set("cheque_count", e.target.value)}
            >
              {Array.from({ length: MAX_CHEQUES }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Deposit held (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.deposit_aed}
              onChange={(e) => set("deposit_aed", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Ejari number (optional, your record only)
            <Input
              className="mt-1"
              maxLength={100}
              value={form.ejari_number}
              onChange={(e) => set("ejari_number", e.target.value)}
            />
          </label>
        </div>
        {form.id ? (
          <p className="text-sm text-muted-foreground">
            Changing the rent or dates here does not change cheques that already exist.
          </p>
        ) : (
          preview.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Cheques that will be created</p>
              <ul className="mt-1 grid gap-x-6 text-muted-foreground sm:grid-cols-2">
                {preview.map((c) => (
                  <li key={c.seq}>
                    {c.seq}. {aed(c.amount_aed)} · {formatDay(c.due_date)}
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
        {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setForm(null)}>
            Cancel
          </Button>
          <Button
            disabled={busy || Boolean(problem)}
            onClick={async () => {
              setBusy(true);
              const ok = await run(async () => {
                const result = await save({
                  data: {
                    id: form.id,
                    unit_id: form.unit_id,
                    tenant_name: form.tenant_name,
                    tenant_phone: form.tenant_phone,
                    tenant_email: form.tenant_email.trim(),
                    lead_id: form.lead_id || null,
                    start_date: form.start_date,
                    end_date: form.end_date,
                    annual_rent_aed: rent,
                    cheque_count: count,
                    deposit_aed: num(form.deposit_aed) ?? 0,
                    ejari_number: form.ejari_number,
                    renews_lease_id: form.renews_lease_id,
                  },
                });
                if ("cheques" in result && !result.cheques) {
                  setForm(null);
                  return {
                    error:
                      "The lease was saved, but its cheques could not be created. Open the unit and press Create cheques.",
                  };
                }
                return result;
              });
              setBusy(false);
              if (ok) setForm(null);
            }}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- cheques ----------

function ChequesTab({ data, run }: { data: Data; run: Run }) {
  const look = useLookups(data);
  const setStatus = useServerFn(setChequeStatus);
  const buckets = chequeBuckets(data.cheques, data.today);
  const mark = (c: Cheque, status: ChequeStatus) => {
    if (status === "bounced") {
      const note = window.prompt("Reason the bank gave (optional)", c.note);
      if (note === null) return;
      void run(() => setStatus({ data: { id: c.id, status, note: note.slice(0, 500) } }));
    } else void run(() => setStatus({ data: { id: c.id, status } }));
  };
  const groups: { key: string; title: string; hint: string; rows: Cheque[] }[] = [
    {
      key: "bounced",
      title: "Bounced",
      hint: "Returned by the bank. Agree a replacement with the tenant, then mark it cleared or back to pending.",
      rows: buckets.bounced,
    },
    {
      key: "week",
      title: "This week",
      hint: "Not banked yet and due within 7 days, including anything overdue.",
      rows: buckets.thisWeek,
    },
    {
      key: "next30",
      title: "Next 30 days",
      hint: "Not banked yet and due in 8 to 30 days.",
      rows: buckets.next30,
    },
    {
      key: "banked",
      title: "Banked, waiting to clear",
      hint: "Paid in. Mark each one cleared or bounced when the bank confirms.",
      rows: buckets.banked,
    },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        The buttons record what happened; they do not contact a bank or a tenant. Only cleared
        cheques count on a landlord statement.
      </p>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`cheques-${g.key}`}>
          <h2 id={`cheques-${g.key}`} className="text-sm font-semibold">
            {g.title} <span className="font-normal text-muted-foreground">({g.rows.length})</span>
          </h2>
          <p className="mb-2 text-sm text-muted-foreground">{g.hint}</p>
          {!g.rows.length ? (
            <p className={emptyCls}>None.</p>
          ) : (
            <ul className="space-y-2">
              {g.rows.map((c) => {
                const lease = look.leaseById.get(c.lease_id);
                const unit = lease ? look.unitById.get(lease.unit_id) : undefined;
                const count = look.chequesByLease.get(c.lease_id)?.length ?? c.seq;
                return (
                  <li key={c.id} className={cardCls}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {aed(Number(c.amount_aed))}
                          <ChequePill cheque={c} today={data.today} />
                        </p>
                        <p className="text-muted-foreground">
                          {lease?.tenant_name || "Tenant"} · {unitName(unit)} · cheque {c.seq} of{" "}
                          {count} · dated {formatDay(c.due_date)}
                          {c.bank_date ? ` · banked ${formatDay(c.bank_date)}` : ""}
                        </p>
                        {c.note && <p className="text-muted-foreground">Note: {c.note}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {c.status === "pending" && (
                          <Button size="sm" onClick={() => mark(c, "banked")}>
                            Banked
                          </Button>
                        )}
                        {c.status !== "cleared" && (
                          <Button variant="outline" size="sm" onClick={() => mark(c, "cleared")}>
                            Cleared
                          </Button>
                        )}
                        {c.status !== "bounced" && (
                          <Button variant="outline" size="sm" onClick={() => mark(c, "bounced")}>
                            Bounced
                          </Button>
                        )}
                        {c.status !== "pending" && (
                          <Button variant="ghost" size="sm" onClick={() => mark(c, "pending")}>
                            Back to pending
                          </Button>
                        )}
                        {c.status !== "banked" && (
                          <CopyDraft
                            text={chequeReminder({
                              tenantName: lease?.tenant_name ?? "",
                              unitLabel: unitName(unit),
                              seq: c.seq,
                              count,
                              amount: Number(c.amount_aed),
                              dueDate: c.due_date,
                              status: c.status,
                              agencyName: data.agencyName,
                            })}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
      <RecentlyCleared data={data} mark={mark} />
    </div>
  );
}

/** The last cleared cheques, so a wrong click can be put right. */
function RecentlyCleared({
  data,
  mark,
}: {
  data: Data;
  mark: (c: Cheque, status: ChequeStatus) => void;
}) {
  const look = useLookups(data);
  const rows = data.cheques
    .filter((c) => c.status === "cleared")
    .sort((a, b) => (b.cleared_on ?? b.due_date).localeCompare(a.cleared_on ?? a.due_date))
    .slice(0, 10);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="cheques-cleared">
      <h2 id="cheques-cleared" className="mb-2 text-sm font-semibold">
        Recently cleared
      </h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-background text-sm">
        {rows.map((c) => {
          const lease = look.leaseById.get(c.lease_id);
          const unit = lease ? look.unitById.get(lease.unit_id) : undefined;
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span>
                {aed(Number(c.amount_aed))} · {lease?.tenant_name || "Tenant"} · {unitName(unit)} ·
                cleared {formatDay(c.cleared_on ?? c.due_date)}
              </span>
              <Button variant="ghost" size="sm" onClick={() => mark(c, "banked")}>
                Undo
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- renewals ----------

function RenewalsTab({
  data,
  run,
  editLease,
}: {
  data: Data;
  run: Run;
  editLease: (f: LeaseForm) => void;
}) {
  const look = useLookups(data);
  const rows = renewals(data.leases, data.today);
  return (
    <section className="space-y-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Active leases ending within 90 days. The notice date is a reminder of common practice, not
        legal advice: check the current rules before you rely on it. This page does not work out a
        rent increase; the proposed rent is whatever you and the landlord decide and type in.
      </p>
      {!rows.length ? (
        <p className={emptyCls}>No lease ends in the next 90 days.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <RenewalCard
              key={r.lease.id}
              renewal={r}
              unit={look.unitById.get(r.lease.unit_id)}
              landlord={
                look.ownerById.get(look.unitById.get(r.lease.unit_id)?.owner_id ?? "")?.name ?? ""
              }
              agencyName={data.agencyName}
              run={run}
              editLease={editLease}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RenewalCard({
  renewal: r,
  unit,
  landlord,
  agencyName,
  run,
  editLease,
}: {
  renewal: ReturnType<typeof renewals<Lease>>[number];
  unit: Unit | undefined;
  landlord: string;
  agencyName: string;
  run: Run;
  editLease: (f: LeaseForm) => void;
}) {
  const saveNote = useServerFn(saveRenewalNote);
  const endLease = useServerFn(setLeaseStatus);
  const [proposed, setProposed] = useState(r.lease.proposed_rent);
  const [note, setNote] = useState(r.lease.renewal_note);
  const dirty = proposed !== r.lease.proposed_rent || note !== r.lease.renewal_note;
  return (
    <li className={cardCls}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {unitName(unit)}
            <Pill tone={r.ended ? "late" : r.daysLeft <= 30 ? "soon" : "ok"}>
              {r.ended
                ? `Ended ${-r.daysLeft} day${r.daysLeft === -1 ? "" : "s"} ago`
                : `Ends in ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`}
            </Pill>
          </p>
          <p className="text-muted-foreground">
            {r.lease.tenant_name || "Tenant"}
            {landlord ? ` · landlord ${landlord}` : ""} · ends {formatDay(r.lease.end_date)} ·
            current rent {aed(Number(r.lease.annual_rent_aed))}
          </p>
          <p className={r.noticePassed ? "mt-1 text-warning-foreground" : "mt-1"}>{r.noticeLine}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <label className="text-sm">
          Proposed new rent (your text)
          <Input
            className="mt-1 h-9"
            maxLength={100}
            placeholder="e.g. AED 95,000 in 4 cheques"
            value={proposed}
            onChange={(e) => setProposed(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Note
          <Input
            className="mt-1 h-9"
            maxLength={1000}
            placeholder="e.g. Landlord agreed, waiting for the tenant"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={!dirty}
          onClick={() =>
            void run(() =>
              saveNote({ data: { id: r.lease.id, proposed_rent: proposed, renewal_note: note } }),
            )
          }
        >
          Save note
        </Button>
        <CopyDraft
          text={renewalReminder({
            tenantName: r.lease.tenant_name,
            unitLabel: unitName(unit),
            endDate: r.lease.end_date,
            proposedRent: proposed,
            agencyName,
          })}
        />
        <Button variant="outline" size="sm" onClick={() => editLease(renewalForm(r.lease))}>
          Record renewal
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm("End this lease? The unit will be marked empty."))
              void run(() => endLease({ data: { id: r.lease.id, status: "ended" } }));
          }}
        >
          Tenant is leaving
        </Button>
      </div>
    </li>
  );
}

// ---------- maintenance ----------

type TicketForm = {
  id?: string;
  unit_id: string;
  title: string;
  description: string;
  reported_by: string;
  priority: TicketPriority;
  status: TicketStatus;
  contractor_name: string;
  contractor_phone: string;
  cost_aed: string;
  who_pays: WhoPays;
  opened_on: string;
  closed_on: string;
};
const emptyTicket = (unitId: string, today: string): TicketForm => ({
  unit_id: unitId,
  title: "",
  description: "",
  reported_by: "",
  priority: "normal",
  status: "open",
  contractor_name: "",
  contractor_phone: "",
  cost_aed: "",
  who_pays: "owner",
  opened_on: today,
  closed_on: "",
});
const ticketToForm = (t: Ticket): TicketForm => ({
  id: t.id,
  unit_id: t.unit_id,
  title: t.title,
  description: t.description,
  reported_by: t.reported_by,
  priority: t.priority as TicketPriority,
  status: t.status as TicketStatus,
  contractor_name: t.contractor_name,
  contractor_phone: t.contractor_phone,
  cost_aed: str(t.cost_aed),
  who_pays: t.who_pays as WhoPays,
  opened_on: t.opened_on,
  closed_on: t.closed_on ?? "",
});
const PRIORITY_TONE: Record<string, keyof typeof TONE> = {
  urgent: "late",
  high: "soon",
  normal: "ok",
  low: "ok",
};

function MaintenanceTab({
  data,
  run,
  edit,
}: {
  data: Data;
  run: Run;
  edit: (f: TicketForm) => void;
}) {
  const look = useLookups(data);
  const setStatus = useServerFn(setTicketStatus);
  const [show, setShow] = useState<"open" | "all">("open");
  const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const rows = data.tickets
    .filter((t) => show === "all" || t.status === "open" || t.status === "assigned")
    .sort(
      (a, b) =>
        Number(a.status === "done" || a.status === "cancelled") -
          Number(b.status === "done" || b.status === "cancelled") ||
        (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) ||
        b.opened_on.localeCompare(a.opened_on),
    );
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Which jobs to show"
          className={`${selectCls} w-auto`}
          value={show}
          onChange={(e) => setShow(e.target.value as "open" | "all")}
        >
          <option value="open">Open and assigned</option>
          <option value="all">All jobs</option>
        </select>
        <Button
          size="sm"
          className="ms-auto"
          disabled={!data.units.length}
          onClick={() => edit(emptyTicket(data.units[0]!.id, data.today))}
        >
          <Plus className="size-4" />
          New job
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        A finished job that the landlord pays for is taken off their statement in the month it was
        closed. No contractor is contacted from here.
      </p>
      {!rows.length ? (
        <p className={emptyCls}>
          {data.units.length ? "No maintenance jobs to show." : "Add a unit first."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className={cardCls}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {t.title}
                    <Pill tone={PRIORITY_TONE[t.priority] ?? "ok"}>
                      {labelOf(TICKET_PRIORITIES, t.priority)}
                    </Pill>
                  </p>
                  <p className="text-muted-foreground">
                    {unitName(look.unitById.get(t.unit_id))} · opened {formatDay(t.opened_on)}
                    {t.closed_on ? ` · closed ${formatDay(t.closed_on)}` : ""}
                    {t.reported_by ? ` · reported by ${t.reported_by}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {t.contractor_name
                      ? `Contractor: ${t.contractor_name}${t.contractor_phone ? ` (${t.contractor_phone})` : ""}`
                      : "No contractor yet"}{" "}
                    · {t.cost_aed === null ? "cost not known" : aed(Number(t.cost_aed))} · paid by{" "}
                    {labelOf(WHO_PAYS, t.who_pays).toLowerCase()}
                  </p>
                  {t.description && <p className="mt-1 whitespace-pre-line">{t.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <select
                    aria-label={`Status of ${t.title}`}
                    className={`${selectCls} w-auto`}
                    value={t.status}
                    onChange={(e) =>
                      void run(() =>
                        setStatus({ data: { id: t.id, status: e.target.value as TicketStatus } }),
                      )
                    }
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" onClick={() => edit(ticketToForm(t))}>
                    Edit
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TicketDialog({
  data,
  form,
  setForm,
  run,
}: {
  data: Data;
  form: TicketForm;
  setForm: (f: TicketForm | null) => void;
  run: Run;
}) {
  const save = useServerFn(saveTicket);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TicketForm>(key: K, value: TicketForm[K]) =>
    setForm({ ...form, [key]: value });
  const closed = form.status === "done" || form.status === "cancelled";
  const problem = !form.title.trim()
    ? "Say what the problem is."
    : !isDay(form.opened_on)
      ? "Enter the date it was reported."
      : form.closed_on && !isDay(form.closed_on)
        ? "Check the closed date."
        : "";
  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{form.id ? "Edit maintenance job" : "New maintenance job"}</DialogTitle>
        <DialogDescription>
          Your record of the job. Costs here are records, not invoices or ledger entries.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Unit
            <select
              className={`${selectCls} mt-1`}
              value={form.unit_id}
              onChange={(e) => set("unit_id", e.target.value)}
            >
              {data.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Problem
            <Input
              className="mt-1"
              maxLength={200}
              placeholder="e.g. AC not cooling in the main bedroom"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Details
            <Textarea
              className="mt-1"
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Reported by
            <Input
              className="mt-1"
              maxLength={200}
              placeholder="Tenant, landlord, inspection…"
              value={form.reported_by}
              onChange={(e) => set("reported_by", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Priority
            <select
              className={`${selectCls} mt-1`}
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as TicketPriority)}
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Contractor name
            <Input
              className="mt-1"
              maxLength={200}
              value={form.contractor_name}
              onChange={(e) => set("contractor_name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Contractor phone
            <Input
              className="mt-1"
              maxLength={50}
              value={form.contractor_phone}
              onChange={(e) => set("contractor_phone", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Cost (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.cost_aed}
              onChange={(e) => set("cost_aed", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Who pays
            <select
              className={`${selectCls} mt-1`}
              value={form.who_pays}
              onChange={(e) => set("who_pays", e.target.value as WhoPays)}
            >
              {WHO_PAYS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Status
            <select
              className={`${selectCls} mt-1`}
              value={form.status}
              onChange={(e) => set("status", e.target.value as TicketStatus)}
            >
              {TICKET_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Reported on
            <Input
              className="mt-1"
              type="date"
              value={form.opened_on}
              onChange={(e) => set("opened_on", e.target.value)}
            />
          </label>
          {closed && (
            <label className="text-sm">
              Closed on (today if left empty)
              <Input
                className="mt-1"
                type="date"
                value={form.closed_on}
                onChange={(e) => set("closed_on", e.target.value)}
              />
            </label>
          )}
        </div>
        {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setForm(null)}>
            Cancel
          </Button>
          <Button
            disabled={busy || Boolean(problem)}
            onClick={async () => {
              setBusy(true);
              const ok = await run(() =>
                save({
                  data: {
                    id: form.id,
                    unit_id: form.unit_id,
                    title: form.title,
                    description: form.description,
                    reported_by: form.reported_by,
                    priority: form.priority,
                    status: form.status,
                    contractor_name: form.contractor_name,
                    contractor_phone: form.contractor_phone,
                    cost_aed: num(form.cost_aed),
                    who_pays: form.who_pays,
                    opened_on: form.opened_on,
                    closed_on: closed && form.closed_on ? form.closed_on : null,
                  },
                }),
              );
              setBusy(false);
              if (ok) setForm(null);
            }}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- statements ----------

function StatementsTab({ data }: { data: Data }) {
  const landlords = data.owners.filter((o) => data.units.some((u) => u.owner_id === o.id));
  const [ownerId, setOwnerId] = useState(landlords[0]?.id ?? "");
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const period = monthPeriod(month);
  const owner = landlords.find((o) => o.id === ownerId);
  const statement =
    owner && period
      ? ownerStatement({
          units: data.units.filter((u) => u.owner_id === owner.id),
          leases: data.leases,
          cheques: data.cheques,
          tickets: data.tickets,
          from: period.from,
          to: period.to,
        })
      : null;

  if (!landlords.length)
    return <p className={emptyCls}>Add a managed unit first; statements are per landlord.</p>;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,20rem)_12rem_auto] sm:items-end">
        <label className="text-sm">
          Landlord
          <select
            className={`${selectCls} mt-1`}
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            {landlords.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Month
          <Input
            className="mt-1 h-9"
            type="month"
            placeholder="2026-11"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        {owner && period && (
          <Button asChild size="sm" variant="outline">
            <Link to="/managed/statement/$ownerId/$month" params={{ ownerId: owner.id, month }}>
              <Printer className="size-4" />
              Open printable draft
            </Link>
          </Button>
        )}
      </div>

      {!statement || !period ? (
        <p className={emptyCls}>Pick a landlord and a month (for example 2026-11).</p>
      ) : (
        <div className={cardCls}>
          <h2 className="font-semibold">
            Draft statement · {owner?.name} · {period.label}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Rent cleared in the month, less the management fee and finished maintenance the landlord
            pays for. Built from the records on this page; not an accounting ledger. Nothing is sent
            to the landlord.
          </p>
          <ul className="space-y-2 md:hidden">
            {statement.lines.map((l) => (
              <li key={l.unitId} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{l.unitLabel}</p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Rent cleared</span>
                  {aed(l.rentCleared)}
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Fee {l.feePercent}%</span>−{aed(l.fee)}
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Maintenance</span>−{aed(l.maintenance)}
                </p>
                <p className="flex justify-between font-medium">
                  <span>Net to landlord</span>
                  {aed(l.net)}
                </p>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-border text-start text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 text-start font-medium">Unit</th>
                <th className="py-2 text-end font-medium">Rent cleared</th>
                <th className="py-2 text-end font-medium">Management fee</th>
                <th className="py-2 text-end font-medium">Maintenance</th>
                <th className="py-2 text-end font-medium">Net to landlord</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.map((l) => (
                <tr key={l.unitId} className="border-b border-border">
                  <td className="py-2">{l.unitLabel}</td>
                  <td className="py-2 text-end">{aed(l.rentCleared)}</td>
                  <td className="py-2 text-end">
                    {aed(l.fee)} <span className="text-muted-foreground">({l.feePercent}%)</span>
                  </td>
                  <td className="py-2 text-end">{aed(l.maintenance)}</td>
                  <td className="py-2 text-end font-medium">{aed(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Total label="Rent cleared" value={aed(statement.totals.rentCleared)} />
            <Total label="Management fee" value={`−${aed(statement.totals.fee)}`} />
            <Total label="Maintenance" value={`−${aed(statement.totals.maintenance)}`} />
            <Total label="Net to landlord" value={aed(statement.totals.net)} strong />
          </dl>
        </div>
      )}
    </section>
  );
}

const Total = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex justify-between gap-2 sm:block">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={strong ? "text-lg font-semibold" : "font-medium"}>{value}</dd>
  </div>
);
