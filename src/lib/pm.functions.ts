import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess, requireOwner } from "./agency-access";
import { MAX_CHEQUES, UNIT_TYPES, chequeSchedule, dubaiToday } from "./pm";

type Client = Parameters<typeof getAccess>[0];
const guard = (context: { supabase: Client; userId: string }) =>
  getAccess(context.supabase, context.userId);

const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-18");
const money = z.number().min(0).max(1_000_000_000);

const UNIT_COLS =
  "id,owner_id,building,unit_number,community,unit_type,bedrooms,size_sqft,status,management_fee_percent,notes,created_at";
const LEASE_COLS =
  "id,unit_id,tenant_name,tenant_phone,tenant_email,lead_id,start_date,end_date,annual_rent_aed,cheque_count,deposit_aed,ejari_number,status,proposed_rent,renewal_note,created_at";
const CHEQUE_COLS = "id,lease_id,seq,amount_aed,due_date,status,bank_date,cleared_on,note";
const TICKET_COLS =
  "id,unit_id,title,description,reported_by,priority,status,contractor_name,contractor_phone,cost_aed,who_pays,opened_on,closed_on,created_at";

const PAGE = 1000;
const MAX_PAGES = 20;

/** Reads every row of a query in pages, because one request returns at most 1,000 rows. */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error("Could not load managed properties.");
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** Everything the Managed page shows, for the caller's own agency only. */
export const getManaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    const a = access.agencyId;
    const db = context.supabase;
    const [owners, units, leases, cheques, tickets, { data: leads }] = await Promise.all([
      readAll((from, to) =>
        db
          .from("owners")
          .select("id,name,phone")
          .eq("agency_id", a)
          .order("name")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("pm_units")
          .select(UNIT_COLS)
          .eq("agency_id", a)
          .order("building")
          .order("unit_number")
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("pm_leases")
          .select(LEASE_COLS)
          .eq("agency_id", a)
          .order("end_date", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("pm_cheques")
          .select(CHEQUE_COLS)
          .eq("agency_id", a)
          .order("due_date", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("pm_tickets")
          .select(TICKET_COLS)
          .eq("agency_id", a)
          .order("opened_on", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      // Only used to link a tenant to an existing lead; a failure here must not hide the page.
      db
        .from("leads")
        .select("id,name,phone")
        .eq("agency_id", a)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    return {
      agencyName: access.agencyName,
      isOwner: access.isOwner,
      today: dubaiToday(),
      owners: owners.rows,
      units: units.rows,
      leases: leases.rows,
      cheques: cheques.rows,
      tickets: tickets.rows,
      leads: leads ?? [],
      /** False when there are more rows than the page reads; the screen says so instead of hiding it. */
      complete:
        owners.complete &&
        units.complete &&
        leases.complete &&
        cheques.complete &&
        tickets.complete,
    };
  });

// ---------- units ----------

export const unitSchema = z.object({
  id: id.optional(),
  owner_id: id,
  building: z.string().trim().min(1, "Building is required").max(200),
  unit_number: z.string().trim().max(50),
  community: z.string().trim().max(200),
  unit_type: z.enum(UNIT_TYPES),
  bedrooms: z.number().int().min(0).max(50).nullable(),
  size_sqft: z.number().min(0).max(10_000_000).nullable(),
  status: z.enum(["occupied", "empty", "notice"]),
  management_fee_percent: z.number().min(0).max(100),
  notes: z.string().trim().max(2000),
});
export type UnitInput = z.infer<typeof unitSchema>;

export const saveUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(unitSchema)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { id: unitId, ...fields } = data;
    const { data: owner } = await context.supabase
      .from("owners")
      .select("id")
      .eq("id", fields.owner_id)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!owner) throw new Error("Landlord not found. Add them on the Owners page first.");
    if (unitId) {
      const { data: saved, error } = await context.supabase
        .from("pm_units")
        .update(fields)
        .eq("id", unitId)
        .eq("agency_id", access.agencyId)
        .select("id");
      if (error || !saved?.length) throw new Error("Could not save the unit.");
      return { id: unitId };
    }
    const { data: created, error } = await context.supabase
      .from("pm_units")
      .insert({ ...fields, agency_id: access.agencyId, created_by: context.userId })
      .select("id")
      .single();
    if (error || !created) throw new Error("Could not save the unit.");
    return { id: created.id };
  });

/** Owner only, and only for a unit with no leases or maintenance jobs: history is never deleted with it. */
export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data: gone, error } = await context.supabase
      .from("pm_units")
      .delete()
      .eq("id", data)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error)
      return {
        error:
          "This unit has leases or maintenance jobs, so it cannot be deleted. Set it to Empty instead.",
      };
    if (!gone?.length) return { error: "Unit not found." };
    return { success: true };
  });

