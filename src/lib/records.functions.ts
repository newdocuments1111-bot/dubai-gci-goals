import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "./agency-access";
import { EXPORT_KINDS, EXPORT_LABELS, type ExportKind } from "./records";

const EXPORT_LIMIT = 20000;
type ExportRow = Record<string, string | number | boolean | null>;

/** Activity log: who changed what and when. Owner only; rows are written by database triggers and cannot be edited. */
export const getActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entity: z.string().max(30).default("") }))
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    let q = context.supabase
      .from("audit_log")
      .select("id,at,actor_id,entity,action,detail")
      .eq("agency_id", access.agencyId)
      .order("at", { ascending: false })
      .order("id", { ascending: false })
      .limit(300);
    if (data.entity) q = q.eq("entity", data.entity);
    const [{ data: rows, error }, { data: members }] = await Promise.all([
      q,
      context.supabase
        .from("agency_members")
        .select("user_id,display_name,email")
        .eq("agency_id", access.agencyId),
    ]);
    if (error) throw new Error("Could not load the activity log.");
    return { rows: rows ?? [], members: members ?? [] };
  });

/** Rows for one export file. Owner only, own agency only, and every export is written to the activity log. */
export const exportRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.enum(EXPORT_KINDS))
  .handler(async ({ data: kind, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: members } = await sb
      .from("agency_members")
      .select("user_id,display_name,email")
      .eq("agency_id", access.agencyId);
    const agent = (id: string | null) => {
      const m = (members ?? []).find((x) => x.user_id === id);
      return m ? m.display_name || m.email : "";
    };
    const rows = await readRows(kind);
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { error: logError } = await admin.from("audit_log").insert({
      agency_id: access.agencyId,
      actor_id: context.userId,
      entity: "export",
      action: "Data exported",
      detail: `${EXPORT_LABELS[kind]}: ${rows.length} rows`,
    });
    // No log, no file: an export must always leave a trace.
    if (logError) throw new Error("Could not record the export, so nothing was downloaded.");
    return { rows };

    async function readRows(k: ExportKind): Promise<ExportRow[]> {
      if (k === "leads") {
        const { data, error } = await sb
          .from("leads")
          .select(
            "name,phone,email,type,source,area,budget,score,stage_name,outcome,assigned_agent_id,language,opted_in,stopped,created_at,first_reply_at",
          )
          .eq("agency_id", access.agencyId)
          .order("created_at", { ascending: false })
          .limit(EXPORT_LIMIT);
        if (error) throw new Error("Could not read the leads.");
        return (data ?? []).map(({ assigned_agent_id, ...l }) => ({
          ...l,
          agent: agent(assigned_agent_id),
        }));
      }
      if (k === "deals") {
        const { data, error } = await sb
          .from("deals")
          .select(
            "deal_type,status,price_aed,total_commission_percent,co_broker_name,co_broker_percent,commission_percent,agent_id,created_at,closed_at,leads(name)",
          )
          .eq("agency_id", access.agencyId)
          .order("created_at", { ascending: false })
          .limit(EXPORT_LIMIT);
        if (error) throw new Error("Could not read the deals.");
        return (data ?? []).map(({ agent_id, leads, ...d }) => ({
          ...d,
          client: (leads as unknown as { name: string } | null)?.name ?? "",
          agent: agent(agent_id),
        }));
      }
      if (k === "listings") {
        const { data, error } = await sb
          .from("listings")
          .select(
            "title,community,project,property_type,bedrooms,size_sqft,price_aed,status,completion,permit_number,created_at",
          )
          .eq("agency_id", access.agencyId)
          .eq("is_sample", false)
          .order("created_at", { ascending: false })
          .limit(EXPORT_LIMIT);
        if (error) throw new Error("Could not read the listings.");
        return data ?? [];
      }
      const { data, error } = await sb
        .from("owners")
        .select(
          "name,phone,kind,intent,stage,area,building,asking_price_aed,tenant_name,annual_rent_aed,lease_end,created_at",
        )
        .eq("agency_id", access.agencyId)
        .order("created_at", { ascending: false })
        .limit(EXPORT_LIMIT);
      if (error) throw new Error("Could not read the owners.");
      return data ?? [];
    }
  });

/** The Leads page builds its own filtered file in the browser; this writes that download to the activity log first. */
export const logListExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.number().int().min(0).max(100000))
  .handler(async ({ data: count, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { error } = await admin.from("audit_log").insert({
      agency_id: access.agencyId,
      actor_id: context.userId,
      entity: "export",
      action: "Data exported",
      detail: `Leads (filtered list): ${count} rows`,
    });
    if (error) throw new Error("Could not record the export, so nothing was downloaded.");
    return { success: true };
  });
