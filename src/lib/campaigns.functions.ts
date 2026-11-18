import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "./agency-access";
import {
  MAX_CAMPAIGN_LEADS,
  campaignProblems,
  campaignSchema,
  countStatuses,
  leadValues,
  type CampaignInput,
} from "./campaigns";
import { applyFilter } from "./lists";
import { phoneDigits } from "./whatsapp";
import { DEFAULT_MARKETING_GAP_DAYS, renderTemplate, templateTokens } from "./whatsapp-templates";

type Ctx = { supabase: Parameters<typeof requireOwner>[0]; userId: string };
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Campaigns page: approved templates, saved lists, send settings and past campaigns with live counts. Owner only. */
export const getCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const [{ data: templates }, { data: lists }, { data: settings }, { data: campaigns, error }] =
      await Promise.all([
        context.supabase
          .from("message_templates")
          .select("id,label,category,language,body,variables,meta_status")
          .eq("agency_id", access.agencyId)
          .eq("meta_status", "approved")
          .order("label"),
        context.supabase
          .from("saved_lists")
          .select("id,name,filters")
          .eq("agency_id", access.agencyId)
          .order("name"),
        context.supabase
          .from("whatsapp_settings")
          .select("marketing_gap_days,test_mode")
          .eq("agency_id", access.agencyId)
          .maybeSingle(),
        context.supabase
          .from("campaigns")
          .select("id,name,audience,steps,lead_count,skipped_count,status,created_at")
          .eq("agency_id", access.agencyId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
    if (error) throw new Error("Could not load campaigns.");
    const ids = (campaigns ?? []).map((c) => c.id);
    const { data: items } = ids.length
      ? await context.supabase
          .from("whatsapp_outbox")
          .select("campaign_id,status")
          .in("campaign_id", ids)
          .limit(20000)
      : { data: [] };
    return {
      templates: templates ?? [],
      lists: lists ?? [],
      gapDays: settings?.marketing_gap_days ?? DEFAULT_MARKETING_GAP_DAYS,
      whatsappReady: Boolean(settings),
      testMode: settings?.test_mode ?? true,
      campaigns: (campaigns ?? []).map((c) => ({
        ...c,
        counts: countStatuses(
          (items ?? []).filter((i) => i.campaign_id === c.id).map((i) => i.status),
        ),
      })),
    };
  });

/** Who would get the campaign, and who is left out and why. Used for the preview and again when starting. */
async function plan(context: Ctx, agencyId: string, input: CampaignInput) {
  const [{ data: leads, error }, { data: templates }, { data: settings }] = await Promise.all([
    context.supabase
      .from("leads")
      .select(
        "id,agency_id,name,phone,area,budget,score,source,type,stage,outcome,first_reply_at,assigned_agent_id,opted_in,stopped",
      )
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(5000),
    context.supabase
      .from("message_templates")
      .select("id,label,name,category,body,variables,meta_status")
      .eq("agency_id", agencyId)
      .in(
        "id",
        input.steps.map((s) => s.templateId),
      ),
    context.supabase
      .from("whatsapp_settings")
      .select("marketing_gap_days")
      .eq("agency_id", agencyId)
      .maybeSingle(),
  ]);
  if (error) throw new Error("Could not read your leads.");
  const gapDays = settings?.marketing_gap_days ?? DEFAULT_MARKETING_GAP_DAYS;
  const problems = campaignProblems(input.steps, templates ?? [], gapDays);
  const matching = applyFilter(leads ?? [], input.filter);
  const tokens = (templates ?? []).flatMap((t) => templateTokens(t.body));
  const skipped = { stopped: 0, noConsent: 0, noNumber: 0, missingDetails: 0, overLimit: 0 };
  const recipients: { lead: (typeof matching)[number]; values: Record<string, string> }[] = [];
  for (const lead of matching) {
    if (lead.stopped) skipped.stopped++;
    else if (!lead.opted_in) skipped.noConsent++;
    else if (phoneDigits(lead.phone).length < 6) skipped.noNumber++;
    else {
      const { values, missing } = leadValues(lead, tokens, input.defaults);
      if (missing.length) skipped.missingDetails++;
      else if (recipients.length >= MAX_CAMPAIGN_LEADS) skipped.overLimit++;
      else recipients.push({ lead, values });
    }
  }
  return { problems, matching: matching.length, recipients, skipped, templates: templates ?? [] };
}

export const previewCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(campaignSchema)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const p = await plan(context, access.agencyId, data);
    const first = p.recipients[0];
    const firstTemplate = p.templates.find((t) => t.id === data.steps[0]?.templateId);
    return {
      problems: p.problems,
      matching: p.matching,
      willGet: p.recipients.length,
      skipped: p.skipped,
      example: first && firstTemplate ? renderTemplate(firstTemplate.body, first.values) : "",
    };
  });