// ---------- leases ----------

export const leaseSchema = z
  .object({
    id: id.optional(),
    unit_id: id,
    tenant_name: z.string().trim().min(1, "Tenant name is required").max(200),
    tenant_phone: z.string().trim().max(50),
    tenant_email: z.union([z.literal(""), z.string().trim().email("Check the email").max(200)]),
    lead_id: id.nullable(),
    start_date: day,
    end_date: day,
    annual_rent_aed: money.refine((n) => n > 0, "Annual rent is required"),
    cheque_count: z.number().int().min(1).max(MAX_CHEQUES),
    deposit_aed: money,
    ejari_number: z.string().trim().max(100),
    /** When this lease replaces an earlier one, that lease is marked renewed first. */
    renews_lease_id: id.nullable().default(null),
  })
  .refine((l) => l.end_date > l.start_date, { message: "The end date must be after the start." });
export type LeaseInput = z.input<typeof leaseSchema>;

async function insertCheques(
  db: Client,
  agencyId: string,
  lease: { id: string; annual_rent_aed: number; cheque_count: number; start_date: string },
) {
  const rows = chequeSchedule(
    Number(lease.annual_rent_aed),
    lease.cheque_count,
    lease.start_date,
  ).map((c) => ({ ...c, lease_id: lease.id, agency_id: agencyId }));
  if (!rows.length) return false;
  const { error } = await db.from("pm_cheques").insert(rows);
  return !error;
}

/**
 * Add a lease (with its cheque schedule) or correct an existing one. Editing never rewrites cheques that
 * already exist, because some may have been banked.
 */
export const saveLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(leaseSchema)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const { id: leaseId, renews_lease_id, ...fields } = data;
    const { data: unit } = await db
      .from("pm_units")
      .select("id")
      .eq("id", fields.unit_id)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!unit) throw new Error("Unit not found.");
    if (fields.lead_id) {
      const { data: lead } = await db
        .from("leads")
        .select("id")
        .eq("id", fields.lead_id)
        .eq("agency_id", access.agencyId)
        .maybeSingle();
      if (!lead) throw new Error("Lead not found.");
    }
    if (leaseId) {
      const { unit_id: _unit, ...editable } = fields;
      const { data: saved, error } = await db
        .from("pm_leases")
        .update(editable)
        .eq("id", leaseId)
        .eq("agency_id", access.agencyId)
        .select("id");
      if (error || !saved?.length) throw new Error("Could not save the lease.");
      return { id: leaseId, cheques: true };
    }
    if (renews_lease_id) {
      const { data: old, error } = await db
        .from("pm_leases")
        .update({ status: "renewed" })
        .eq("id", renews_lease_id)
        .eq("unit_id", fields.unit_id)
        .eq("agency_id", access.agencyId)
        .select("id");
      if (error || !old?.length) throw new Error("Could not mark the earlier lease as renewed.");
    }
    const { data: lease, error } = await db
      .from("pm_leases")
      .insert({ ...fields, agency_id: access.agencyId, created_by: context.userId })
      .select("id,annual_rent_aed,cheque_count,start_date")
      .single();
    if (error || !lease) {
      // Put the earlier lease back so the unit is not left without an active lease.
      if (renews_lease_id)
        await db
          .from("pm_leases")
          .update({ status: "active" })
          .eq("id", renews_lease_id)
          .eq("agency_id", access.agencyId);
      if (error?.code === "23505")
        return {
          error: "This unit already has an active lease. End it or record a renewal first.",
        };
      throw new Error("Could not save the lease.");
    }
    const cheques = await insertCheques(db, access.agencyId, lease);
    await db
      .from("pm_units")
      .update({ status: "occupied" })
      .eq("id", fields.unit_id)
      .eq("agency_id", access.agencyId);
    return { id: lease.id, cheques };
  });

