import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess, requireOwner } from "./agency-access";
import {
  BOOKING_STATUS_IDS,
  MAX_IMPORT_EVENTS,
  SOURCE_IDS,
  TASK_KIND_IDS,
  bookingTasks,
  dubaiAt,
  dubaiToday,
  findConflicts,
  formatDay,
  importedGuestName,
  isDay,
  planImport,
  type IcsEvent,
} from "./hh";

type Client = Parameters<typeof getAccess>[0];
const guard = (context: { supabase: Client; userId: string }) =>
  getAccess(context.supabase, context.userId);

const id = z.string().uuid();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-18")
  .refine(isDay, "That date does not exist");
const money = z.number().min(0).max(1_000_000_000);

const HOME_COLS =
  "id,name,building,community,bedrooms,sleeps,owner_name,owner_phone,owner_id,permit_number,permit_expires_on,nightly_price_aed,cleaning_fee_aed,management_fee_percent,check_in_instructions,wifi,active,created_at";
const BOOKING_COLS =
  "id,home_id,guest_name,guest_phone,guest_email,guest_country,guest_language,check_in,check_out,guests,source,total_amount_aed,channel_fee_aed,cleaning_fee_aed,status,guest_id_received,notes,external_uid,created_at";
const TASK_COLS = "id,home_id,booking_id,kind,due_at,assigned_to,status,note,created_at";

/** Postgres raises this when the no-double-booking constraint refuses a row. */
const OVERLAP = "23P01";
const CLASH = "Those dates are already booked for this home. Nothing was saved.";

const PAGE = 1000;
const MAX_PAGES = 20;

/** Reads every row of a query in pages, because one request returns at most 1,000 rows. */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error("Could not load holiday homes.");
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** Everything the Holiday homes page shows, for the caller's own agency only. */
export const getHolidayHomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    const a = access.agencyId;
    const db = context.supabase;
    const [homes, bookings, tasks, { data: owners }] = await Promise.all([
      readAll((from, to) =>
        db
          .from("hh_homes")
          .select(HOME_COLS)
          .eq("agency_id", a)
          .order("name")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("hh_bookings")
          .select(BOOKING_COLS)
          .eq("agency_id", a)
          .order("check_in", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("hh_tasks")
          .select(TASK_COLS)
          .eq("agency_id", a)
          .order("due_at", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      // Only used to link a home to an owner record; a failure here must not hide the page.
      db.from("owners").select("id,name,phone").eq("agency_id", a).order("name").limit(1000),
    ]);
    return {
      agencyName: access.agencyName,
      isOwner: access.isOwner,
      today: dubaiToday(),
      homes: homes.rows,
      bookings: bookings.rows,
      tasks: tasks.rows,
      owners: owners ?? [],
      /** False when there are more rows than the page reads; the screen says so instead of hiding it. */
      complete: homes.complete && bookings.complete && tasks.complete,
    };
  });

// ---------- homes ----------

export const homeSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  building: z.string().trim().max(200),
  community: z.string().trim().max(200),
  bedrooms: z.number().int().min(0).max(50).nullable(),
  sleeps: z.number().int().min(1).max(100).nullable(),
  owner_name: z.string().trim().max(200),
  owner_phone: z.string().trim().max(50),
  owner_id: id.nullable(),
  permit_number: z.string().trim().max(100),
  permit_expires_on: day.nullable(),
  nightly_price_aed: money,
  cleaning_fee_aed: money,
  management_fee_percent: z.number().min(0).max(100),
  check_in_instructions: z.string().trim().max(4000),
  wifi: z.string().trim().max(500),
  active: z.boolean(),
});
export type HomeInput = z.infer<typeof homeSchema>;

export const saveHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(homeSchema)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { id: homeId, ...fields } = data;
    if (fields.owner_id) {
      const { data: owner } = await context.supabase
        .from("owners")
        .select("id")
        .eq("id", fields.owner_id)
        .eq("agency_id", access.agencyId)
        .maybeSingle();
      if (!owner) throw new Error("Owner not found. Add them on the Owners page first.");
    }
    if (homeId) {
      const { data: saved, error } = await context.supabase
        .from("hh_homes")
        .update(fields)
        .eq("id", homeId)
        .eq("agency_id", access.agencyId)
        .select("id");
      if (error || !saved?.length) throw new Error("Could not save the home.");
      return { id: homeId };
    }
    const { data: created, error } = await context.supabase
      .from("hh_homes")
      .insert({ ...fields, agency_id: access.agencyId, created_by: context.userId })
      .select("id")
      .single();
    if (error || !created) throw new Error("Could not save the home.");
    return { id: created.id };
  });

