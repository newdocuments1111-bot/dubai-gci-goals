import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Printer, Upload } from "lucide-react";
import {
  deleteHome,
  getHolidayHomes,
  importBookings,
  saveBooking,
  saveHome,
  saveTask,
  setBookingStatus,
  setGuestIdReceived,
  setTaskStatus,
} from "@/lib/hh.functions";
import {
  BOOKING_STATUSES,
  CHECK_IN_TIME,
  CHECK_OUT_TIME,
  MAX_IMPORT_EVENTS,
  SOURCES,
  TASK_KINDS,
  addDays,
  aed,
  calendarRow,
  checkInMessage,
  dubaiDay,
  dubaiTime,
  findConflicts,
  formatDay,
  isDay,
  labelOf,
  monthOf,
  nights,
  occupancy,
  ownerPayout,
  parseIcs,
  permitState,
  planImport,
  shiftMonth,
  todayBoard,
  type BookingSource,
  type BookingStatus,
  type DayCell,
  type IcsResult,
  type PermitState,
  type TaskKind,
} from "@/lib/hh";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const hhQuery = queryOptions({ queryKey: ["holiday-homes"], queryFn: () => getHolidayHomes() });

export const Route = createFileRoute("/_authenticated/holiday-homes")({
  head: () => ({
    meta: [{ title: "Holiday homes — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(hhQuery),
  component: HolidayHomesPage,
});

type Data = Awaited<ReturnType<typeof getHolidayHomes>>;
type Home = Data["homes"][number];
type Booking = Data["bookings"][number];
type Task = Data["tasks"][number];
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

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  confirmed: "good",
  checked_in: "soon",
  checked_out: "ok",
  cancelled: "late",
};
const PERMIT_TONE: Record<PermitState["tone"], keyof typeof TONE> = {
  ok: "ok",
  soon: "soon",
  late: "late",
  missing: "soon",
};
const homeTitle = (h: Home | undefined) => h?.name ?? "Home";
const homePlace = (h: Home) => [h.building, h.community].filter(Boolean).join(", ");

function HolidayHomesPage() {
  const { data } = useSuspenseQuery(hhQuery);
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("calendar");
  const [homeForm, setHomeForm] = useState<HomeForm | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null);
  const [importing, setImporting] = useState(false);

  const run: Run = async (fn) => {
    setError("");
    try {
      const result = await fn();
      const message =
        result && typeof result === "object" && "error" in result ? String(result.error) : "";
      const tasksMissing =
        !message && result && typeof result === "object" && "tasks" in result && !result.tasks;
      await client.invalidateQueries({ queryKey: ["holiday-homes"] });
      if (message) setError(message);
      else if (tasksMissing)
        setError(
          "Saved, but the check-in and cleaning tasks could not be created. Add them by hand on the Today tab.",
        );
      return !message;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    }
  };

  const homeById = useMemo(() => new Map(data.homes.map((h) => [h.id, h])), [data.homes]);
  const board = todayBoard(data.bookings, data.tasks, data.today);
  const todayCount =
    board.arrivals.length +
    board.departures.length +
    board.tasksToday.filter((t) => t.status === "todo").length +
    board.overdue.length;
  const permitWarnings = data.homes.filter(
    (h) => h.active && permitState(h, data.today).tone !== "ok",
  ).length;
  const activeHomes = data.homes.filter((h) => h.active);
  const newBooking = (homeId?: string, checkIn?: string) => {
    const home = (homeId ? homeById.get(homeId) : undefined) ?? activeHomes[0] ?? data.homes[0];
    if (home) setBookingForm(emptyBooking(home, checkIn ?? data.today));
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Holiday homes</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Short-stay homes you manage for owners: bookings, a calendar, turnover tasks and a draft
          payout for each owner. This version does not sync with Airbnb or Booking.com
          automatically: you type bookings in or import a calendar file you export from the booking
          site. It does not take payments, does not send messages (check-in messages are drafts you
          copy and send yourself) and does not file guest registrations with any authority.
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

      {!data.homes.length ? (
        <div className={emptyCls}>
          <p>No holiday homes yet. Add the first home you manage to start taking bookings.</p>
          <Button size="sm" className="mt-3" onClick={() => setHomeForm(emptyHome())}>
            <Plus className="size-4" />
            Add home
          </Button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="today">Today{todayCount > 0 ? ` (${todayCount})` : ""}</TabsTrigger>
            <TabsTrigger value="homes">
              Homes ({data.homes.length}){permitWarnings > 0 ? " !" : ""}
            </TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <CalendarTab
              data={data}
              editBooking={(b) => setBookingForm(bookingToForm(b))}
              newBooking={newBooking}
            />
          </TabsContent>
          <TabsContent value="bookings" className="mt-4">
            <BookingsTab
              data={data}
              run={run}
              homeById={homeById}
              editBooking={(b) => setBookingForm(bookingToForm(b))}
              newBooking={() => newBooking()}
              openImport={() => setImporting(true)}
            />
          </TabsContent>
          <TabsContent value="today" className="mt-4">
            <TodayTab
              data={data}
              run={run}
              homeById={homeById}
              editTask={(t) => setTaskForm(taskToForm(t))}
              newTask={() => {
                const home = activeHomes[0] ?? data.homes[0];
                if (home) setTaskForm(emptyTask(home.id, data.today));
              }}
            />
          </TabsContent>
          <TabsContent value="homes" className="mt-4">
            <HomesTab data={data} edit={setHomeForm} />
          </TabsContent>
          <TabsContent value="payouts" className="mt-4">
            <PayoutsTab data={data} />
          </TabsContent>
        </Tabs>
      )}

      {homeForm && <HomeDialog data={data} form={homeForm} setForm={setHomeForm} run={run} />}
      {bookingForm && (
        <BookingDialog data={data} form={bookingForm} setForm={setBookingForm} run={run} />
      )}
      {taskForm && <TaskDialog data={data} form={taskForm} setForm={setTaskForm} run={run} />}
      {importing && (
        <ImportDialog
          data={data}
          close={() => setImporting(false)}
          reload={() => client.invalidateQueries({ queryKey: ["holiday-homes"] })}
        />
      )}
    </main>
  );
}

// ---------- shared ----------

/** Copies a drafted message. Nothing is sent; if the browser refuses, the text is shown to copy by hand. */
function CopyDraft({ text, label = "Copy message" }: { text: string; label?: string }) {
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
          <Textarea readOnly rows={8} value={text} className="text-sm" />
        </div>
      )}
    </>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <p className="min-w-0 text-sm">
    <span className="text-muted-foreground md:hidden">{label}: </span>
    {children}
  </p>
);