/** Creates the cheque schedule for a lease that has none (for example after a failed first try). */
export const createLeaseCheques = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const { data: lease } = await db
      .from("pm_leases")
      .select("id,annual_rent_aed,cheque_count,start_date")
      .eq("id", data)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!lease) throw new Error("Lease not found.");
    const { count, error } = await db
      .from("pm_cheques")
      .select("id", { count: "exact", head: true })
      .eq("lease_id", lease.id)
      .eq("agency_id", access.agencyId);
    if (error) throw new Error("Could not check the cheques.");
    if ((count ?? 0) > 0) return { error: "This lease already has cheques." };
    if (!(await insertCheques(db, access.agencyId, lease)))
      throw new Error("Could not create the cheques.");
    return { success: true };
  });

/** End a lease (the unit becomes empty) or reopen one. A renewal is recorded by adding the new lease. */
export const setLeaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id, status: z.enum(["active", "ended"]) }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const { data: saved, error } = await db
      .from("pm_leases")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .select("unit_id");
    if (error?.code === "23505") return { error: "This unit already has another active lease." };
    if (error || !saved?.[0]) throw new Error("Could not update the lease.");
    await db
      .from("pm_units")
      .update({ status: data.status === "ended" ? "empty" : "occupied" })
      .eq("id", saved[0].unit_id)
      .eq("agency_id", access.agencyId);
    return { success: true };
  });

/** Renewal notes: the proposed rent is free text typed by a person; nothing is calculated. */
export const saveRenewalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id,
      proposed_rent: z.string().trim().max(100),
      renewal_note: z.string().trim().max(1000),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { data: saved, error } = await context.supabase
      .from("pm_leases")
      .update({ proposed_rent: data.proposed_rent, renewal_note: data.renewal_note })
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !saved?.length) throw new Error("Could not save the renewal note.");
    return { success: true };
  });

// ---------- cheques ----------

/** Record what happened to a cheque. This is the agency's own record; no bank is contacted. */
export const setChequeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id,
      status: z.enum(["pending", "banked", "cleared", "bounced"]),
      /** The day it was banked or cleared; today in Dubai when left out. */
      date: day.optional(),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const { data: cheque } = await db
      .from("pm_cheques")
      .select("id,bank_date")
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!cheque) throw new Error("Cheque not found.");
    const on = data.date ?? dubaiToday();
    const dates =
      data.status === "pending"
        ? { bank_date: null, cleared_on: null }
        : data.status === "banked"
          ? { bank_date: on, cleared_on: null }
          : data.status === "cleared"
            ? { bank_date: cheque.bank_date ?? on, cleared_on: on }
            : { cleared_on: null };
    const { data: saved, error } = await db
      .from("pm_cheques")
      .update({
        status: data.status,
        ...dates,
        ...(data.note === undefined ? {} : { note: data.note }),
      })
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !saved?.length) throw new Error("Could not update the cheque.");
    return { success: true };
  });

// ---------- maintenance ----------

export const ticketSchema = z.object({
  id: id.optional(),
  unit_id: id,
  title: z.string().trim().min(1, "Say what the problem is").max(200),
  description: z.string().trim().max(2000),
  reported_by: z.string().trim().max(200),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  status: z.enum(["open", "assigned", "done", "cancelled"]),
  contractor_name: z.string().trim().max(200),
  contractor_phone: z.string().trim().max(50),
  cost_aed: money.nullable(),
  who_pays: z.enum(["owner", "tenant", "company"]),
  opened_on: day,
  closed_on: day.nullable(),
});
export type TicketInput = z.infer<typeof ticketSchema>;