/** Owner only, and only for a home with no bookings: booking history is never deleted with it. */
export const deleteHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data: gone, error } = await context.supabase
      .from("hh_homes")
      .delete()
      .eq("id", data)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error)
      return {
        error: "This home has bookings, so it cannot be deleted. Mark it as not active instead.",
      };
    if (!gone?.length) return { error: "Home not found." };
    return { success: true };
  });

// ---------- bookings ----------

type BookingForTasks = {
  id: string;
  home_id: string;
  check_in: string;
  check_out: string;
  status: string;
  guest_name: string;
};

/**
 * Makes sure each booking has its check-in and cleaning task. One of each kind per booking is kept
 * by the database, so calling this again adds nothing. Returns false when the tasks could not be
 * written, so the caller can say so instead of pretending.
 */
async function ensureTasks(db: Client, agencyId: string, bookings: BookingForTasks[]) {
  const rows = bookings.flatMap((b) =>
    bookingTasks(b).map((t) => ({
      ...t,
      home_id: b.home_id,
      booking_id: b.id,
      agency_id: agencyId,
    })),
  );
  if (!rows.length) return true;
  const { error } = await db
    .from("hh_tasks")
    .upsert(rows, { onConflict: "booking_id,kind", ignoreDuplicates: true });
  return !error;
}

/** After a booking's dates change, moves its automatic tasks that are still to do. */
async function moveTasks(db: Client, agencyId: string, booking: BookingForTasks) {
  let ok = true;
  for (const t of bookingTasks(booking)) {
    const { error } = await db
      .from("hh_tasks")
      .update({ due_at: t.due_at })
      .eq("booking_id", booking.id)
      .eq("kind", t.kind)
      .eq("status", "todo")
      .eq("agency_id", agencyId);
    if (error) ok = false;
  }
  return ok;
}

export const bookingSchema = z
  .object({
    id: id.optional(),
    home_id: id,
    guest_name: z.string().trim().min(1, "Guest name is required").max(200),
    guest_phone: z.string().trim().max(50),
    guest_email: z.union([z.literal(""), z.string().trim().email("Check the email").max(200)]),
    guest_country: z.string().trim().max(100),
    guest_language: z.string().trim().max(100),
    check_in: day,
    check_out: day,
    guests: z.number().int().min(1).max(100),
    source: z.enum(SOURCE_IDS),
    total_amount_aed: money,
    channel_fee_aed: money,
    cleaning_fee_aed: money,
    status: z.enum(BOOKING_STATUS_IDS),
    guest_id_received: z.boolean(),
    notes: z.string().trim().max(2000),
  })
  .refine((b) => b.check_out > b.check_in, {
    message: "Check-out must be after check-in.",
  });
export type BookingInput = z.infer<typeof bookingSchema>;

const clashMessage = (clashes: { guest_name: string; check_in: string; check_out: string }[]) =>
  `Those dates are already booked for this home: ${clashes
    .slice(0, 3)
    .map(
      (c) => `${c.guest_name || "a guest"} (${formatDay(c.check_in)} to ${formatDay(c.check_out)})`,
    )
    .join(", ")}. Nothing was saved.`;

/**
 * Add or correct a booking. Double bookings are refused twice: here with a clear message, and by
 * the database constraint in case two people save at the same moment. A new booking gets its
 * check-in and cleaning tasks.
 */
