import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess } from "./agency-access";
import { LEAD_SOURCES } from "./inbox";
import { phoneKey } from "./lead-import";
import { timezoneFromPhone } from "./leads-app";
import { filterSchema } from "./lists";

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };
const guard = (context: Ctx) => getAccess(context.supabase, context.userId);

const importLead = z.object({
  name: z.string().trim().max(200),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+\d{8,15})?$/),
  email: z.string().trim().max(200),
  source: z.enum(LEAD_SOURCES),
  area: z.string().trim().max(200),
  budget: z.string().trim().max(200),
  type: z.enum(["buyer", "seller", "landlord", "tenant", "other"]),
  language: z.enum(["en", "ar", "hi", "ru"]),
  enquiry: z.string().trim().max(2000),
  created_at: z.string().datetime().nullable(),
});

/**
 * Import a batch of leads (the browser sends 200 at a time). Phone numbers the agency already has are skipped.
 * Owners choose who gets them (one agent, or the routing rules); agents import to themselves.
 */
export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leads: z.array(importLead).min(1).max(200),
      assign: z.union([z.literal("routing"), z.string().uuid()]),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const assignee = !access.isOwner
      ? context.userId
      : data.assign === "routing"
        ? null
        : data.assign;
    const { data: existing, error: readError } = await context.supabase
      .from("leads")
      .select("phone")
      .eq("agency_id", access.agencyId)
      .neq("phone", "")
      .limit(20000);
    if (readError) throw new Error("Could not check for duplicates.");
    const have = new Set((existing ?? []).map((l) => phoneKey(l.phone)));
    const fresh = data.leads.filter((l) => {
      if (!l.phone) return true;
      const k = phoneKey(l.phone);
      if (have.has(k)) return false;
      have.add(k);
      return true;
    });
    if (fresh.length === 0) return { imported: 0, duplicates: data.leads.length };
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("leads").insert(
      fresh.map((l) => ({
        agency_id: access.agencyId,
        assigned_agent_id: assignee,
        intake: "import",
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        area: l.area,
        budget: l.budget,
        type: l.type,
        language: l.language,
        enquiry: l.enquiry,
        timezone: timezoneFromPhone(l.phone),
        created_at: l.created_at ?? now,
      })),
    );
    if (error) {
      console.error("Lead import failed", error.message);
      throw new Error(
        error.message.startsWith("Choose") ? error.message : "Could not import these leads.",
      );
    }
    return { imported: fresh.length, duplicates: data.leads.length - fresh.length };
  });

const CALL_OUTCOMES = ["answered", "no_answer", "call_back", "wrong_number"] as const;

export const logCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leadId: z.string().uuid(),
      outcome: z.enum(CALL_OUTCOMES),
      note: z.string().trim().max(1000),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { error } = await context.supabase.from("lead_calls").insert({
      agency_id: access.agencyId,
      lead_id: data.leadId,
      outcome: data.outcome,
      note: data.note,
    });
    if (error) throw new Error("Could not log the call. You can only log calls on your own leads.");
    return { success: true };
  });

export const listCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const [{ data: calls, error }, { data: members }] = await Promise.all([
      context.supabase
        .from("lead_calls")
        .select("id,outcome,note,created_at,user_id")
        .eq("lead_id", data)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("agency_members")
        .select("user_id,display_name,email")
        .eq("agency_id", access.agencyId),
    ]);
    if (error) throw new Error("Could not load the calls.");
    const name = (id: string) => {
      const m = (members ?? []).find((x) => x.user_id === id);
      return m ? m.display_name || m.email || "Agent" : "Former member";
    };
    return (calls ?? []).map((c) => ({ ...c, by: name(c.user_id) }));
  });

export const getSavedLists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    const { data, error } = await context.supabase
      .from("saved_lists")
      .select("id,name,filters")
      .eq("agency_id", access.agencyId)
      .eq("user_id", context.userId)
      .order("created_at");
    if (error) throw new Error("Could not load your lists.");
    // A list saved by an older version may hold values we no longer know: drop it from view instead of failing.
    return (data ?? []).flatMap((l) => {
      const f = filterSchema.safeParse(l.filters);
      return f.success ? [{ id: l.id, name: l.name, filters: f.data }] : [];
    });
  });

export const saveList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(60), filters: filterSchema }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { count } = await context.supabase
      .from("saved_lists")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if ((count ?? 0) >= 30) throw new Error("Up to 30 lists. Remove one first.");
    const { error } = await context.supabase
      .from("saved_lists")
      .insert({ agency_id: access.agencyId, name: data.name, filters: data.filters });
    if (error) throw new Error("Could not save the list.");
    return { success: true };
  });

export const deleteList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase
      .from("saved_lists")
      .delete()
      .eq("id", data)
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not remove the list.");
    return { success: true };
  });
