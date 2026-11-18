import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess, requireOwner } from "./agency-access";
import {
  MAX_UNIT_LINES,
  buildSchedule,
  collectionTotals,
  dubaiToday,
  holdSchema,
  planProblems,
  planSchema,
  projectSchema,
  readPlan,
  saleSchema,
  unitSchema,
} from "./developer";

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };
type DbError = { code?: string; message: string } | null;

const PROJECT_COLS =
  "id,name,developer_name,community,handover_date,status,notes,payment_plan,created_at";
const UNIT_COLS = "id,unit_number,unit_type,bedrooms,size_sqft,floor,view,price_aed,status";
const PAGE = 1000;
const MAX_ROWS = 10_000;

/** Messages raised on purpose by the dev_* database functions are shown as they are; anything else is not. */
function check(error: DbError, fallback: string) {
  if (!error) return;
  throw new Error(error.code === "P0001" ? error.message : fallback);
}

/** Reads every row of a list, page by page, because one request returns at most 1,000 rows. */
async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError }>,
  fallback: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(fallback);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

/** Closes holds whose time has passed. Only a tidy-up: every screen already ignores ended holds. */
async function tidyHolds(context: Ctx) {
  try {
    await context.supabase.rpc("dev_release_expired_holds");
  } catch {
    // The page still shows the right status without it.
  }
}

async function ownProject(context: Ctx, agencyId: string, projectId: string) {
  const { data, error } = await context.supabase
    .from("dev_projects")
    .select(PROJECT_COLS)
    .eq("id", projectId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error || !data) throw new Error("Project not found.");
  return data;
}

