import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess, requireOwner } from "./agency-access";

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };
const guard = (context: Ctx) => getAccess(context.supabase, context.userId);

/** Inbox: the newest leads the caller may see, the agency pool, listings to match and the team. */
export const getInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    // Send untouched routed leads back to the pool before showing anything (also runs every 5 minutes).
    await context.supabase.rpc("return_untouched_leads");
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [
      { data: leads, error },
      { data: pool },
      { data: listings },
      { data: members },
      { data: settings },
    ] = await Promise.all([
      context.supabase
        .from("leads")
        .select(
          "id,name,phone,email,source,source_detail,area,budget,type,language,enquiry,portal_ref,intake,created_at,first_reply_at,assigned_agent_id,assigned_at,routed,stage,stage_name,outcome,score",
        )
        .eq("agency_id", access.agencyId)
        .not("assigned_agent_id", "is", null)
        .neq("intake", "import")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase.rpc("pool_leads"),
      context.supabase
        .from("listings")
        .select("id,title,community,project,price_aed,bedrooms,status")
        .eq("agency_id", access.agencyId)
        .eq("status", "Available")
        .limit(500),
      context.supabase
        .from("agency_members")
        .select("user_id,display_name,email,role,in_rotation")
        .eq("agency_id", access.agencyId)
        .in("role", ["owner", "agent"]),
      context.supabase
        .from("app_settings")
        .select("pool_after_minutes,pool_daily_limit")
        .eq("agency_id", access.agencyId)
        .maybeSingle(),
    ]);
    if (error) throw new Error("Could not load the inbox.");
    return {
      access,
      leads: leads ?? [],
      pool: pool ?? [],
      listings: listings ?? [],
      members: members ?? [],
      poolAfterMinutes: settings?.pool_after_minutes ?? 15,
      poolDailyLimit: settings?.pool_daily_limit ?? 5,
    };
  });

export const claimLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: result, error } = await context.supabase.rpc("claim_pool_lead", { _lead: data });
    if (error) throw new Error("Could not take the lead.");
    if (result !== "ok") throw new Error(result);
    return { success: true };
  });

/** Routing page: rules, who is in the rotation, pool settings and the intake key. Owner only. */
export const getRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const [{ data: rules, error }, { data: members }, { data: settings }, { data: intake }] =
      await Promise.all([
        context.supabase
          .from("routing_rules")
          .select("*")
          .eq("agency_id", access.agencyId)
          .order("position")
          .order("created_at"),
        context.supabase
          .from("agency_members")
          .select("user_id,display_name,email,role,in_rotation")
          .eq("agency_id", access.agencyId)
          .in("role", ["owner", "agent"]),
        context.supabase
          .from("app_settings")
          .select("pool_after_minutes,pool_daily_limit,nurture_days")
          .eq("agency_id", access.agencyId)
          .maybeSingle(),
        context.supabase
          .from("lead_intake")
          .select("token,enabled,last_used_at")
          .eq("agency_id", access.agencyId)
          .maybeSingle(),
      ]);
    if (error) throw new Error("Could not load routing.");
    return {
      rules: rules ?? [],
      members: members ?? [],
      poolAfterMinutes: settings?.pool_after_minutes ?? 15,
      poolDailyLimit: settings?.pool_daily_limit ?? 5,
      nurtureDays: settings?.nurture_days ?? 30,
      intake: intake ?? null,
    };
  });

export const ruleSchema = z.object({
  kind: z.enum(["area", "language", "source"]),
  value: z.string().trim().min(1).max(100),
  agent_id: z.string().uuid(),
});

export const addRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ruleSchema)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("routing_rules")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", access.agencyId);
    if ((count ?? 0) >= 50) throw new Error("Up to 50 rules.");
    const { error } = await context.supabase
      .from("routing_rules")
      .insert({ ...data, agency_id: access.agencyId, position: count ?? 0 });
    if (error) throw new Error("Could not add the rule. Pick an agent from your team.");
    return { success: true };
  });

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("routing_rules")
      .delete()
      .eq("id", data)
      .eq("agency_id", access.agencyId);
    if (error) throw new Error("Could not remove the rule.");
    return { success: true };
  });

export const setRotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), on: z.boolean() }))
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("set_rotation", {
      _user: data.userId,
      _on: data.on,
    });
    if (error) throw new Error("Could not change the rotation.");
    return { success: true };
  });

export const savePoolSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pool_after_minutes: z.number().int().min(5).max(1440),
      pool_daily_limit: z.number().int().min(1).max(100),
      nurture_days: z.number().int().min(0).max(365),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert(
        { agency_id: access.agencyId, ...data, updated_at: new Date().toISOString() },
        { onConflict: "agency_id" },
      );
    if (error) throw new Error("Could not save the pool settings.");
    return { success: true };
  });

export const rotateIntakeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("rotate_intake_key");
    if (error || !data) throw new Error("Could not create the key.");
    return { token: data };
  });