const closedDate = (status: string, closedOn: string | null) =>
  status === "done" || status === "cancelled" ? (closedOn ?? dubaiToday()) : null;

export const saveTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ticketSchema)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const db = context.supabase;
    const { id: ticketId, ...fields } = data;
    const { data: unit } = await db
      .from("pm_units")
      .select("id")
      .eq("id", fields.unit_id)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!unit) throw new Error("Unit not found.");
    const row = { ...fields, closed_on: closedDate(fields.status, fields.closed_on) };
    if (ticketId) {
      const { data: saved, error } = await db
        .from("pm_tickets")
        .update(row)
        .eq("id", ticketId)
        .eq("agency_id", access.agencyId)
        .select("id");
      if (error || !saved?.length) throw new Error("Could not save the job.");
      return { id: ticketId };
    }
    const { data: created, error } = await db
      .from("pm_tickets")
      .insert({ ...row, agency_id: access.agencyId, created_by: context.userId })
      .select("id")
      .single();
    if (error || !created) throw new Error("Could not save the job.");
    return { id: created.id };
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id, status: z.enum(["open", "assigned", "done", "cancelled"]) }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { data: saved, error } = await context.supabase
      .from("pm_tickets")
      .update({ status: data.status, closed_on: closedDate(data.status, null) })
      .eq("id", data.id)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !saved?.length) throw new Error("Could not update the job.");
    return { success: true };
  });

// ---------- landlord statement ----------

/** The rows a draft statement for one landlord is built from. The maths is in tested pm.ts. */
export const getStatementSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(id)
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const a = access.agencyId;
    const db = context.supabase;
    const { data: owner } = await db
      .from("owners")
      .select("id,name,phone")
      .eq("id", data)
      .eq("agency_id", a)
      .maybeSingle();
    if (!owner) throw new Error("Landlord not found.");
    const { data: units, error } = await db
      .from("pm_units")
      .select("id,building,unit_number,community,management_fee_percent")
      .eq("agency_id", a)
      .eq("owner_id", owner.id)
      .order("building")
      .order("unit_number");
    if (error) throw new Error("Could not load the statement.");
    const unitIds = (units ?? []).map((u) => u.id);
    if (!unitIds.length)
      return {
        agencyName: access.agencyName,
        owner,
        units: [],
        leases: [],
        cheques: [],
        tickets: [],
        complete: true,
      };
    const [leases, tickets] = await Promise.all([
      readAll((from, to) =>
        db
          .from("pm_leases")
          .select("id,unit_id")
          .eq("agency_id", a)
          .in("unit_id", unitIds)
          .order("id")
          .range(from, to),
      ),
      readAll((from, to) =>
        db
          .from("pm_tickets")
          .select("unit_id,title,status,who_pays,cost_aed,opened_on,closed_on")
          .eq("agency_id", a)
          .in("unit_id", unitIds)
          .eq("who_pays", "owner")
          .eq("status", "done")
          .order("id")
          .range(from, to),
      ),
    ]);
    const leaseIds = leases.rows.map((l) => l.id);
    const cheques = leaseIds.length
      ? await readAll((from, to) =>
          db
            .from("pm_cheques")
            .select("lease_id,amount_aed,status,due_date,bank_date,cleared_on")
            .eq("agency_id", a)
            .in("lease_id", leaseIds)
            .eq("status", "cleared")
            .order("id")
            .range(from, to),
        )
      : { rows: [], complete: true };
    return {
      agencyName: access.agencyName,
      owner,
      units: units ?? [],
      leases: leases.rows,
      cheques: cheques.rows,
      tickets: tickets.rows,
      complete: leases.complete && tickets.complete && cheques.complete,
    };
  });