/** Projects page: every project of the caller's agency with free / held / sold counts and money collected. */
export const getProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await getAccess(context.supabase, context.userId);
    await tidyHolds(context);
    const nowIso = new Date().toISOString();
    const { data: projects, error } = await context.supabase
      .from("dev_projects")
      .select(PROJECT_COLS)
      .eq("agency_id", access.agencyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load your projects.");

    const [liveHolds, instalments, counts] = await Promise.all([
      allRows(
        (from, to) =>
          context.supabase
            .from("dev_holds")
            .select("project_id,unit_id")
            .eq("agency_id", access.agencyId)
            .is("released_at", null)
            .gt("expires_at", nowIso)
            .order("id")
            .range(from, to),
        "Could not load the holds.",
      ),
      allRows(
        (from, to) =>
          context.supabase
            .from("dev_instalments")
            .select("project_id,amount_aed,due_date,paid_amount")
            .eq("agency_id", access.agencyId)
            .order("id")
            .range(from, to),
        "Could not load the instalments.",
      ),
      Promise.all(
        (projects ?? []).map(async (p) => {
          const count = (sold: boolean) => {
            const q = context.supabase
              .from("dev_units")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", access.agencyId)
              .eq("project_id", p.id);
            return sold ? q.eq("status", "sold") : q;
          };
          const [all, sold] = await Promise.all([count(false), count(true)]);
          if (all.error || sold.error) throw new Error("Could not count the units.");
          return { id: p.id, total: all.count ?? 0, sold: sold.count ?? 0 };
        }),
      ),
    ]);

    const today = dubaiToday();
    return {
      isOwner: access.isOwner,
      projects: (projects ?? []).map((p) => {
        const c = counts.find((x) => x.id === p.id)!;
        // A sold unit has no live hold, so held units are exactly the units with one.
        const held = Math.min(
          new Set(liveHolds.filter((h) => h.project_id === p.id).map((h) => h.unit_id)).size,
          c.total - c.sold,
        );
        return {
          id: p.id,
          name: p.name,
          developer_name: p.developer_name,
          community: p.community,
          handover_date: p.handover_date,
          status: p.status,
          counts: { free: c.total - c.sold - held, held, sold: c.sold },
          totals: collectionTotals(
            instalments.filter((i) => i.project_id === p.id),
            today,
          ),
        };
      }),
    };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(projectSchema)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("dev_projects")
      .insert({
        ...data,
        handover_date: data.handover_date || null,
        agency_id: access.agencyId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not create the project.");
    return { id: row.id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(projectSchema.extend({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { projectId, ...fields } = data;
    const { data: rows, error } = await context.supabase
      .from("dev_projects")
      .update({ ...fields, handover_date: fields.handover_date || null })
      .eq("id", projectId)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !rows?.length) throw new Error("Could not save the project.");
    return { success: true };
  });

/** One project's page: units with their open hold, sales, instalments and the payment plan. */
export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data: projectId, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const project = await ownProject(context, access.agencyId, projectId);
    await tidyHolds(context);

    const [units, instalments, holdsResult, salesResult, membersResult, leadsResult] =
      await Promise.all([
        allRows(
          (from, to) =>
            context.supabase
              .from("dev_units")
              .select(UNIT_COLS)
              .eq("agency_id", access.agencyId)
              .eq("project_id", projectId)
              .order("unit_number")
              .order("id")
              .range(from, to),
          "Could not load the units.",
        ),
        allRows(
          (from, to) =>
            context.supabase
              .from("dev_instalments")
              .select("id,sale_id,position,label,amount_aed,due_date,paid_at,paid_amount")
              .eq("agency_id", access.agencyId)
              .eq("project_id", projectId)
              .order("due_date", { nullsFirst: false })
              .order("id")
              .range(from, to),
          "Could not load the instalments.",
        ),
        // Open holds only. Ended ones are filtered again on the page by their end time.
        context.supabase
          .from("dev_holds")
          .select(
            "id,unit_id,client_name,client_phone,broker_name,broker_agency,broker_phone,notes,held_by,created_at,expires_at,released_at",
          )
          .eq("agency_id", access.agencyId)
          .eq("project_id", projectId)
          .is("released_at", null)
          .limit(PAGE),
        context.supabase
          .from("dev_sales")
          .select(
            "id,unit_id,lead_id,buyer_name,buyer_phone,sale_price_aed,sale_date,broker_name,broker_agency,broker_phone,broker_commission_percent,sold_by",
          )
          .eq("agency_id", access.agencyId)
          .eq("project_id", projectId)
          .order("sale_date", { ascending: false })
          .limit(PAGE),
        context.supabase
          .from("agency_members")
          .select("user_id,display_name")
          .eq("agency_id", access.agencyId),
        context.supabase
          .from("leads")
          .select("id,name,phone")
          .eq("agency_id", access.agencyId)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);
    if (holdsResult.error || salesResult.error) throw new Error("Could not load the project.");

    return {
      isOwner: access.isOwner,
      userId: context.userId,
      project: {
        id: project.id,
        name: project.name,
        developer_name: project.developer_name,
        community: project.community,
        handover_date: project.handover_date,
        status: project.status,
        notes: project.notes,
      },
      plan: readPlan(project.payment_plan),
      units,
      holds: holdsResult.data ?? [],
      sales: salesResult.data ?? [],
      instalments,
      members: membersResult.data ?? [],
      leads: leadsResult.data ?? [],
    };
  });

/** Add one unit or change its details. The status is never changed here: holds and sales do that. */
export const saveUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    unitSchema.extend({ projectId: z.string().uuid(), unitId: z.string().uuid().nullable() }),
  )
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { projectId, unitId, ...fields } = data;
    await ownProject(context, access.agencyId, projectId);
    const result = unitId
      ? await context.supabase
          .from("dev_units")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", unitId)
          .eq("project_id", projectId)
          .eq("agency_id", access.agencyId)
          .select("id")
      : await context.supabase
          .from("dev_units")
          .insert({ ...fields, project_id: projectId, agency_id: access.agencyId })
          .select("id");
    if (result.error?.code === "23505")
      throw new Error(`Unit ${fields.unit_number} already exists in this project.`);
    if (result.error || !result.data?.length) throw new Error("Could not save the unit.");
    return { id: result.data[0]!.id };
  });

/** Add many units at once. Unit numbers that already exist in the project are left as they are. */
export const addUnits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      projectId: z.string().uuid(),
      units: z.array(unitSchema).min(1).max(MAX_UNIT_LINES),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    await ownProject(context, access.agencyId, data.projectId);
    const { data: added, error } = await context.supabase
      .from("dev_units")
      .upsert(
        data.units.map((u) => ({ ...u, project_id: data.projectId, agency_id: access.agencyId })),
        { onConflict: "project_id,unit_number", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error("Could not add the units.");
    const count = added?.length ?? 0;
    return { added: count, skipped: data.units.length - count };
  });

/** Save the project's payment plan. It is used for sales recorded from now on; existing schedules stay. */
export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid(), plan: planSchema }))
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const problems = planProblems(data.plan);
    if (problems.length) return { error: problems.join(" ") };
    const { data: rows, error } = await context.supabase
      .from("dev_projects")
      .update({ payment_plan: data.plan })
      .eq("id", data.projectId)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !rows?.length) throw new Error("Could not save the payment plan.");
    return { error: "" };
  });

