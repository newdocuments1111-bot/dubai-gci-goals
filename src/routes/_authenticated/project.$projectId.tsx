import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Download, Plus, Trash2 } from "lucide-react";
import {
  addUnits,
  getProject,
  logPriceListExport,
  markInstalment,
  savePlan,
  updateProject,
} from "@/lib/developer.functions";
import {
  DUE_RULES,
  DUE_RULE_LABEL,
  DUE_SOON_DAYS,
  EXAMPLE_PLAN,
  MAX_MILESTONES,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  UNIT_STATUSES,
  UNIT_STATUS_LABEL,
  aed,
  brokerSummary,
  buildSchedule,
  collectionTotals,
  dubaiToday,
  dueSoonInstalments,
  effectiveStatus,
  holdTimeLeft,
  instalmentOpenAed,
  isHoldActive,
  isSettled,
  longDate,
  overdueInstalments,
  parseUnitLines,
  planProblems,
  planTotalPercent,
  priceListCsv,
  priceListFileName,
  reminderMessage,
  unitCounts,
  type DueRule,
  type Milestone,
  type ProjectInput,
  type ProjectStatus,
  type UnitStatus,
} from "@/lib/developer";
import { StatusBadge, UnitDialog, type ProjectData } from "@/components/DeveloperUnitDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const projectQuery = (id: string) =>
  queryOptions({ queryKey: ["dev-project", id], queryFn: () => getProject({ data: id }) });