export const saveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(bookingSchema)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const { id: bookingId, ...fields } = data;
    const { data: home } = await db
      .from("hh_homes")
      .select("id")
      .eq("id", fields.home_id)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!home) throw new Error("Home not found.");

    const { data: near, error: nearError } = await db
      .from("hh_bookings")
      .select("id,home_id,guest_name,check_in,check_out,status")
      .eq("agency_id", access.agencyId)
      .eq("home_id", fields.home_id)
      .neq("status", "cancelled")
      .lt("check_in", fields.check_out)
      .gt("check_out", fields.check_in)
      .limit(50);
    if (nearError) throw new Error("Could not check the dates.");
    const clashes = findConflicts({ ...fields, id: bookingId }, near ?? []);
    if (clashes.length) return { error: clashMessage(clashes) };

    if (bookingId) {
      const { data: before } = await db
        .from("hh_bookings")
        .select("id,home_id,check_in,check_out")
        .eq("id", bookingId)
        .eq("agency_id", access.agencyId)
        .maybeSingle();
      if (!before) throw new Error("Booking not found.");
      if (before.home_id !== fields.home_id)
        return {
          error: "A booking cannot be moved to another home. Cancel it and add a new one.",
        };
      const { home_id: _home, ...editable } = fields;
      const { data: saved, error } = await db
        .from("hh_bookings")
        .update(editable)
        .eq("id", bookingId)
        .eq("agency_id", access.agencyId)
        .select("id,home_id,check_in,check_out,status,guest_name");
      if (error?.code === OVERLAP) return { error: CLASH };
      if (error || !saved?.[0]) throw new Error("Could not save the booking.");
      let tasks = await ensureTasks(db, access.agencyId, saved);
      if (before.check_in !== saved[0].check_in || before.check_out !== saved[0].check_out)
        tasks = (await moveTasks(db, access.agencyId, saved[0])) && tasks;
      return { id: bookingId, tasks };
    }
    const { data: created, error } = await db
      .from("hh_bookings")
      .insert({ ...fields, agency_id: access.agencyId, created_by: context.userId })
      .select("id,home_id,check_in,check_out,status,guest_name")
      .single();
    if (error?.code === OVERLAP) return { error: CLASH };
    if (error || !created) throw new Error("Could not save the booking.");
    return { id: created.id, tasks: await ensureTasks(db, access.agencyId, [created]) };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id, status: z.enum(BOOKING_STATUS_IDS) }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const { data: saved, error } = await db
      .from("hh_bookings")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .select("id,home_id,check_in,check_out,status,guest_name");
    // Bringing back a cancelled booking is refused when someone else now has those nights.
    if (error?.code === OVERLAP)
      return { error: "Those dates have been booked by someone else since this was cancelled." };
    if (error || !saved?.length) throw new Error("Could not update the booking.");
    return { success: true, tasks: await ensureTasks(db, access.agencyId, saved) };
  });

export const setGuestIdReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id, received: z.boolean() }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { data: saved, error } = await context.supabase
      .from("hh_bookings")
      .update({ guest_id_received: data.received })
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !saved?.length) throw new Error("Could not update the booking.");
    return { success: true };
  });

// ---------- calendar file import ----------

const importSchema = z.object({
  home_id: id,
  source: z.enum(SOURCE_IDS),
  /** Already read from the file in the browser; the server never fetches a calendar itself. */
  events: z
    .array(
      z
        .object({
          uid: z.string().trim().min(1).max(300),
          check_in: day,
          check_out: day,
          summary: z.string().max(200),
        })
        .refine((e) => e.check_out > e.check_in),
    )
    .min(1, "There is nothing to import.")
    .max(MAX_IMPORT_EVENTS, `Import at most ${MAX_IMPORT_EVENTS} stays at a time.`),
});

type Skipped = { check_in: string; check_out: string; summary: string };

/**
 * Stores the stays read from a calendar file for one home. A stay already imported (same UID for
 * this home) has its dates updated; everything the operator typed on it is kept. A stay whose
 * nights are already taken by another booking is not imported and is listed back.
 */