/** Hold a unit for a client. The database decides who was first; a second hold is refused. */
export const holdUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(holdSchema)
  .handler(async ({ data, context }) => {
    await getAccess(context.supabase, context.userId);
    const { data: id, error } = await context.supabase.rpc("dev_hold_unit", {
      _unit: data.unitId,
      _client_name: data.client_name,
      _client_phone: data.client_phone,
      _hours: data.hours,
      _broker_name: data.broker_name,
      _broker_agency: data.broker_agency,
      _broker_phone: data.broker_phone,
      _notes: data.notes,
    });
    check(error, "Could not hold the unit.");
    return { id };
  });

export const releaseHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data: holdId, context }) => {
    await getAccess(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("dev_release_hold", { _hold: holdId });
    check(error, "Could not release the hold.");
    return { success: true };
  });

/**
 * Mark a unit sold (or turn its hold into a sale). The instalments come from the project's payment
 * plan and are written together with the sale, so a sale never exists without its schedule.
 */
export const sellUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(saleSchema)
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const { data: unit } = await context.supabase
      .from("dev_units")
      .select("id,project_id")
      .eq("id", data.unitId)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!unit) throw new Error("Unit not found.");
    const project = await ownProject(context, access.agencyId, unit.project_id);
    const plan = readPlan(project.payment_plan);
    if (planProblems(plan).length)
      return {
        error:
          "This project has no complete payment plan yet. The owner sets it on the Payment plan tab; then the sale can be recorded.",
      };
    const schedule = buildSchedule(plan, {
      priceAed: data.sale_price_aed,
      saleDate: data.sale_date,
      handoverDate: project.handover_date,
    });
    const { data: saleId, error } = await context.supabase.rpc("dev_sell_unit", {
      _unit: data.unitId,
      _hold: data.holdId,
      _buyer_name: data.buyer_name,
      _buyer_phone: data.buyer_phone,
      _lead: data.leadId,
      _sale_price_aed: data.sale_price_aed,
      _sale_date: data.sale_date,
      _broker_name: data.broker_name,
      _broker_agency: data.broker_agency,
      _broker_phone: data.broker_phone,
      _broker_commission_percent: data.broker_name ? data.broker_commission_percent : 0,
      _instalments: schedule.map((s) => ({
        label: s.label,
        amount_aed: s.amount_aed,
        due_date: s.due_date ?? "",
      })),
    });
    check(error, "Could not record the sale.");
    return { error: "", id: saleId, instalments: schedule.length };
  });

/** Undo a sale entered by mistake. Owner only, and refused once a payment is recorded on it. */
export const cancelSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data: saleId, context }) => {
    await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("dev_cancel_sale", { _sale: saleId });
    check(error, "Could not undo the sale.");
    return { success: true };
  });

/** Record a payment on an instalment, or clear it again (amount null). Owner only. */
export const markInstalment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      instalmentId: z.string().uuid(),
      paidAmount: z.number().finite().positive().max(10_000_000_000).nullable(),
      paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("dev_instalments")
      .select("id,amount_aed")
      .eq("id", data.instalmentId)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!row) throw new Error("Instalment not found.");
    if (data.paidAmount !== null && data.paidAmount > Number(row.amount_aed))
      return { error: "That is more than this instalment. Enter the amount received for it." };
    if (data.paidAmount !== null && data.paidOn > dubaiToday())
      return { error: "The payment date cannot be in the future." };
    const { data: rows, error } = await context.supabase
      .from("dev_instalments")
      .update(
        data.paidAmount === null
          ? { paid_amount: null, paid_at: null, paid_by: null }
          : {
              paid_amount: Math.round(data.paidAmount * 100) / 100,
              // Midday in Dubai, so the date reads the same in every time zone nearby.
              paid_at: `${data.paidOn}T12:00:00+04:00`,
              paid_by: context.userId,
            },
      )
      .eq("id", data.instalmentId)
      .eq("agency_id", access.agencyId)
      .select("id");
    if (error || !rows?.length) throw new Error("Could not save the payment.");
    return { error: "" };
  });

/** Writes the price-list download to the activity log before the file is made on the device. */
export const logPriceListExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ projectId: z.string().uuid(), count: z.number().int().min(0).max(MAX_ROWS) }),
  )
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    const project = await ownProject(context, access.agencyId, data.projectId);
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { error } = await admin.from("audit_log").insert({
      agency_id: access.agencyId,
      actor_id: context.userId,
      entity: "export",
      entity_id: project.id,
      action: "Data exported",
      detail: `Price list (free units), ${project.name}: ${data.count} rows`.slice(0, 500),
    });
    if (error) throw new Error("Could not record the export, so nothing was downloaded.");
    return { success: true };
  });
