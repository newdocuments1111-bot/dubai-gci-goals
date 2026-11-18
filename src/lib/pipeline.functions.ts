import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { getAccess, requireOwner } from "./agency-access";
import { AD_PLATFORMS, AD_STATUSES, BUYER_TYPES, OUTCOMES, TRACKS } from "./pipeline";

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) =>
  getAccess(context.supabase, context.userId);

/** Everything the pipeline board needs in one call: leads (own access rules), the rulebook, the agency's ads and the per-source numbers. */
export const getPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    const [
      { data: leads, error },
      { data: rules },
      { data: ads },
      { data: report },
      { data: members },
    ] = await Promise.all([
      context.supabase
        .from("leads")
        .select("*")
        .eq("agency_id", access.agencyId)
        .order("next_action_at", { ascending: true, nullsFirst: false }),
      context.supabase.from("lead_stages").select("*").order("stage"),
      context.supabase
        .from("ad_campaigns")
        .select("*")
        .eq("agency_id", access.agencyId)
        .order("name"),
      context.supabase.from("lead_report").select("*").eq("agency_id", access.agencyId),
      context.supabase
        .from("agency_members")
        .select("user_id,display_name,email")
        .eq("agency_id", access.agencyId)
        .in("role", ["owner", "agent"]),
    ]);
    if (error) throw new Error("Could not load the pipeline.");
    return {
      access,
      leads: leads ?? [],
      rules: rules ?? [],
      ads: ads ?? [],
      report: report ?? [],
      members: members ?? [],
    };
  });

/** Move a lead to a step by hand (drag on the board). The database applies the rulebook. */
export const moveLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), stage: z.number().int().min(1).max(15) }))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase
      .from("leads")
      .update({ stage: data.stage })
      .eq("id", data.id);
    if (error)
      throw new Error(
        error.message.includes("lost_reason")
          ? "A lost lead needs a reason."
          : "Could not move the lead.",
      );
    return { success: true };
  });

/** Pipeline fields the board edits. Stage name, who, next action and due date are set by the database, never here. */
export const updateLeadPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      stage: z.number().int().min(1).max(15).optional(),
      track: z.enum(TRACKS).optional(),
      outcome: z.enum(OUTCOMES).optional(),
      lost_reason: z.string().trim().max(500).nullable().optional(),
      ad_campaign_id: z.string().uuid().nullable().optional(),
      source_detail: z.string().trim().max(200).nullable().optional(),
      checklist_done: z.array(z.string().max(200)).max(20).optional(),
      assigned_agent_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { id, assigned_agent_id, ...fields } = data;
    if (assigned_agent_id !== undefined && !access.isOwner)
      throw new Error("Only the owner can reassign a lead.");
    // Send only the fields that were given, so an absent field never overwrites a value.
    const patch: Database["public"]["Tables"]["leads"]["Update"] = {};
    if (fields.stage !== undefined) patch.stage = fields.stage;
    if (fields.track !== undefined) patch.track = fields.track;
    if (fields.outcome !== undefined) patch.outcome = fields.outcome;
    if (fields.lost_reason !== undefined) patch.lost_reason = fields.lost_reason;
    if (fields.ad_campaign_id !== undefined) patch.ad_campaign_id = fields.ad_campaign_id;
    if (fields.source_detail !== undefined) patch.source_detail = fields.source_detail;
    if (fields.checklist_done !== undefined) patch.checklist_done = fields.checklist_done;
    if (assigned_agent_id !== undefined) patch.assigned_agent_id = assigned_agent_id;
    const { error } = await context.supabase.from("leads").update(patch).eq("id", id);
    if (error)
      throw new Error(
        error.message.includes("lost_reason")
          ? "A lost lead needs a reason."
          : "Could not update the lead.",
      );
    return { success: true };
  });

export const listLeadEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: events, error } = await context.supabase
      .from("lead_events")
      .select("*")
      .eq("lead_id", data)
      .order("at");
    if (error) throw new Error("Could not load the history.");
    return events ?? [];
  });

export const adSchema = z.object({
  name: z.string().trim().min(1).max(120),
  platform: z.enum(AD_PLATFORMS),
  buyer_type: z.enum(BUYER_TYPES).nullable(),
  offer: z.string().trim().max(300).nullable(),
  creative_type: z.string().trim().max(120).nullable(),
  daily_budget_aed: z.number().min(0).max(1_000_000).nullable(),
  spend_to_date_aed: z.number().min(0).max(100_000_000),
  status: z.enum(AD_STATUSES),
  started_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  ended_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

/** Owners manage ad campaigns; agents can read them (they pick the ad on a lead). */
export const saveAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(adSchema.extend({ id: z.string().uuid().optional() }))
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { id, ...fields } = data;
    const q = id
      ? context.supabase
          .from("ad_campaigns")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("agency_id", access.agencyId)
      : context.supabase.from("ad_campaigns").insert({ ...fields, agency_id: access.agencyId });
    const { error } = await q;
    if (error) throw new Error("Could not save the campaign.");
    return { success: true };
  });

export const deleteAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("ad_campaigns")
      .delete()
      .eq("id", data)
      .eq("agency_id", access.agencyId);
    if (error) throw new Error("Could not delete the campaign.");
    return { success: true };
  });