function MonthPicker({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const valid = !!monthOf(month);
  return (
    <div className="flex items-end gap-1">
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label="Previous month"
        disabled={!valid}
        onClick={() => setMonth(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
      </Button>
      <label className="text-sm">
        <span className="sr-only">Month</span>
        <Input
          className="h-9 w-40"
          type="month"
          placeholder="2026-11"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label="Next month"
        disabled={!valid}
        onClick={() => setMonth(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}

// ---------- calendar ----------

const BAR: Record<string, string> = {
  confirmed: "bg-primary/20 hover:bg-primary/30",
  checked_in: "bg-primary/40 hover:bg-primary/50",
  checked_out: "bg-muted hover:bg-muted/70 text-muted-foreground",
};
const weekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "narrow" });
const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

/** Joins the nights of one stay into a single bar; free nights stay one square each. */
function segments(cells: DayCell<Booking>[]) {
  const out: { cell: DayCell<Booking>; span: number }[] = [];
  for (const cell of cells) {
    const last = out[out.length - 1];
    if (cell.booking && last?.cell.booking?.id === cell.booking.id) last.span++;
    else out.push({ cell, span: 1 });
  }
  return out;
}

function CalendarTab({
  data,
  editBooking,
  newBooking,
}: {
  data: Data;
  editBooking: (b: Booking) => void;
  newBooking: (homeId: string, checkIn: string) => void;
}) {
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const m = monthOf(month);
  const byHome = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of data.bookings) map.set(b.home_id, [...(map.get(b.home_id) ?? []), b]);
    return map;
  }, [data.bookings]);

  if (!m)
    return (
      <section className="space-y-3">
        <MonthPicker month={month} setMonth={setMonth} />
        <p className={emptyCls}>Pick a month (for example 2026-11).</p>
      </section>
    );

  const rows = data.homes
    .map((home) => {
      const bookings = byHome.get(home.id) ?? [];
      const cells = calendarRow(bookings, m);
      return { home, cells, occ: occupancy(bookings, m) };
    })
    // A home that is no longer active still shows in months where it has stays.
    .filter((r) => r.home.active || r.occ.bookedNights > 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <MonthPicker month={month} setMonth={setMonth} />
        <h2 className="text-lg font-semibold">{m.label}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Each square is one night. A bar covers the nights a guest sleeps in the home; the guest
        leaves on the morning after the last square of the bar, so a new guest can arrive that same
        day. Empty squares are free nights: press one to add a booking.
      </p>
      {!rows.length ? (
        <p className={emptyCls}>No active homes. Mark a home as active on the Homes tab.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 min-w-32 max-w-40 border-b border-e border-border bg-background px-2 py-1 text-start font-medium sm:min-w-44">
                  Home
                </th>
                {m.days.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className={`w-8 min-w-8 border-b border-border px-0 py-1 text-center font-normal ${
                      d === data.today
                        ? "bg-primary text-primary-foreground"
                        : isWeekend(d)
                          ? "bg-muted/60"
                          : ""
                    }`}
                  >
                    <span className="block text-[10px] leading-none opacity-70">{weekday(d)}</span>
                    <span className="block font-medium">{Number(d.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ home, cells, occ }) => (
                <tr key={home.id}>
                  <th
                    scope="row"
                    className="sticky start-0 z-10 min-w-32 max-w-40 border-b border-e border-border bg-background px-2 py-1 text-start font-normal sm:min-w-44"
                  >
                    <span className="block truncate text-sm font-medium">{home.name}</span>
                    <span className="block truncate text-muted-foreground">
                      {occ.nightsInMonth - occ.bookedNights} free · {occ.percent}% booked
                    </span>
                  </th>
                  {segments(cells).map(({ cell, span }) =>
                    cell.booking ? (
                      <td
                        key={cell.day}
                        colSpan={span}
                        className="max-w-0 border-b border-border p-0.5"
                      >
                        <button
                          type="button"
                          title={`${cell.booking.guest_name}: ${formatDay(cell.booking.check_in)} to ${formatDay(cell.booking.check_out)}`}
                          onClick={() => cell.booking && editBooking(cell.booking)}
                          className={`block h-8 w-full truncate rounded px-1 text-start ${
                            BAR[cell.booking.status] ?? BAR["confirmed"]
                          }`}
                        >
                          {cell.booking.guest_name || "Guest"}
                        </button>
                      </td>
                    ) : (
                      <td
                        key={cell.day}
                        className={`border-b border-border p-0.5 ${isWeekend(cell.day) ? "bg-muted/40" : ""}`}
                      >
                        <button
                          type="button"
                          aria-label={`Free night ${formatDay(cell.day)} at ${home.name}: add a booking`}
                          onClick={() => newBooking(home.id, cell.day)}
                          className="block h-8 w-full rounded border border-dashed border-transparent hover:border-border hover:bg-muted"
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="me-1 inline-block size-3 rounded bg-primary/20 align-middle" />
          Confirmed
        </span>
        <span>
          <span className="me-1 inline-block size-3 rounded bg-primary/40 align-middle" />
          Checked in
        </span>
        <span>
          <span className="me-1 inline-block size-3 rounded bg-muted align-middle" />
          Checked out
        </span>
        <span>Cancelled bookings are not shown. On a phone, swipe the calendar sideways.</span>
      </p>
    </section>
  );
}

// ---------- bookings ----------

type BookingForm = {
  id?: string;
  home_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  guest_country: string;
  guest_language: string;
  check_in: string;
  check_out: string;
  guests: string;
  source: BookingSource;
  total_amount_aed: string;
  channel_fee_aed: string;
  cleaning_fee_aed: string;
  status: BookingStatus;
  guest_id_received: boolean;
  notes: string;
  imported: boolean;
};
const emptyBooking = (home: Home, checkIn: string): BookingForm => ({
  home_id: home.id,
  guest_name: "",
  guest_phone: "",
  guest_email: "",
  guest_country: "",
  guest_language: "",
  check_in: checkIn,
  check_out: addDays(checkIn, 1),
  guests: "2",
  source: "direct",
  total_amount_aed: "",
  channel_fee_aed: "",
  cleaning_fee_aed: String(home.cleaning_fee_aed),
  status: "confirmed",
  guest_id_received: false,
  notes: "",
  imported: false,
});
const bookingToForm = (b: Booking): BookingForm => ({
  id: b.id,
  home_id: b.home_id,
  guest_name: b.guest_name,
  guest_phone: b.guest_phone,
  guest_email: b.guest_email,
  guest_country: b.guest_country,
  guest_language: b.guest_language,
  check_in: b.check_in,
  check_out: b.check_out,
  guests: String(b.guests),
  source: b.source as BookingSource,
  total_amount_aed: String(b.total_amount_aed),
  channel_fee_aed: String(b.channel_fee_aed),
  cleaning_fee_aed: String(b.cleaning_fee_aed),
  status: b.status as BookingStatus,
  guest_id_received: b.guest_id_received,
  notes: b.notes,
  imported: !!b.external_uid,
});

function BookingsTab({
  data,
  run,
  homeById,
  editBooking,
  newBooking,
  openImport,
}: {
  data: Data;
  run: Run;
  homeById: Map<string, Home>;
  editBooking: (b: Booking) => void;
  newBooking: () => void;
  openImport: () => void;
}) {
  const [homeId, setHomeId] = useState("");
  const [show, setShow] = useState<"upcoming" | "all">("upcoming");
  const setStatus = useServerFn(setBookingStatus);
  const list = data.bookings
    .filter((b) => !homeId || b.home_id === homeId)
    .filter((b) => show === "all" || (b.status !== "cancelled" && b.check_out >= data.today))
    .sort((a, b) =>
      show === "all" ? b.check_in.localeCompare(a.check_in) : a.check_in.localeCompare(b.check_in),
    );

  const statusSelect = (b: Booking) => (
    <select
      aria-label={`Status of the booking for ${b.guest_name || "guest"}`}
      className={`${selectCls} w-auto`}
      value={b.status}
      onChange={(e) =>
        run(() => setStatus({ data: { id: b.id, status: e.target.value as BookingStatus } }))
      }
    >
      {BOOKING_STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Home
          <select
            className={`${selectCls} mt-1 min-w-40`}
            value={homeId}
            onChange={(e) => setHomeId(e.target.value)}
          >
            <option value="">All homes</option>
            {data.homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Show
          <select
            className={`${selectCls} mt-1`}
            value={show}
            onChange={(e) => setShow(e.target.value as "upcoming" | "all")}
          >
            <option value="upcoming">Current and upcoming</option>
            <option value="all">All, with past and cancelled</option>
          </select>
        </label>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={openImport}>
            <Upload className="size-4" />
            Import a calendar file
          </Button>
          <Button size="sm" onClick={newBooking}>
            <Plus className="size-4" />
            Add booking
          </Button>
        </div>
      </div>

      {!list.length ? (
        <p className={emptyCls}>
          No bookings to show. Add one by hand, or import a calendar file (.ics) exported from
          Airbnb or Booking.com.
        </p>
      ) : (
        <ul className="space-y-2">
          <li className="hidden grid-cols-[1.4fr_1.2fr_1.3fr_0.8fr_0.9fr_auto] gap-3 px-4 text-xs uppercase tracking-wide text-muted-foreground md:grid">
            <span>Guest</span>
            <span>Home</span>
            <span>Stay</span>
            <span>Source</span>
            <span>Amount</span>
            <span>Status</span>
          </li>
          {list.map((b) => (
            <li
              key={b.id}
              className={`${cardCls} grid gap-1 md:grid-cols-[1.4fr_1.2fr_1.3fr_0.8fr_0.9fr_auto] md:items-center md:gap-3`}
            >
              <div className="min-w-0">
                <button
                  type="button"
                  className="truncate text-start font-medium underline-offset-2 hover:underline"
                  onClick={() => editBooking(b)}
                >
                  {b.guest_name || "Guest"}
                </button>
                <p className="text-xs text-muted-foreground">
                  {b.guests} guest{b.guests === 1 ? "" : "s"}
                  {b.guest_phone ? ` · ${b.guest_phone}` : ""}
                  {b.status !== "cancelled" && !b.guest_id_received ? " · ID not received" : ""}
                </p>
              </div>
              <Field label="Home">{homeTitle(homeById.get(b.home_id))}</Field>
              <Field label="Stay">
                {formatDay(b.check_in)} to {formatDay(b.check_out)}{" "}
                <span className="text-muted-foreground">
                  ({nights(b)} night{nights(b) === 1 ? "" : "s"})
                </span>
              </Field>
              <Field label="Source">{labelOf(SOURCES, b.source)}</Field>
              <Field label="Amount">
                {Number(b.total_amount_aed) > 0 ? (
                  aed(Number(b.total_amount_aed))
                ) : (
                  <span className="text-muted-foreground">Not entered</span>
                )}
              </Field>
              <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
                <span className="md:hidden">
                  <Pill tone={STATUS_TONE[b.status] ?? "ok"}>
                    {labelOf(BOOKING_STATUSES, b.status)}
                  </Pill>
                </span>
                {statusSelect(b)}
                <Button size="sm" variant="outline" onClick={() => editBooking(b)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingDialog({
  data,
  form,
  setForm,
  run,
}: {
  data: Data;
  form: BookingForm;
  setForm: (f: BookingForm | null) => void;
  run: Run;
}) {
  const save = useServerFn(saveBooking);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof BookingForm>(key: K, value: BookingForm[K]) =>
    setForm({ ...form, [key]: value });
  const home = data.homes.find((h) => h.id === form.home_id);
  const datesOk = isDay(form.check_in) && isDay(form.check_out) && form.check_out > form.check_in;
  const stayNights = datesOk ? nights(form) : 0;
  const clashes = datesOk ? findConflicts(form, data.bookings) : [];
  const guests = num(form.guests);
  const total = num(form.total_amount_aed) ?? 0;
  const channel = num(form.channel_fee_aed) ?? 0;
  const suggested = home && stayNights ? stayNights * Number(home.nightly_price_aed) : 0;
  const problem = !form.guest_name.trim()
    ? "Enter the guest's name."
    : !datesOk
      ? "Check-out must be after check-in."
      : guests === null || !Number.isInteger(guests) || guests < 1
        ? "Guests must be a whole number, at least 1."
        : channel > total
          ? "The channel fee cannot be more than the total amount."
          : "";
  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{form.id ? "Edit booking" : "Add booking"}</DialogTitle>
        <DialogDescription>
          A stay you record yourself. Saving does not change anything on Airbnb or Booking.com and
          does not message the guest.
          {form.imported
            ? " This booking came from a calendar file: importing the file again updates its dates and keeps what you type here."
            : ""}
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Home
            <select
              className={`${selectCls} mt-1`}
              value={form.home_id}
              disabled={!!form.id}
              onChange={(e) => set("home_id", e.target.value)}
            >
              {data.homes
                .filter((h) => h.active || h.id === form.home_id)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Check-in
            <Input
              className="mt-1"
              type="date"
              value={form.check_in}
              onChange={(e) => set("check_in", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Check-out
            <Input
              className="mt-1"
              type="date"
              value={form.check_out}
              onChange={(e) => set("check_out", e.target.value)}
            />
          </label>
          {stayNights > 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {stayNights} night{stayNights === 1 ? "" : "s"}
              {home?.sleeps && guests && guests > home.sleeps
                ? `. This home sleeps ${home.sleeps}; you entered ${guests} guests.`
                : ""}
            </p>
          )}
          {clashes.length > 0 && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2"
            >
              These dates are already booked for this home:{" "}
              {clashes
                .slice(0, 3)
                .map(
                  (c) =>
                    `${c.guest_name || "a guest"} (${formatDay(c.check_in)} to ${formatDay(c.check_out)})`,
                )
                .join(", ")}
              . Change the dates, or cancel the other booking first. A check-in on the day another
              guest checks out is fine.
            </p>
          )}
          <label className="text-sm">
            Guest name
            <Input
              className="mt-1"
              maxLength={200}
              value={form.guest_name}
              onChange={(e) => set("guest_name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Guests
            <Input
              className="mt-1"
              inputMode="numeric"
              value={form.guests}
              onChange={(e) => set("guests", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Phone
            <Input
              className="mt-1"
              type="tel"
              maxLength={50}
              value={form.guest_phone}
              onChange={(e) => set("guest_phone", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Email
            <Input
              className="mt-1"
              type="email"
              maxLength={200}
              value={form.guest_email}
              onChange={(e) => set("guest_email", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Country
            <Input
              className="mt-1"
              maxLength={100}
              value={form.guest_country}
              onChange={(e) => set("guest_country", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Language
            <Input
              className="mt-1"
              maxLength={100}
              value={form.guest_language}
              onChange={(e) => set("guest_language", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Source
            <select
              className={`${selectCls} mt-1`}
              value={form.source}
              onChange={(e) => set("source", e.target.value as BookingSource)}
            >
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Status
            <select
              className={`${selectCls} mt-1`}
              value={form.status}
              onChange={(e) => set("status", e.target.value as BookingStatus)}
            >
              {BOOKING_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Total booking amount (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.total_amount_aed}
              onChange={(e) => set("total_amount_aed", e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Everything the guest pays, including the cleaning fee.
              {suggested > 0 && !form.total_amount_aed.trim() && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      set("total_amount_aed", String(suggested + (num(form.cleaning_fee_aed) ?? 0)))
                    }
                  >
                    Use {stayNights} × {aed(Number(home?.nightly_price_aed))} plus cleaning
                  </button>
                </>
              )}
            </span>
          </label>
          <label className="text-sm">
            Channel fee (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.channel_fee_aed}
              onChange={(e) => set("channel_fee_aed", e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              What Airbnb or Booking.com keeps. You type it; it is not read from the site.
            </span>
          </label>
          <label className="text-sm">
            Cleaning fee charged (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.cleaning_fee_aed}
              onChange={(e) => set("cleaning_fee_aed", e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Taken off the owner's payout as the cleaning cost.
            </span>
          </label>
          <label className="flex items-center gap-2 self-start pt-6 text-sm">
            <Checkbox
              checked={form.guest_id_received}
              onCheckedChange={(v) => set("guest_id_received", v === true)}
            />
            Guest ID received
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            The ID tick is only a note for your team. The CRM does not store the ID document and
            does not register the guest with any authority; do that in the official system yourself.
          </p>
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
        {!form.id && (
          <p className="text-xs text-muted-foreground">
            Saving adds two tasks: check-in on the arrival day ({CHECK_IN_TIME}) and cleaning on the
            departure day ({CHECK_OUT_TIME}).
          </p>
        )}
        {problem && <p className="text-sm text-destructive">{problem}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setForm(null)}>
            Close
          </Button>
          <Button
            disabled={busy || !!problem || clashes.length > 0}
            onClick={async () => {
              setBusy(true);
              const ok = await run(() =>
                save({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    home_id: form.home_id,
                    guest_name: form.guest_name,
                    guest_phone: form.guest_phone,
                    guest_email: form.guest_email.trim(),
                    guest_country: form.guest_country,
                    guest_language: form.guest_language,
                    check_in: form.check_in,
                    check_out: form.check_out,
                    guests: guests ?? 1,
                    source: form.source,
                    total_amount_aed: total,
                    channel_fee_aed: channel,
                    cleaning_fee_aed: num(form.cleaning_fee_aed) ?? 0,
                    status: form.status,
                    guest_id_received: form.guest_id_received,
                    notes: form.notes,
                  },
                }),
              );
              setBusy(false);
              if (ok) setForm(null);
            }}
          >
            {busy ? "Saving…" : "Save booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- calendar file import ----------

type ImportResult = Awaited<ReturnType<typeof importBookings>>;

function ImportDialog({
  data,
  close,
  reload,
}: {
  data: Data;
  close: () => void;
  reload: () => Promise<unknown>;
}) {
  const send = useServerFn(importBookings);
  const homes = data.homes.filter((h) => h.active);
  const [homeId, setHomeId] = useState(homes[0]?.id ?? data.homes[0]?.id ?? "");
  const [source, setSource] = useState<BookingSource>("airbnb");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [withBlocks, setWithBlocks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed: IcsResult | null = useMemo(() => (text.trim() ? parseIcs(text) : null), [text]);
  const events = parsed ? [...parsed.bookings, ...(withBlocks ? parsed.blocked : [])] : [];
  const plan = planImport(
    events,
    data.bookings.filter((b) => b.home_id === homeId),
  );
  const tooMany = events.length > MAX_IMPORT_EVENTS;
  const reset = () => {
    setResult(null);
    setError("");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>Import a calendar file</DialogTitle>
        <DialogDescription>
          Export the calendar of one listing from Airbnb or Booking.com as an .ics file, then choose
          the file here or paste its text. The file is read on this device. The CRM does not connect
          to Airbnb or Booking.com and nothing updates by itself: import the file again whenever you
          want the latest dates.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Home this calendar belongs to
            <select
              className={`${selectCls} mt-1`}
              value={homeId}
              onChange={(e) => {
                setHomeId(e.target.value);
                reset();
              }}
            >
              {data.homes
                .filter((h) => h.active || h.id === homeId)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Where the file comes from
            <select
              className={`${selectCls} mt-1`}
              value={source}
              onChange={(e) => setSource(e.target.value as BookingSource)}
            >
              {SOURCES.filter((s) => s.id !== "direct").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Calendar file (.ics)
            <Input
              className="mt-1"
              type="file"
              accept=".ics,text/calendar"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                reset();
                if (file.size > 2_000_000) {
                  setError("That file is larger than 2 MB. Export one listing's calendar.");
                  return;
                }
                setFileName(file.name);
                setText(await file.text());
              }}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Or paste the text of the file
            <Textarea
              className="mt-1 font-mono text-xs"
              rows={4}
              placeholder="BEGIN:VCALENDAR…"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFileName("");
                reset();
              }}
            />
          </label>
        </div>

        {parsed && !result && (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p className="font-medium">
              {fileName ? `${fileName}: ` : ""}
              {parsed.bookings.length} stay{parsed.bookings.length === 1 ? "" : "s"} found
            </p>
            <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
              <li>
                {plan.create.length} new, {plan.update.length} with changed dates, {plan.unchanged}{" "}
                already imported and unchanged.
              </li>
              <li>
                {parsed.blocked.length} blocked entr{parsed.blocked.length === 1 ? "y" : "ies"}{" "}
                {withBlocks ? "included as bookings (your choice below)" : "skipped"}: entries
                marked "Not available", "Blocked" or "Closed" are closed days, not guest bookings.
              </li>
              {parsed.invalid > 0 && (
                <li>
                  {parsed.invalid} entr{parsed.invalid === 1 ? "y" : "ies"} could not be read (no ID
                  or no valid dates) and will be skipped.
                </li>
              )}
              {parsed.duplicates > 0 && (
                <li>{parsed.duplicates} repeated entries in the file will be skipped.</li>
              )}
            </ul>
            {parsed.blocked.length > 0 && (
              <label className="flex items-start gap-2">
                <Checkbox
                  className="mt-0.5"
                  checked={withBlocks}
                  onCheckedChange={(v) => setWithBlocks(v === true)}
                />
                <span>
                  Also import the {parsed.blocked.length} blocked entr
                  {parsed.blocked.length === 1 ? "y" : "ies"} as bookings.{" "}
                  <span className="text-muted-foreground">
                    Some sites, Booking.com among them, may label their own reservations "CLOSED -
                    Not available" in the exported file. Tick this only if you know these entries
                    are real stays.
                  </span>
                </span>
              </label>
            )}
            {events.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {events.slice(0, 50).map((e) => (
                  <li key={e.uid} className="flex justify-between gap-3">
                    <span>
                      {formatDay(e.check_in)} to {formatDay(e.check_out)}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {e.summary || "No title"}
                    </span>
                  </li>
                ))}
                {events.length > 50 && <li>…and {events.length - 50} more.</li>}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              A calendar file carries dates only. Guest names, phone numbers and amounts are usually
              not in it, so imported bookings show a placeholder name and no amount until you fill
              them in. A booking that has disappeared from the file is not cancelled here; cancel it
              yourself. Each imported stay gets a check-in and a cleaning task.
            </p>
          </div>
        )}
        {text.trim() && parsed && !events.length && !result && (
          <p className="text-sm text-destructive">
            No stays to import were found in this text. Check that it is an .ics calendar file.
          </p>
        )}
        {tooMany && (
          <p className="text-sm text-destructive">
            This file has more than {MAX_IMPORT_EVENTS} stays. Export a shorter period.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {result && (
          <div role="status" className="space-y-2 rounded-md bg-primary/10 p-3 text-sm">
            <p className="font-medium">
              Import finished: {result.created} added, {result.updated} updated, {result.unchanged}{" "}
              unchanged.
            </p>
            {result.clashes.length > 0 && (
              <div>
                <p className="text-destructive">
                  {result.clashes.length} not imported because those nights are already booked for
                  this home:
                </p>
                <ul className="list-disc ps-5">
                  {result.clashes.map((c, i) => (
                    <li key={i}>
                      {formatDay(c.check_in)} to {formatDay(c.check_out)}
                      {c.summary ? ` (${c.summary})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.failed > 0 && (
              <p className="text-destructive">{result.failed} could not be saved. Try again.</p>
            )}
            {!result.tasks && (
              <p className="text-destructive">
                The check-in and cleaning tasks could not all be created. Importing the same file
                again will retry them.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {!result && (
            <Button
              disabled={busy || !homeId || !events.length || tooMany}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  setResult(await send({ data: { home_id: homeId, source, events } }));
                  await reload();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "The import failed.");
                }
                setBusy(false);
              }}
            >
              {busy
                ? "Importing…"
                : `Import ${events.length} stay${events.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- today ----------

type TaskForm = {
  id?: string;
  home_id: string;
  kind: TaskKind;
  due_day: string;
  due_time: string;
  assigned_to: string;
  note: string;
};
const emptyTask = (homeId: string, today: string): TaskForm => ({
  home_id: homeId,
  kind: "maintenance",
  due_day: today,
  due_time: "10:00",
  assigned_to: "",
  note: "",
});
const taskToForm = (t: Task): TaskForm => ({
  id: t.id,
  home_id: t.home_id,
  kind: t.kind as TaskKind,
  due_day: dubaiDay(t.due_at),
  due_time: dubaiTime(t.due_at),
  assigned_to: t.assigned_to,
  note: t.note,
});

function TodayTab({
  data,
  run,
  homeById,
  editTask,
  newTask,
}: {
  data: Data;
  run: Run;
  homeById: Map<string, Home>;
  editTask: (t: Task) => void;
  newTask: () => void;
}) {
  const setStatus = useServerFn(setBookingStatus);
  const setId = useServerFn(setGuestIdReceived);
  const setTask = useServerFn(setTaskStatus);
  const board = todayBoard(data.bookings, data.tasks, data.today);
  const bookingById = new Map(data.bookings.map((b) => [b.id, b]));
  const weekEnd = addDays(data.today, 7);
  const cancelled = new Set(data.bookings.filter((b) => b.status === "cancelled").map((b) => b.id));
  const comingUp = data.tasks
    .filter((t) => {
      const d = dubaiDay(t.due_at);
      return (
        t.status === "todo" &&
        d > data.today &&
        d <= weekEnd &&
        !(t.booking_id && cancelled.has(t.booking_id))
      );
    })
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  const taskRow = (t: Task, showDay: boolean) => {
    const guest = t.booking_id ? bookingById.get(t.booking_id)?.guest_name : "";
    return (
      <li key={t.id} className={`${cardCls} flex flex-wrap items-center gap-x-3 gap-y-2`}>
        <div className="min-w-0 flex-1 basis-56">
          <p className={`font-medium ${t.status === "done" ? "line-through opacity-60" : ""}`}>
            {labelOf(TASK_KINDS, t.kind)} · {homeTitle(homeById.get(t.home_id))}
          </p>
          <p className="text-sm text-muted-foreground">
            {showDay ? `${formatDay(dubaiDay(t.due_at))}, ` : ""}
            {dubaiTime(t.due_at)}
            {guest ? ` · ${guest}` : ""}
            {t.assigned_to ? ` · ${t.assigned_to}` : " · Nobody assigned"}
          </p>
          {t.note && <p className="text-sm">{t.note}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => editTask(t)}>
          Edit
        </Button>
        <Button
          size="sm"
          variant={t.status === "done" ? "outline" : "default"}
          onClick={() =>
            run(() =>
              setTask({ data: { id: t.id, status: t.status === "done" ? "todo" : "done" } }),
            )
          }
        >
          {t.status === "done" ? "Not done" : "Mark done"}
        </Button>
      </li>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{formatDay(data.today)}</h2>
        <Button size="sm" variant="outline" onClick={newTask}>
          <Plus className="size-4" />
          Add task
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Arrivals ({board.arrivals.length})</h3>
        {!board.arrivals.length ? (
          <p className={emptyCls}>Nobody arrives today.</p>
        ) : (
          <ul className="space-y-2">
            {board.arrivals.map((b) => {
              const home = homeById.get(b.home_id);
              const message = checkInMessage({
                guestName: b.guest_name,
                homeName: home?.name ?? "",
                building: home?.building ?? "",
                community: home?.community ?? "",
                checkIn: b.check_in,
                checkOut: b.check_out,
                instructions: home?.check_in_instructions ?? "",
                wifi: home?.wifi ?? "",
                agencyName: data.agencyName,
              });
              return (
                <li key={b.id} className={`${cardCls} space-y-3`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {b.guest_name || "Guest"} · {homeTitle(home)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {b.guests} guest{b.guests === 1 ? "" : "s"} · until {formatDay(b.check_out)}{" "}
                        · {labelOf(SOURCES, b.source)}
                        {b.guest_phone ? ` · ${b.guest_phone}` : ""}
                      </p>
                    </div>
                    <Pill tone={STATUS_TONE[b.status] ?? "ok"}>
                      {labelOf(BOOKING_STATUSES, b.status)}
                    </Pill>
                  </div>
                  {(!home?.check_in_instructions.trim() || !home?.wifi.trim()) && (
                    <p className="text-sm text-warning-foreground">
                      This home has no{" "}
                      {[
                        !home?.check_in_instructions.trim() && "check-in instructions",
                        !home?.wifi.trim() && "Wi-Fi details",
                      ]
                        .filter(Boolean)
                        .join(" or ")}{" "}
                      saved, so the draft leaves them out. Add them on the Homes tab.
                    </p>
                  )}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Drafted check-in message (English). Not sent by the CRM.
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-sm">
                      {message}
                    </pre>
                  </details>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyDraft text={message} />
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={b.guest_id_received}
                        onCheckedChange={(v) =>
                          run(() => setId({ data: { id: b.id, received: v === true } }))
                        }
                      />
                      Guest ID received
                    </label>
                    {b.status === "confirmed" && (
                      <Button
                        size="sm"
                        className="ms-auto"
                        onClick={() =>
                          run(() => setStatus({ data: { id: b.id, status: "checked_in" } }))
                        }
                      >
                        Mark checked in
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Departures ({board.departures.length})</h3>
        {!board.departures.length ? (
          <p className={emptyCls}>Nobody leaves today.</p>
        ) : (
          <ul className="space-y-2">
            {board.departures.map((b) => (
              <li key={b.id} className={`${cardCls} flex flex-wrap items-center gap-2`}>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">
                    {b.guest_name || "Guest"} · {homeTitle(homeById.get(b.home_id))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Check-out by {CHECK_OUT_TIME} · stayed since {formatDay(b.check_in)}
                  </p>
                </div>
                <Pill tone={STATUS_TONE[b.status] ?? "ok"}>
                  {labelOf(BOOKING_STATUSES, b.status)}
                </Pill>
                {b.status !== "checked_out" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      run(() => setStatus({ data: { id: b.id, status: "checked_out" } }))
                    }
                  >
                    Mark checked out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {board.staying.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {board.staying.length} other home{board.staying.length === 1 ? " has" : "s have"} guests
            staying tonight.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Tasks due today ({board.tasksToday.length})</h3>
        {!board.tasksToday.length ? (
          <p className={emptyCls}>No tasks are due today.</p>
        ) : (
          <ul className="space-y-2">{board.tasksToday.map((t) => taskRow(t, false))}</ul>
        )}
      </div>

      {board.overdue.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-destructive">
            Still open from earlier ({board.overdue.length})
          </h3>
          <ul className="space-y-2">{board.overdue.map((t) => taskRow(t, true))}</ul>
        </div>
      )}

      {comingUp.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Next 7 days ({comingUp.length})</h3>
          <ul className="space-y-2">{comingUp.map((t) => taskRow(t, true))}</ul>
        </div>
      )}
    </section>
  );
}

function TaskDialog({
  data,
  form,
  setForm,
  run,
}: {
  data: Data;
  form: TaskForm;
  setForm: (f: TaskForm | null) => void;
  run: Run;
}) {
  const save = useServerFn(saveTask);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) =>
    setForm({ ...form, [key]: value });
  const problem = !isDay(form.due_day)
    ? "Pick the day the task is due."
    : !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.due_time)
      ? "Enter a time like 14:30."
      : "";
  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{form.id ? "Edit task" : "Add task"}</DialogTitle>
        <DialogDescription>
          A job for your team. Nobody is notified: the name is only a note of who does it. Times are
          Dubai time.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Home
            <select
              className={`${selectCls} mt-1`}
              value={form.home_id}
              disabled={!!form.id}
              onChange={(e) => set("home_id", e.target.value)}
            >
              {data.homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Kind
            <select
              className={`${selectCls} mt-1`}
              value={form.kind}
              disabled={!!form.id}
              onChange={(e) => set("kind", e.target.value as TaskKind)}
            >
              {TASK_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Due day
            <Input
              className="mt-1"
              type="date"
              value={form.due_day}
              onChange={(e) => set("due_day", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Due time
            <Input
              className="mt-1"
              type="time"
              value={form.due_time}
              onChange={(e) => set("due_time", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Assigned to
            <Input
              className="mt-1"
              maxLength={200}
              placeholder="Name of the cleaner or team member"
              value={form.assigned_to}
              onChange={(e) => set("assigned_to", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Note
            <Textarea
              className="mt-1"
              rows={3}
              maxLength={2000}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
        </div>
        {problem && <p className="text-sm text-destructive">{problem}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setForm(null)}>
            Close
          </Button>
          <Button
            disabled={busy || !!problem}
            onClick={async () => {
              setBusy(true);
              const { id: taskId, ...fields } = form;
              const ok = await run(() =>
                save({ data: { ...(taskId ? { id: taskId } : {}), ...fields } }),
              );
              setBusy(false);
              if (ok) setForm(null);
            }}
          >
            {busy ? "Saving…" : "Save task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- homes ----------

type HomeForm = {
  id?: string;
  name: string;
  building: string;
  community: string;
  bedrooms: string;
  sleeps: string;
  owner_name: string;
  owner_phone: string;
  owner_id: string;
  permit_number: string;
  permit_expires_on: string;
  nightly_price_aed: string;
  cleaning_fee_aed: string;
  management_fee_percent: string;
  check_in_instructions: string;
  wifi: string;
  active: boolean;
};
const emptyHome = (): HomeForm => ({
  name: "",
  building: "",
  community: "",
  bedrooms: "",
  sleeps: "",
  owner_name: "",
  owner_phone: "",
  owner_id: "",
  permit_number: "",
  permit_expires_on: "",
  nightly_price_aed: "",
  cleaning_fee_aed: "",
  management_fee_percent: "20",
  check_in_instructions: "",
  wifi: "",
  active: true,
});
const homeToForm = (h: Home): HomeForm => ({
  id: h.id,
  name: h.name,
  building: h.building,
  community: h.community,
  bedrooms: str(h.bedrooms),
  sleeps: str(h.sleeps),
  owner_name: h.owner_name,
  owner_phone: h.owner_phone,
  owner_id: h.owner_id ?? "",
  permit_number: h.permit_number,
  permit_expires_on: h.permit_expires_on ?? "",
  nightly_price_aed: String(h.nightly_price_aed),
  cleaning_fee_aed: String(h.cleaning_fee_aed),
  management_fee_percent: String(h.management_fee_percent),
  check_in_instructions: h.check_in_instructions,
  wifi: h.wifi,
  active: h.active,
});

function HomesTab({ data, edit }: { data: Data; edit: (f: HomeForm) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          The permit number and expiry are your own notes; the CRM does not check them with any
          authority. You are warned here 30 days before a permit ends.
        </p>
        <Button size="sm" onClick={() => edit(emptyHome())}>
          <Plus className="size-4" />
          Add home
        </Button>
      </div>
      <ul className="space-y-2">
        <li className="hidden grid-cols-[1.5fr_1.1fr_1.3fr_1fr_auto] gap-3 px-4 text-xs uppercase tracking-wide text-muted-foreground md:grid">
          <span>Home</span>
          <span>Owner</span>
          <span>Permit</span>
          <span>Prices</span>
          <span />
        </li>
        {data.homes.map((h) => {
          const permit = permitState(h, data.today);
          return (
            <li
              key={h.id}
              className={`${cardCls} grid gap-1 md:grid-cols-[1.5fr_1.1fr_1.3fr_1fr_auto] md:items-center md:gap-3 ${h.active ? "" : "opacity-70"}`}
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {h.name} {!h.active && <Pill tone="ok">Not active</Pill>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    homePlace(h),
                    h.bedrooms === null
                      ? ""
                      : h.bedrooms === 0
                        ? "Studio"
                        : `${h.bedrooms} bedroom${h.bedrooms === 1 ? "" : "s"}`,
                    h.sleeps === null ? "" : `sleeps ${h.sleeps}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Field label="Owner">
                {h.owner_name || <span className="text-muted-foreground">Not entered</span>}
                {h.owner_phone ? (
                  <span className="block text-xs text-muted-foreground">{h.owner_phone}</span>
                ) : null}
              </Field>
              <div className="text-sm">
                <Pill tone={PERMIT_TONE[permit.tone]}>{permit.label}</Pill>
                {h.permit_number && (
                  <span className="block text-xs text-muted-foreground">
                    Permit {h.permit_number}
                  </span>
                )}
              </div>
              <Field label="Prices">
                {aed(Number(h.nightly_price_aed))} a night
                <span className="block text-xs text-muted-foreground">
                  Cleaning {aed(Number(h.cleaning_fee_aed))} · fee{" "}
                  {Number(h.management_fee_percent)}%
                </span>
              </Field>
              <div className="mt-2 md:mt-0">
                <Button size="sm" variant="outline" onClick={() => edit(homeToForm(h))}>
                  Edit
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HomeDialog({
  data,
  form,
  setForm,
  run,
}: {
  data: Data;
  form: HomeForm;
  setForm: (f: HomeForm | null) => void;
  run: Run;
}) {
  const save = useServerFn(saveHome);
  const del = useServerFn(deleteHome);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof HomeForm>(key: K, value: HomeForm[K]) =>
    setForm({ ...form, [key]: value });
  const fee = num(form.management_fee_percent) ?? 0;
  const bedrooms = num(form.bedrooms);
  const sleeps = num(form.sleeps);
  const problem = !form.name.trim()
    ? "Give the home a name."
    : fee > 100
      ? "The management fee cannot be more than 100%."
      : bedrooms !== null && !Number.isInteger(bedrooms)
        ? "Bedrooms must be a whole number."
        : sleeps !== null && (!Number.isInteger(sleeps) || sleeps < 1)
          ? "Sleeps must be a whole number, at least 1."
          : form.permit_expires_on && !isDay(form.permit_expires_on)
            ? "Check the permit expiry date."
            : "";
  const permit =
    form.permit_expires_on && isDay(form.permit_expires_on)
      ? permitState(
          { permit_number: form.permit_number, permit_expires_on: form.permit_expires_on },
          data.today,
        )
      : null;
  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{form.id ? "Edit home" : "Add home"}</DialogTitle>
        <DialogDescription>
          A holiday home you manage for an owner. The check-in instructions and Wi-Fi are used to
          draft the check-in message on the Today tab.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Name
            <Input
              className="mt-1"
              maxLength={200}
              placeholder="Marina View 1BR"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Building
            <Input
              className="mt-1"
              maxLength={200}
              value={form.building}
              onChange={(e) => set("building", e.target.value)}
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
            Bedrooms (0 for a studio)
            <Input
              className="mt-1"
              inputMode="numeric"
              value={form.bedrooms}
              onChange={(e) => set("bedrooms", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Sleeps
            <Input
              className="mt-1"
              inputMode="numeric"
              value={form.sleeps}
              onChange={(e) => set("sleeps", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Owner name
            <Input
              className="mt-1"
              maxLength={200}
              value={form.owner_name}
              onChange={(e) => set("owner_name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Owner phone
            <Input
              className="mt-1"
              type="tel"
              maxLength={50}
              value={form.owner_phone}
              onChange={(e) => set("owner_phone", e.target.value)}
            />
          </label>
          {data.owners.length > 0 && (
            <label className="text-sm sm:col-span-2">
              Link to an owner on the Owners page (optional)
              <select
                className={`${selectCls} mt-1`}
                value={form.owner_id}
                onChange={(e) => {
                  const owner = data.owners.find((o) => o.id === e.target.value);
                  setForm({
                    ...form,
                    owner_id: e.target.value,
                    owner_name: owner && !form.owner_name.trim() ? owner.name : form.owner_name,
                    owner_phone:
                      owner && !form.owner_phone.trim() ? (owner.phone ?? "") : form.owner_phone,
                  });
                }}
              >
                <option value="">Not linked</option>
                {data.owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.phone ? ` (${o.phone})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            Holiday-home permit number
            <Input
              className="mt-1"
              maxLength={100}
              value={form.permit_number}
              onChange={(e) => set("permit_number", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Permit expiry date
            <Input
              className="mt-1"
              type="date"
              value={form.permit_expires_on}
              onChange={(e) => set("permit_expires_on", e.target.value)}
            />
            {permit && permit.tone !== "ok" && (
              <span className="mt-1 block text-xs text-destructive">{permit.label}</span>
            )}
          </label>
          <label className="text-sm">
            Nightly base price (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.nightly_price_aed}
              onChange={(e) => set("nightly_price_aed", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Cleaning fee (AED)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.cleaning_fee_aed}
              onChange={(e) => set("cleaning_fee_aed", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Management fee (%)
            <Input
              className="mt-1"
              inputMode="decimal"
              value={form.management_fee_percent}
              onChange={(e) => set("management_fee_percent", e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Your share of each booking after the channel fee.
            </span>
          </label>
          <label className="flex items-center gap-2 self-start pt-6 text-sm">
            <Checkbox checked={form.active} onCheckedChange={(v) => set("active", v === true)} />
            Active (shown on the calendar)
          </label>
          <label className="text-sm sm:col-span-2">
            Check-in instructions
            <Textarea
              className="mt-1"
              rows={4}
              maxLength={4000}
              placeholder="Where to park, which entrance, key box and code…"
              value={form.check_in_instructions}
              onChange={(e) => set("check_in_instructions", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Wi-Fi (network and password)
            <Input
              className="mt-1"
              maxLength={500}
              value={form.wifi}
              onChange={(e) => set("wifi", e.target.value)}
            />
          </label>
        </div>
        {problem && <p className="text-sm text-destructive">{problem}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {form.id && data.isOwner && (
            <Button
              variant="outline"
              className="me-auto text-destructive"
              disabled={busy}
              onClick={async () => {
                if (!form.id || !window.confirm("Delete this home? This cannot be undone.")) return;
                setBusy(true);
                const homeId = form.id;
                const ok = await run(() => del({ data: homeId }));
                setBusy(false);
                if (ok) setForm(null);
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => setForm(null)}>
            Close
          </Button>
          <Button
            disabled={busy || !!problem}
            onClick={async () => {
              setBusy(true);
              const ok = await run(() =>
                save({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    name: form.name,
                    building: form.building,
                    community: form.community,
                    bedrooms,
                    sleeps,
                    owner_name: form.owner_name,
                    owner_phone: form.owner_phone,
                    owner_id: form.owner_id || null,
                    permit_number: form.permit_number,
                    permit_expires_on: form.permit_expires_on || null,
                    nightly_price_aed: num(form.nightly_price_aed) ?? 0,
                    cleaning_fee_aed: num(form.cleaning_fee_aed) ?? 0,
                    management_fee_percent: fee,
                    check_in_instructions: form.check_in_instructions,
                    wifi: form.wifi,
                    active: form.active,
                  },
                }),
              );
              setBusy(false);
              if (ok) setForm(null);
            }}
          >
            {busy ? "Saving…" : "Save home"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- payouts ----------

function PayoutsTab({ data }: { data: Data }) {
  const [homeId, setHomeId] = useState(data.homes[0]?.id ?? "");
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const m = monthOf(month);
  const home = data.homes.find((h) => h.id === homeId);
  const payout =
    home && m
      ? ownerPayout({
          managementFeePercent: Number(home.management_fee_percent),
          bookings: data.bookings.filter((b) => b.home_id === home.id),
          month: m,
        })
      : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm sm:max-w-xs">
          Home
          <select
            className={`${selectCls} mt-1`}
            value={homeId}
            onChange={(e) => setHomeId(e.target.value)}
          >
            {data.homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <MonthPicker month={month} setMonth={setMonth} />
        {home && m && (
          <Button asChild size="sm" variant="outline">
            <Link to="/holiday-homes/payout/$homeId/$month" params={{ homeId: home.id, month }}>
              <Printer className="size-4" />
              Open printable draft
            </Link>
          </Button>
        )}
      </div>

      {!payout || !m || !home ? (
        <p className={emptyCls}>Pick a home and a month (for example 2026-11).</p>
      ) : (
        <div className={cardCls}>
          <h2 className="font-semibold">
            Draft payout · {home.name} · {m.label}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Bookings whose check-out falls in the month, less channel fees, cleaning and your
            management fee ({payout.feePercent}% of the amount after channel fees). Built from the
            amounts typed on each booking; the CRM does not read payouts from Airbnb or Booking.com
            and pays nobody.
            {home.owner_name ? ` Owner: ${home.owner_name}.` : ""}
          </p>
          <p className="mb-3 text-sm">
            Occupancy in {m.label}:{" "}
            <span className="font-medium">
              {payout.occupancy.bookedNights} of {payout.occupancy.nightsInMonth} nights (
              {payout.occupancy.percent}%)
            </span>
          </p>
          {!payout.lines.length ? (
            <p className="text-sm text-muted-foreground">
              No bookings check out in this month for this home.
            </p>
          ) : (
            <>
              <ul className="space-y-2 md:hidden">
                {payout.lines.map((l) => (
                  <li key={l.bookingId} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium">{l.guestName || "Guest"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(l.checkIn)} to {formatDay(l.checkOut)} · {l.nights} night
                      {l.nights === 1 ? "" : "s"} · {labelOf(SOURCES, l.source)}
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Booking amount</span>
                      {aed(l.amount)}
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Channel fee</span>−{aed(l.channelFee)}
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Cleaning</span>−{aed(l.cleaning)}
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Management fee</span>−
                      {aed(l.managementFee)}
                    </p>
                    <p className="flex justify-between font-medium">
                      <span>Payout to owner</span>
                      {aed(l.payout)}
                    </p>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full text-sm md:table">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 text-start font-medium">Booking</th>
                    <th className="py-2 text-end font-medium">Amount</th>
                    <th className="py-2 text-end font-medium">Channel fee</th>
                    <th className="py-2 text-end font-medium">Cleaning</th>
                    <th className="py-2 text-end font-medium">Management fee</th>
                    <th className="py-2 text-end font-medium">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {payout.lines.map((l) => (
                    <tr key={l.bookingId} className="border-b border-border">
                      <td className="py-2">
                        {l.guestName || "Guest"}
                        <span className="block text-xs text-muted-foreground">
                          {formatDay(l.checkIn)} to {formatDay(l.checkOut)} · {l.nights} night
                          {l.nights === 1 ? "" : "s"} · {labelOf(SOURCES, l.source)}
                        </span>
                      </td>
                      <td className="py-2 text-end">{aed(l.amount)}</td>
                      <td className="py-2 text-end">{aed(l.channelFee)}</td>
                      <td className="py-2 text-end">{aed(l.cleaning)}</td>
                      <td className="py-2 text-end">{aed(l.managementFee)}</td>
                      <td className="py-2 text-end font-medium">{aed(l.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
            <Total label="Booking amount" value={aed(payout.totals.amount)} />
            <Total label="Channel fees" value={`−${aed(payout.totals.channelFee)}`} />
            <Total label="Cleaning" value={`−${aed(payout.totals.cleaning)}`} />
            <Total label="Management fee" value={`−${aed(payout.totals.managementFee)}`} />
            <Total label="Payout to owner" value={aed(payout.totals.payout)} strong />
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