/**
 * Start a campaign. The owner pressing Send is the approval, so messages go into the queue as approved;
 * later messages wait as scheduled. The send job checks every rule again right before each send.
 */
export const startCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(campaignSchema)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const p = await plan(context, access.agencyId, data);
    if (p.problems.length) return { error: p.problems.join(" ") };
    if (!p.recipients.length)
      return { error: "No one on this list can receive it. Check consent on the leads first." };
    const db = await admin();
    const skippedCount = p.matching - p.recipients.length;
    const { data: campaign, error } = await db
      .from("campaigns")
      .insert({
        agency_id: access.agencyId,
        name: data.name,
        audience: data.audienceLabel,
        steps: data.steps.map((s) => ({
          ...s,
          label: p.templates.find((t) => t.id === s.templateId)?.label ?? "",
        })),
        lead_count: p.recipients.length,
        skipped_count: skippedCount,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !campaign) throw new Error("Could not start the campaign.");
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const rows = data.steps.flatMap((step, i) => {
      const t = p.templates.find((x) => x.id === step.templateId)!;
      const tokens = [...new Set(templateTokens(t.body))];
      return p.recipients.map(({ lead, values }) => {
        const own = Object.fromEntries(tokens.map((k) => [k, values[k] ?? ""]));
        return {
          lead_id: lead.id,
          agency_id: access.agencyId,
          template_id: t.id,
          template_name: t.name,
          category: t.category,
          variables: own,
          preview: renderTemplate(t.body, own).slice(0, 2000),
          purpose: "campaign",
          status: step.afterDays > 0 ? "scheduled" : "approved",
          send_after: new Date(now + step.afterDays * 86_400_000).toISOString(),
          created_by: context.userId,
          approved_by: context.userId,
          approved_at: nowIso,
          campaign_id: campaign.id,
          campaign_step: i + 1,
        };
      });
    });
    for (let i = 0; i < rows.length; i += 200) {
      const { error: insertError } = await db
        .from("whatsapp_outbox")
        .insert(rows.slice(i, i + 200));
      if (insertError) {
        // Nothing half-sent: stop everything that was queued for this campaign.
        await db
          .from("whatsapp_outbox")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("campaign_id", campaign.id)
          .in("status", ["approved", "scheduled"])
          .is("chat_message_id", null);
        await db.from("campaigns").update({ status: "cancelled" }).eq("id", campaign.id);
        throw new Error("Could not queue the messages. Nothing more will be sent.");
      }
    }
    await db.from("audit_log").insert({
      agency_id: access.agencyId,
      actor_id: context.userId,
      entity: "campaign",
      entity_id: campaign.id,
      action: "Campaign started",
      detail: `${data.name}: ${p.recipients.length} clients, ${data.steps.length} message(s)`.slice(
        0,
        500,
      ),
    });
    return { id: campaign.id, queued: p.recipients.length, skipped: skippedCount };
  });

/** Stop a campaign: every message that has not started sending is cancelled. */
export const cancelCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data: campaign } = await context.supabase
      .from("campaigns")
      .select("id,name")
      .eq("id", data)
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!campaign) throw new Error("Campaign not found.");
    const db = await admin();
    const { data: stopped, error } = await db
      .from("whatsapp_outbox")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("campaign_id", campaign.id)
      .in("status", ["pending_approval", "approved", "scheduled", "blocked"])
      .is("chat_message_id", null)
      .select("id");
    if (error) throw new Error("Could not stop the campaign.");
    await db.from("campaigns").update({ status: "cancelled" }).eq("id", campaign.id);
    await db.from("audit_log").insert({
      agency_id: access.agencyId,
      actor_id: context.userId,
      entity: "campaign",
      entity_id: campaign.id,
      action: "Campaign stopped",
      detail: `${campaign.name}: ${stopped?.length ?? 0} unsent message(s) cancelled`,
    });
    return { cancelled: stopped?.length ?? 0 };
  });