export const importBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(importSchema)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const a = access.agencyId;
    const db = context.supabase;
    const { data: home } = await db
      .from("hh_homes")
      .select("id,cleaning_fee_aed")
      .eq("id", data.home_id)
      .eq("agency_id", a)
      .maybeSingle();
    if (!home) throw new Error("Home not found.");

    const existing = await readAll((from, to) =>
      db
        .from("hh_bookings")
        .select("id,external_uid,check_in,check_out")
        .eq("agency_id", a)
        .eq("home_id", home.id)
        .not("external_uid", "is", null)
        .order("id")
        .range(from, to),
    );
    if (!existing.complete) throw new Error("This home has too many imported bookings to check.");
    const plan = planImport(data.events, existing.rows);

    const row = (e: IcsEvent) => ({
      agency_id: a,
      created_by: context.userId,
      home_id: home.id,
      guest_name: importedGuestName(e.summary, data.source),
      check_in: e.check_in,
      check_out: e.check_out,
      source: data.source,
      cleaning_fee_aed: Number(home.cleaning_fee_aed) || 0,
      external_uid: e.uid,
      notes: e.summary ? `Imported from a calendar file: ${e.summary}` : "",
    });
    const cols = "id,home_id,check_in,check_out,status,guest_name";
    const created: BookingForTasks[] = [];
    const clashes: Skipped[] = [];
    let failed = 0;

    if (plan.create.length) {
      // All at once when nothing clashes; otherwise one by one so only the clashing stays are left out.
      const all = await db.from("hh_bookings").insert(plan.create.map(row)).select(cols);
      if (!all.error) created.push(...(all.data ?? []));
      else
        for (const e of plan.create) {
          const one = await db.from("hh_bookings").insert(row(e)).select(cols).single();
          if (one.data) created.push(one.data);
          else if (one.error?.code === OVERLAP)
            clashes.push({ check_in: e.check_in, check_out: e.check_out, summary: e.summary });
          else failed++;
        }
    }

    let updated = 0;
    const moved: BookingForTasks[] = [];
    for (const u of plan.update) {
      const { data: saved, error } = await db
        .from("hh_bookings")
        .update({ check_in: u.event.check_in, check_out: u.event.check_out })
        .eq("id", u.id)
        .eq("agency_id", a)
        .select(cols);
      if (saved?.[0]) {
        updated++;
        moved.push(saved[0]);
      } else if (error?.code === OVERLAP)
        clashes.push({
          check_in: u.event.check_in,
          check_out: u.event.check_out,
          summary: u.event.summary,
        });
      else failed++;
    }

    let tasks = await ensureTasks(db, a, [...created, ...moved]);
    for (const b of moved) tasks = (await moveTasks(db, a, b)) && tasks;

    return {
      created: created.length,
      updated,
      unchanged: plan.unchanged,
      clashes,
      failed,
      tasks,
    };
  });

// ---------- tasks ----------

export const taskSchema = z.object({
  id: id.optional(),
  home_id: id,
  kind: z.enum(TASK_KIND_IDS),
  due_day: day,
  due_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:30"),
  assigned_to: z.string().trim().max(200),
  note: z.string().trim().max(2000),
});
export type TaskInput = z.infer<typeof taskSchema>;

/** Add a task for a home, or change when a task is due, who does it and its note. */
export const saveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(taskSchema)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const due_at = dubaiAt(data.due_day, data.due_time);
    if (data.id) {
      // The home and kind of an existing task stay as they are (automatic tasks belong to a booking).
      const { data: saved, error } = await db
        .from("hh_tasks")
        .update({ due_at, assigned_to: data.assigned_to, note: data.note })
        .eq("id", data.id)
        .eq("agency_id", access.agencyId)
        .select("id");
      if (error || !saved?.length) throw new Error("Could not save the task.");
      return { id: data.id };
    }
    const { data: home } = await db
      .from("hh_homes")
      .select("id")
      .eq("id", data.home_id)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!home) throw new Error("Home not found.");
    const { data: created, error } = await db
      .from("hh_tasks")
      .insert({
        home_id: home.id,
        kind: data.kind,
        due_at,
        assigned_to: data.assigned_to,
        note: data.note,
        agency_id: access.agencyId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error("Could not save the task.");
    return { id: created.id };
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id, status: z.enum(["todo", "done"]) }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { data: saved, error } = await context.supabase
      .from("hh_tasks")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !saved?.length) throw new Error("Could not update the task.");
    return { success: true };
  });

// ---------- payout statement ----------

/** One home and its bookings, for the printable draft payout statement. The maths is ownerPayout() in hh.ts. */
export const getPayoutSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const a = access.agencyId;
    const db = context.supabase;
    const { data: home } = await db
      .from("hh_homes")
      .select("id,name,building,community,owner_name,owner_phone,management_fee_percent")
      .eq("id", data)
      .eq("agency_id", a)
      .maybeSingle();
    if (!home) throw new Error("Home not found.");
    const bookings = await readAll((from, to) =>
      db
        .from("hh_bookings")
        .select(
          "id,guest_name,source,check_in,check_out,status,total_amount_aed,channel_fee_aed,cleaning_fee_aed",
        )
        .eq("agency_id", a)
        .eq("home_id", home.id)
        .order("check_out")
        .order("id")
        .range(from, to),
    );
    return {
      agencyName: access.agencyName,
      today: dubaiToday(),
      home,
      bookings: bookings.rows,
      complete: bookings.complete,
    };
  });