export const Route = createFileRoute("/_authenticated/project/$projectId")({
  head: () => ({
    meta: [{ title: "Project — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery(params.projectId)),
  component: ProjectPage,
});

const card = "rounded-xl border border-border bg-background p-4 shadow-xs";
const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

type Unit = ProjectData["units"][number];
type Hold = ProjectData["holds"][number];
type Sale = ProjectData["sales"][number];
type Instalment = ProjectData["instalments"][number];
type Row = { unit: Unit; status: UnitStatus; hold: Hold | null; sale: Sale | null };

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { data } = useSuspenseQuery(projectQuery(projectId));
  const client = useQueryClient();
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [editProject, setEditProject] = useState(false);
  // The clock moves on its own, so a hold that ends while the page is open stops showing as held.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = async () => {
    setNow(new Date());
    await client.invalidateQueries({ queryKey: ["dev-project", projectId] });
    void client.invalidateQueries({ queryKey: ["dev-projects"] });
  };

  const rows: Row[] = useMemo(() => {
    const holdByUnit = new Map(
      data.holds.filter((h) => isHoldActive(h, now)).map((h) => [h.unit_id, h]),
    );
    const saleByUnit = new Map(data.sales.map((s) => [s.unit_id, s]));
    return data.units.map((unit) => {
      const hold = holdByUnit.get(unit.id) ?? null;
      return {
        unit,
        hold,
        sale: saleByUnit.get(unit.id) ?? null,
        status: effectiveStatus(unit.status, hold, now),
      };
    });
  }, [data.units, data.holds, data.sales, now]);

  const counts = unitCounts(rows.map((r) => r.status));
  const today = dubaiToday(now);
  const totals = collectionTotals(data.instalments, today);
  const p = data.project;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                p.developer_name,
                p.community,
                PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status,
                p.handover_date ? `Handover ${longDate(p.handover_date)}` : "No handover date yet",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.notes && <p className="mt-1 max-w-2xl whitespace-pre-line text-sm">{p.notes}</p>}
          </div>
          {data.isOwner && (
            <Button variant="outline" onClick={() => setEditProject(true)}>
              Edit project
            </Button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
        <div className="rounded-xl bg-emerald-500/10 p-3">
          <dd className="text-xl font-semibold tabular-nums">{counts.free}</dd>
          <dt className="text-xs text-muted-foreground">Free</dt>
        </div>
        <div className="rounded-xl bg-amber-500/15 p-3">
          <dd className="text-xl font-semibold tabular-nums">{counts.held}</dd>
          <dt className="text-xs text-muted-foreground">Held</dt>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dd className="text-xl font-semibold tabular-nums">{counts.sold}</dd>
          <dt className="text-xs text-muted-foreground">Sold</dt>
        </div>
        <div className="col-span-3 grid grid-cols-3 gap-3">
          <div className={`${card} p-3`}>
            <dd className="text-sm font-semibold tabular-nums">{aed(totals.collectedAed)}</dd>
            <dt className="text-xs text-muted-foreground">Collected</dt>
          </div>
          <div className={`${card} p-3`}>
            <dd className="text-sm font-semibold tabular-nums">{aed(totals.outstandingAed)}</dd>
            <dt className="text-xs text-muted-foreground">Outstanding</dt>
          </div>
          <div className={`${card} p-3`}>
            <dd
              className={`text-sm font-semibold tabular-nums ${totals.overdueAed > 0 ? "text-destructive" : ""}`}
            >
              {aed(totals.overdueAed)}
            </dd>
            <dt className="text-xs text-muted-foreground">Overdue</dt>
          </div>
        </div>
      </dl>

      <Tabs defaultValue="units">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="plan">Payment plan</TabsTrigger>
          <TabsTrigger value="instalments">
            Instalments
            {totals.overdueAed > 0 && (
              <span className="ms-1.5 h-2 w-2 rounded-full bg-destructive" aria-label="overdue" />
            )}
          </TabsTrigger>
          <TabsTrigger value="brokers">Brokers</TabsTrigger>
        </TabsList>
        <TabsContent value="units" className="mt-4">
          <UnitsTab data={data} rows={rows} now={now} onOpen={setOpenUnit} refresh={refresh} />
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <PlanTab data={data} refresh={refresh} />
        </TabsContent>
        <TabsContent value="instalments" className="mt-4">
          <InstalmentsTab data={data} today={today} refresh={refresh} />
        </TabsContent>
        <TabsContent value="brokers" className="mt-4">
          <BrokersTab data={data} now={now} />
        </TabsContent>
      </Tabs>

      {openUnit && (
        <UnitDialog
          key={openUnit}
          data={data}
          unitId={openUnit}
          now={now}
          onClose={() => setOpenUnit(null)}
          refresh={refresh}
        />
      )}
      {editProject && (
        <ProjectDialog data={data} onClose={() => setEditProject(false)} refresh={refresh} />
      )}
    </main>
  );
}

// ---------- Units ----------

function statusLine(row: Row, now: Date) {
  if (row.status === "held" && row.hold)
    return `For ${row.hold.client_name} · ${holdTimeLeft(row.hold.expires_at, now)}`;
  if (row.status === "sold" && row.sale) return `To ${row.sale.buyer_name}`;
  return "";
}

function UnitsTab({
  data,
  rows,
  now,
  onOpen,
  refresh,
}: {
  data: ProjectData;
  rows: Row[];
  now: Date;
  onOpen: (id: string) => void;
  refresh: () => Promise<void>;
}) {
  const logExport = useServerFn(logPriceListExport);
  const [status, setStatus] = useState<"" | UnitStatus>("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [paste, setPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const types = [...new Set(rows.map((r) => r.unit.unit_type).filter(Boolean))].sort();
  const q = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!type || r.unit.unit_type === type) &&
      (!q ||
        r.unit.unit_number.toLowerCase().includes(q) ||
        (r.hold?.client_name ?? "").toLowerCase().includes(q) ||
        (r.sale?.buyer_name ?? "").toLowerCase().includes(q)),
  );
  const free = rows.filter((r) => r.status === "free");

  const download = async () => {
    setBusy(true);
    setNote(null);
    try {
      // The activity log is written first; if that fails, no file is made.
      await logExport({ data: { projectId: data.project.id, count: free.length } });
      const csv = priceListCsv(
        free.map(({ unit }) => ({
          unit_number: unit.unit_number,
          unit_type: unit.unit_type,
          bedrooms: unit.bedrooms,
          size_sqft: Number(unit.size_sqft),
          floor: unit.floor,
          view: unit.view,
          price_aed: Number(unit.price_aed),
        })),
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = priceListFileName(data.project.name, dubaiToday(now));
      a.click();
      URL.revokeObjectURL(url);
      setNote({ ok: true, text: `Price list downloaded: ${free.length} free units.` });
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="sr-only">Status</span>
          <select
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | UnitStatus)}
          >
            <option value="">All statuses</option>
            {UNIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {UNIT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Type</span>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <Input
          className="h-9 w-44"
          placeholder="Unit or client"
          aria-label="Search by unit number or client"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ms-auto flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !free.length} onClick={download}>
            <Download className="me-1 h-4 w-4" />
            Price list (CSV)
          </Button>
          {data.isOwner && (
            <>
              <Button variant="outline" onClick={() => setPaste(!paste)}>
                Paste units
              </Button>
              <Button onClick={() => onOpen("new")}>
                <Plus className="me-1 h-4 w-4" />
                Add unit
              </Button>
            </>
          )}
        </div>
      </div>
      {note && (
        <p
          role={note.ok ? "status" : "alert"}
          className={`text-sm ${note.ok ? "text-primary" : "text-destructive"}`}
        >
          {note.text}
        </p>
      )}
      {paste && data.isOwner && (
        <PasteUnits projectId={data.project.id} refresh={refresh} onDone={() => setPaste(false)} />
      )}

      {!rows.length ? (
        <p className={`${card} text-sm`}>
          No units yet.{" "}
          {data.isOwner ? "Add them one at a time or paste them from a spreadsheet." : ""}
        </p>
      ) : !shown.length ? (
        <p className={`${card} text-sm`}>No units match these filters.</p>
      ) : (
        <>
          {/* Phones: one card per unit. */}
          <ul className="space-y-2 md:hidden">
            {shown.map((r) => (
              <li key={r.unit.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.unit.id)}
                  className={`${card} block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Unit {r.unit.unit_number}</span>
                    <StatusBadge status={r.status} />
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {[
                      r.unit.unit_type,
                      Number(r.unit.size_sqft) > 0
                        ? `${Number(r.unit.size_sqft).toLocaleString("en-US")} sq ft`
                        : "",
                      r.unit.floor ? `Floor ${r.unit.floor}` : "",
                      r.unit.view,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-medium tabular-nums">
                      {aed(Number(r.unit.price_aed))}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {statusLine(r, now)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Wider screens: a table. */}
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">Unit</th>
                  <th className="px-3 py-2 text-start font-medium">Type</th>
                  <th className="px-3 py-2 text-end font-medium">Beds</th>
                  <th className="px-3 py-2 text-end font-medium">Size (sq ft)</th>
                  <th className="px-3 py-2 text-start font-medium">Floor</th>
                  <th className="px-3 py-2 text-start font-medium">View</th>
                  <th className="px-3 py-2 text-end font-medium">Price</th>
                  <th className="px-3 py-2 text-start font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {shown.map((r) => (
                  <tr key={r.unit.id}>
                    <td className="px-3 py-2 font-medium">{r.unit.unit_number}</td>
                    <td className="px-3 py-2">{r.unit.unit_type}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.unit.bedrooms}</td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {Number(r.unit.size_sqft) > 0
                        ? Number(r.unit.size_sqft).toLocaleString("en-US")
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{r.unit.floor}</td>
                    <td className="px-3 py-2">{r.unit.view}</td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {aed(Number(r.unit.price_aed))}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                      <span className="ms-2 text-xs text-muted-foreground">
                        {statusLine(r, now)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Button size="sm" variant="outline" onClick={() => onOpen(r.unit.id)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {shown.length} of {rows.length} units. The price list has the {free.length} free
            units only.
          </p>
        </>
      )}
    </section>
  );
}

function PasteUnits({
  projectId,
  refresh,
  onDone,
}: {
  projectId: string;
  refresh: () => Promise<void>;
  onDone: () => void;
}) {
  const add = useServerFn(addUnits);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const parsed = useMemo(() => parseUnitLines(text), [text]);

  const submit = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await add({ data: { projectId, units: parsed.units } });
      await refresh();
      setText("");
      setNote({
        ok: true,
        text: `${result.added} added${result.skipped ? `, ${result.skipped} already existed and were left as they are` : ""}.`,
      });
      if (!result.skipped && !parsed.problems.length) onDone();
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${card} space-y-3`}>
      <label className="block text-sm">
        One unit per line: unit, type, bedrooms, size, floor, view, price. Copy the seven columns
        straight from a spreadsheet, or separate them with commas (then write the price without
        commas).
        <Textarea
          className="mt-1 font-mono text-xs"
          rows={6}
          placeholder={"101, 1BR, 1, 750, 1, Pool, 950000\n102, 2BR, 2, 1100, 1, Sea, 1450000"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {parsed.problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 ps-5 text-sm text-destructive">
          {parsed.problems.slice(0, 8).map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
          {parsed.problems.length > 8 && <li>…and {parsed.problems.length - 8} more lines.</li>}
        </ul>
      )}
      {note && (
        <p
          role={note.ok ? "status" : "alert"}
          className={`text-sm ${note.ok ? "text-primary" : "text-destructive"}`}
        >
          {note.text}
        </p>
      )}
      <Button disabled={busy || !parsed.units.length} onClick={submit}>
        {busy
          ? "Adding…"
          : `Add ${parsed.units.length} ${parsed.units.length === 1 ? "unit" : "units"}`}
      </Button>
    </div>
  );
}

// ---------- Payment plan ----------

function PlanTab({ data, refresh }: { data: ProjectData; refresh: () => Promise<void> }) {
  const save = useServerFn(savePlan);
  const [plan, setPlan] = useState<Milestone[]>(data.plan);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const problems = planProblems(plan);
  const total = planTotalPercent(plan);
  const today = dubaiToday();
  const example = problems.length
    ? []
    : buildSchedule(plan, {
        priceAed: 1_000_000,
        saleDate: today,
        handoverDate: data.project.handover_date,
      });
  const setRow = (i: number, patch: Partial<Milestone>) => {
    setPlan(plan.map((m, k) => (k === i ? { ...m, ...patch } : m)));
    setNote(null);
  };

  const submit = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await save({ data: { projectId: data.project.id, plan } });
      if (result.error) setNote({ ok: false, text: result.error });
      else {
        await refresh();
        setNote({ ok: true, text: "Payment plan saved." });
      }
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!data.isOwner)
    return (
      <section className={`${card} space-y-2 text-sm`}>
        <h2 className="text-lg font-semibold">Payment plan</h2>
        {!data.plan.length ? (
          <p>The owner has not set a payment plan for this project yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.plan.map((m, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>{m.label}</span>
                <span className="text-muted-foreground">
                  {m.percent}% ·{" "}
                  {m.rule === "fixed_date"
                    ? longDate(m.date)
                    : m.rule === "on_handover"
                      ? "on handover"
                      : m.days === 0
                        ? "on booking"
                        : `${m.days} days after booking`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );

  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold">Payment plan</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The payments every buyer in this project makes. When a unit is marked sold, its schedule
          of instalments is made from this plan. Changing the plan later does not change schedules
          of sales already recorded.
        </p>
      </div>
      {!plan.length && (
        <Button variant="outline" onClick={() => setPlan(EXAMPLE_PLAN)}>
          Start from an example (20 / 30 / 50)
        </Button>
      )}
      <div className="space-y-3">
        {plan.map((m, i) => (
          <div
            key={i}
            className="grid items-end gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_90px_170px_150px_auto] sm:border-0 sm:p-0"
          >
            <label className="text-sm">
              Payment {i + 1}
              <Input
                className="mt-1 h-9"
                maxLength={80}
                placeholder="e.g. Booking"
                value={m.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Percent
              <Input
                className="mt-1 h-9"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={Number.isFinite(m.percent) ? m.percent : ""}
                onChange={(e) =>
                  setRow(i, { percent: e.target.value === "" ? 0 : Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Due
              <select
                className={`${selectClass} mt-1 w-full`}
                value={m.rule}
                onChange={(e) => setRow(i, { rule: e.target.value as DueRule })}
              >
                {DUE_RULES.map((r) => (
                  <option key={r} value={r}>
                    {DUE_RULE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            {m.rule === "days_after_booking" ? (
              <label className="text-sm">
                Days
                <Input
                  className="mt-1 h-9"
                  type="number"
                  min={0}
                  max={3650}
                  value={m.days}
                  onChange={(e) =>
                    setRow(i, {
                      days: Math.max(0, Math.min(3650, Math.round(Number(e.target.value)) || 0)),
                    })
                  }
                />
              </label>
            ) : m.rule === "fixed_date" ? (
              <label className="text-sm">
                Date
                <Input
                  className="mt-1 h-9"
                  type="date"
                  value={m.date}
                  onChange={(e) => setRow(i, { date: e.target.value })}
                />
              </label>
            ) : (
              <p className="pb-2 text-xs text-muted-foreground">
                {data.project.handover_date
                  ? longDate(data.project.handover_date)
                  : "No handover date set on the project yet"}
              </p>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove payment ${i + 1}`}
              onClick={() => {
                setPlan(plan.filter((_, k) => k !== i));
                setNote(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={plan.length >= MAX_MILESTONES}
          onClick={() => {
            setPlan([
              ...plan,
              {
                label: "",
                percent: Math.max(0, Math.round((100 - total) * 100) / 100),
                rule: "days_after_booking",
                days: 0,
                date: "",
              },
            ]);
            setNote(null);
          }}
        >
          <Plus className="me-1 h-4 w-4" />
          Add payment
        </Button>
        <p className={`text-sm ${total === 100 ? "text-muted-foreground" : "text-destructive"}`}>
          Total: {total}%
        </p>
      </div>
      {plan.length > 0 && problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 ps-5 text-sm text-destructive">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {example.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Example: a unit sold today for AED 1,000,000</p>
          <ul className="mt-1 divide-y divide-border rounded-md border border-border">
            {example.map((l) => (
              <li key={l.position} className="flex justify-between gap-3 px-3 py-1.5">
                <span>
                  {l.label}
                  <span className="ms-2 text-xs text-muted-foreground">
                    {l.due_date ? longDate(l.due_date) : "on handover (no date set)"}
                  </span>
                </span>
                <span className="tabular-nums">{aed(l.amount_aed)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && (
        <p
          role={note.ok ? "status" : "alert"}
          className={`text-sm ${note.ok ? "text-primary" : "text-destructive"}`}
        >
          {note.text}
        </p>
      )}
      <Button disabled={busy || problems.length > 0} onClick={submit}>
        {busy ? "Saving…" : "Save payment plan"}
      </Button>
    </section>
  );
}

// ---------- Instalments ----------

function InstalmentsTab({
  data,
  today,
  refresh,
}: {
  data: ProjectData;
  today: string;
  refresh: () => Promise<void>;
}) {
  const mark = useServerFn(markInstalment);
  const [paying, setPaying] = useState<Instalment | null>(null);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);

  const overdue = overdueInstalments(data.instalments, today);
  const soon = dueSoonInstalments(data.instalments, today);
  const listed = new Set([...overdue, ...soon].map((i) => i.id));
  const rest = data.instalments.filter((i) => !listed.has(i.id));
  const totals = collectionTotals(data.instalments, today);
  const saleOf = (i: Instalment) => data.sales.find((s) => s.id === i.sale_id);
  const unitOf = (i: Instalment) => data.units.find((u) => u.id === saleOf(i)?.unit_id);

  const reminder = (i: Instalment) =>
    reminderMessage({
      buyerName: saleOf(i)?.buyer_name ?? "",
      projectName: data.project.name,
      unitNumber: unitOf(i)?.unit_number ?? "",
      label: i.label,
      openAed: instalmentOpenAed(i),
      dueDate: i.due_date,
      today,
      developerName: data.project.developer_name,
    });
  const copy = async (i: Instalment) => {
    const text = reminder(i);
    setDraft({ id: i.id, text });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i.id);
    } catch {
      // No clipboard access: the draft is shown below the row to copy by hand.
      setCopied("");
    }
  };

  const run = async (fn: () => Promise<{ error: string }>) => {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      if (result.error) setError(result.error);
      else {
        await refresh();
        setPaying(null);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const list = (title: string, items: Instalment[], empty: string, tone = "") => (
    <div className={card}>
      <h3 className={`font-semibold ${tone}`}>
        {title} ({items.length})
      </h3>
      {!items.length ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {items.map((i) => {
            const sale = saleOf(i);
            const settled = isSettled(i);
            const received = Number(i.paid_amount ?? 0);
            return (
              <li key={i.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      Unit {unitOf(i)?.unit_number ?? "?"} · {i.label}
                    </p>
                    <p className="text-muted-foreground">
                      {sale?.buyer_name}
                      {sale?.buyer_phone ? ` · ${sale.buyer_phone}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {i.due_date ? `Due ${longDate(i.due_date)}` : "Due on handover (no date set)"}
                      {settled && i.paid_at
                        ? ` · Paid ${longDate(dubaiToday(new Date(i.paid_at)))}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-medium tabular-nums">{aed(Number(i.amount_aed))}</p>
                    {!settled && received > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {aed(received)} received · {aed(instalmentOpenAed(i))} open
                      </p>
                    )}
                    {settled && <p className="text-xs text-muted-foreground">Paid</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!settled && (
                    <Button size="sm" variant="outline" onClick={() => copy(i)}>
                      <Copy className="me-1 h-3.5 w-3.5" />
                      {copied === i.id ? "Copied" : "Copy reminder"}
                    </Button>
                  )}
                  {data.isOwner && !settled && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPaying(i);
                        setAmount(String(Number(i.amount_aed)));
                        setPaidOn(today);
                        setError("");
                      }}
                    >
                      Mark paid
                    </Button>
                  )}
                  {data.isOwner && received > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          mark({ data: { instalmentId: i.id, paidAmount: null, paidOn: today } }),
                        )
                      }
                    >
                      Undo payment
                    </Button>
                  )}
                </div>
                {draft?.id === i.id && (
                  <p className="mt-2 whitespace-pre-line rounded-md bg-secondary p-3 text-sm">
                    {draft.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <section className="space-y-4">
      <p className="rounded-md bg-secondary px-3 py-2 text-sm">
        Payment reminders are not sent automatically in this version. "Copy reminder" drafts a
        message for you to send yourself. Payments show as paid only when{" "}
        {data.isOwner ? "you mark" : "the owner marks"} them here.
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Sold (scheduled)", totals.soldAed, ""],
            ["Collected", totals.collectedAed, ""],
            ["Outstanding", totals.outstandingAed, ""],
            [
              `Due in ${DUE_SOON_DAYS} days`,
              totals.dueSoonAed,
              totals.overdueAed > 0 ? `Overdue ${aed(totals.overdueAed)}` : "",
            ],
          ] as const
        ).map(([label, value, extra]) => (
          <div key={label} className={card}>
            <dd className="font-semibold tabular-nums">{aed(value)}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            {extra && <p className="text-xs text-destructive">{extra}</p>}
          </div>
        ))}
      </dl>
      {error && !paying && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!data.instalments.length ? (
        <p className={`${card} text-sm`}>
          No instalments yet. They are created when a unit is marked sold.
        </p>
      ) : (
        <>
          {list(
            "Overdue",
            overdue,
            "Nothing is overdue.",
            overdue.length ? "text-destructive" : "",
          )}
          {list(
            `Due in the next ${DUE_SOON_DAYS} days`,
            soon,
            `Nothing is due in the next ${DUE_SOON_DAYS} days.`,
          )}
          {list("Later, undated and paid", rest, "Nothing else.")}
        </>
      )}

      {paying && (
        <Dialog open onOpenChange={(o) => !o && setPaying(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogTitle>Mark paid</DialogTitle>
            <DialogDescription>
              Unit {unitOf(paying)?.unit_number} · {paying.label} · {aed(Number(paying.amount_aed))}
              . Enter the total received for this instalment so far.
            </DialogDescription>
            <label className="text-sm">
              Amount received (AED)
              <Input
                className="mt-1 h-9"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Received on
              <Input
                className="mt-1 h-9"
                type="date"
                max={today}
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              disabled={busy || !(Number(amount.replace(/,/g, "")) > 0) || !paidOn}
              onClick={() =>
                run(() =>
                  mark({
                    data: {
                      instalmentId: paying.id,
                      paidAmount: Number(amount.replace(/,/g, "")),
                      paidOn,
                    },
                  }),
                )
              }
            >
              {busy ? "Saving…" : "Save payment"}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

// ---------- Brokers ----------

function BrokersTab({ data, now }: { data: ProjectData; now: Date }) {
  const lines = brokerSummary(data.sales, data.holds, now);
  const totalCommission =
    lines.reduce((sum, l) => sum + Math.round(l.commissionAed * 100), 0) / 100;
  return (
    <section className={`${card} space-y-3`}>
      <div>
        <h2 className="text-lg font-semibold">Outside brokers</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Units and commission per outside broker in this project, from the broker name typed on
          each hold and sale (the same name typed differently shows as two brokers). Commission is
          the percent on each sale times its price; this page does not record whether it was paid.
          Outside brokers cannot log in.
        </p>
      </div>
      {!lines.length ? (
        <p className="text-sm">No hold or sale in this project names an outside broker yet.</p>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {lines.map((l) => (
              <li key={l.name} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{l.name}</p>
                {l.agency && <p className="text-muted-foreground">{l.agency}</p>}
                <p className="mt-1">
                  {l.unitsSold} sold · {aed(l.salesAed)} · commission {aed(l.commissionAed)}
                </p>
                <p className="text-muted-foreground">{l.activeHolds} on hold now</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 text-start font-medium">Broker</th>
                  <th className="py-2 text-start font-medium">Agency</th>
                  <th className="py-2 text-end font-medium">Units sold</th>
                  <th className="py-2 text-end font-medium">Sales</th>
                  <th className="py-2 text-end font-medium">Commission</th>
                  <th className="py-2 text-end font-medium">On hold now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((l) => (
                  <tr key={l.name}>
                    <td className="py-2 font-medium">{l.name}</td>
                    <td className="py-2">{l.agency || "—"}</td>
                    <td className="py-2 text-end tabular-nums">{l.unitsSold}</td>
                    <td className="py-2 text-end tabular-nums">{aed(l.salesAed)}</td>
                    <td className="py-2 text-end tabular-nums">{aed(l.commissionAed)}</td>
                    <td className="py-2 text-end tabular-nums">{l.activeHolds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm font-medium">Total commission: {aed(totalCommission)}</p>
        </>
      )}
    </section>
  );
}

// ---------- Project details ----------

function ProjectDialog({
  data,
  onClose,
  refresh,
}: {
  data: ProjectData;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const update = useServerFn(updateProject);
  const p = data.project;
  const [form, setForm] = useState<ProjectInput>({
    name: p.name,
    developer_name: p.developer_name,
    community: p.community,
    handover_date: p.handover_date ?? "",
    status: (PROJECT_STATUSES as readonly string[]).includes(p.status)
      ? (p.status as ProjectStatus)
      : "selling",
    notes: p.notes,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<ProjectInput>) => setForm({ ...form, ...patch });

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await update({ data: { ...form, name: form.name.trim(), projectId: p.id } });
      await refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>Edit project</DialogTitle>
        <DialogDescription>
          A new handover date applies to sales recorded from now on. Schedules already created keep
          their dates.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Project name
            <Input
              className="mt-1 h-9"
              maxLength={120}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Developer name
            <Input
              className="mt-1 h-9"
              maxLength={120}
              value={form.developer_name}
              onChange={(e) => set({ developer_name: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Community
            <Input
              className="mt-1 h-9"
              maxLength={120}
              value={form.community}
              onChange={(e) => set({ community: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Handover date
            <Input
              className="mt-1 h-9"
              type="date"
              value={form.handover_date}
              onChange={(e) => set({ handover_date: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Status
            <select
              className={`${selectClass} mt-1 w-full`}
              value={form.status}
              onChange={(e) => set({ status: e.target.value as ProjectStatus })}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Notes (only your team sees them)
            <Textarea
              className="mt-1"
              rows={3}
              maxLength={2000}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button disabled={busy || !form.name.trim()} onClick={submit}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
