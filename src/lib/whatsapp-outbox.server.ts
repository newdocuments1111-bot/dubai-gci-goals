import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Tables } from "@/integrations/supabase/types";
import {
  cleanParam,
  consentRecordOk,
  DEFAULT_MARKETING_GAP_DAYS,
  missingValues,
  outboxDecision,
  renderTemplate,
} from "./whatsapp-templates";
import {
  META_LIMIT_MAX_AGE_HOURS,
  META_LIMIT_MAX_RETRIES,
  META_PER_PERSON_LIMIT_CODE,
  followUpStopped,
  metaLimitRetry,
  type MetaLimitRetry,
} from "./campaigns";

type Admin = typeof supabaseAdmin;
type Item = Tables<"whatsapp_outbox">;
const MAX_ATTEMPTS = 5;

export type OutboxRunResult = {
  sent: number;
  scheduled: number;
  blocked: number;
  failed: number;
  retry: number;
};

/** Claim due queue items (all, or just `ids`) and send each one only if every rule still passes. */
export async function processOutbox(
  admin: Admin,
  ids: string[] | null,
  limit: number,
): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { sent: 0, scheduled: 0, blocked: 0, failed: 0, retry: 0 };
  // The regular run also picks up messages Meta refused later for its per-person limit. Never allowed to stop sending.
  if (ids === null) {
    try {
      const swept = await retryMetaLimitFailures(admin);
      result.scheduled += swept.scheduled;
      result.failed += swept.failed;
    } catch (e) {
      console.error(
        "Could not check for Meta per-person limit failures",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  const { data: claimed, error } = await admin.rpc("claim_whatsapp_outbox", {
    p_ids: ids as string[],
    p_limit: limit,
  });
  if (error) throw new Error(`Could not claim queue items: ${error.message}`);
  for (const item of claimed ?? []) {
    try {
      result[await processItem(admin, item)]++;
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
      console.error("WhatsApp queue item failed", item.id, message);
      const giveUp = item.attempts >= MAX_ATTEMPTS;
      await admin
        .from("whatsapp_outbox")
        .update({
          claimed_until: null,
          error: message,
          updated_at: new Date().toISOString(),
          ...(giveUp ? { status: "failed" } : {}),
        })
        .eq("id", item.id);
      result[giveUp ? "failed" : "retry"]++;
    }
  }
  return result;
}

async function update(admin: Admin, id: string, patch: Partial<Item>) {
  const { error } = await admin
    .from("whatsapp_outbox")
    .update({ ...patch, claimed_until: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not update the queue item: ${error.message}`);
}

/**
 * Retries already used for Meta's per-person limit. Null when the `meta_limit_retries` column has not been
 * added yet (see campaign-cost.sql): then nothing is retried and failures are handled exactly as before.
 */
function retriesUsed(row: unknown): number | null {
  const v = (row as { meta_limit_retries?: unknown } | null)?.meta_limit_retries;
  return typeof v === "number" ? v : null;
}

async function campaignActive(admin: Admin, campaignId: string | null) {
  if (!campaignId) return true;
  const { data } = await admin
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();
  return data?.status !== "cancelled";
}

/**
 * Put a queue item back for a later try. The failed chat message stays in the chat as failed and is unlinked, so the
 * next try records a new one and goes through every check again. `chatMessageId` guards against a second run.
 */
async function reschedule(
  admin: Admin,
  id: string,
  chatMessageId: string,
  again: Extract<MetaLimitRetry, { action: "retry" }>,
) {
  const patch: Record<string, unknown> = {
    status: "scheduled",
    send_after: again.at.toISOString(),
    chat_message_id: null,
    wa_message_id: null,
    sent_at: null,
    claimed_until: null,
    block_reason: null,
    meta_limit_retries: again.retries,
    updated_at: new Date().toISOString(),
    error: `Meta's limit on marketing messages per person was reached. Trying again later (${again.retries} of ${META_LIMIT_MAX_RETRIES}).`,
  };
  const { data, error } = await admin
    .from("whatsapp_outbox")
    .update(patch as Partial<Item>)
    .eq("id", id)
    .eq("chat_message_id", chatMessageId)
    .in("status", ["sent", "approved", "scheduled"])
    .select("id");
  if (error) throw new Error(`Could not reschedule the queue item: ${error.message}`);
  return Boolean(data?.length);
}

/**
 * Meta reports its per-person marketing limit (code 131049) after accepting the message, as a failed delivery status
 * on the chat message. Find those queue items and try them again later, or mark them failed when the tries are used up.
 */
async function retryMetaLimitFailures(admin: Admin) {
  const out = { scheduled: 0, failed: 0 };
  const since = new Date(Date.now() - META_LIMIT_MAX_AGE_HOURS * 3600_000).toISOString();
  const { data, error } = await admin
    .from("whatsapp_outbox")
    .select(
      "id,campaign_id,chat_message_id,meta_limit_retries,chat_messages!inner(wa_status,wa_error,wa_failed_at)" as "*",
    )
    .eq("status", "sent")
    .eq("chat_messages.wa_status", "failed")
    .like("chat_messages.wa_error", `%(code ${META_PER_PERSON_LIMIT_CODE})%`)
    .gte("chat_messages.wa_failed_at", since)
    .limit(50);
  if (error) throw new Error(error.message); // e.g. the column is not there yet: nothing is retried
  type Row = {
    id: string;
    campaign_id: string | null;
    chat_message_id: string | null;
    chat_messages:
      | { wa_error: string | null; wa_failed_at: string | null }
      | { wa_error: string | null; wa_failed_at: string | null }[]
      | null;
  };
  const active = new Map<string, boolean>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const used = retriesUsed(row);
    const msg = Array.isArray(row.chat_messages) ? row.chat_messages[0] : row.chat_messages;
    if (used === null || !row.chat_message_id || !msg) continue;
    const key = row.campaign_id ?? "";
    if (!active.has(key)) active.set(key, await campaignActive(admin, row.campaign_id));
    const again = metaLimitRetry({
      errorText: msg.wa_error,
      retries: used,
      failedAt: msg.wa_failed_at,
      campaignActive: active.get(key) ?? true,
    });
    if (again.action === "retry") {
      if (await reschedule(admin, row.id, row.chat_message_id, again)) out.scheduled++;
    } else if (again.action === "give_up") {
      const { data: done } = await admin
        .from("whatsapp_outbox")
        .update({ status: "failed", error: again.reason, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "sent")
        .eq("chat_message_id", row.chat_message_id)
        .select("id");
      if (done?.length) out.failed++;
    }
  }
  return out;
}

async function processItem(admin: Admin, item: Item): Promise<keyof OutboxRunResult> {
  // An earlier attempt got as far as sending: never send blindly again.
  if (item.chat_message_id) {
    const { data: msg } = await admin
      .from("chat_messages")
      .select("wa_message_id,wa_status,wa_error")
      .eq("id", item.chat_message_id)
      .maybeSingle();
    if (msg?.wa_message_id) {
      await update(admin, item.id, {
        status: "sent",
        sent_at: item.sent_at ?? new Date().toISOString(),
        wa_message_id: msg.wa_message_id,
      });
      return "sent";
    }
    await update(admin, item.id, {
      status: "failed",
      error:
        msg?.wa_status === "failed"
          ? msg.wa_error
          : "Send outcome unknown — check the chat on WhatsApp before queueing it again.",
    });
    return "failed";
  }

  const [{ data: lead }, { data: template }, { data: consent }] = await Promise.all([
    admin
      .from("leads")
      .select("id,agency_id,phone,stopped,opted_in,whatsapp_last_inbound_at")
      .eq("id", item.lead_id)
      .maybeSingle(),
    item.template_id
      ? admin.from("message_templates").select("*").eq("id", item.template_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("consent_log")
      .select("agreed_to")
      .eq("lead_id", item.lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!lead) {
    await update(admin, item.id, { status: "blocked", block_reason: "The lead no longer exists." });
    return "blocked";
  }
  // Campaign follow-ups stop as soon as the client has written back.
  if (followUpStopped(item.campaign_step, item.created_at, lead.whatsapp_last_inbound_at)) {
    await update(admin, item.id, {
      status: "cancelled",
      block_reason: "The client replied, so this follow-up was not sent.",
    });
    return "blocked";
  }
  const { data: settings } = await admin
    .from("whatsapp_settings")
    .select("*")
    .eq("agency_id", lead.agency_id)
    .maybeSingle();
  const { data: lastMarketing } = await admin
    .from("whatsapp_outbox")
    .select("sent_at")
    .eq("lead_id", lead.id)
    .eq("status", "sent")
    .eq("category", "marketing")
    .neq("id", item.id)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const values = (item.variables ?? {}) as Record<string, string>;
  const decision = outboxDecision({
    lead,
    consentOk: consentRecordOk(consent?.agreed_to),
    template: template && template.agency_id === lead.agency_id ? template : null,
    settings,
    lastMarketingSentAt: lastMarketing?.sent_at ?? null,
    gapDays: settings?.marketing_gap_days ?? DEFAULT_MARKETING_GAP_DAYS,
    missing: template ? missingValues(template.variables, values) : [],
  });
  if (decision.action === "block") {
    await update(admin, item.id, {
      status: "blocked",
      block_reason: decision.reason.slice(0, 500),
    });
    return "blocked";
  }
  if (decision.action === "schedule") {
    await update(admin, item.id, {
      status: "scheduled",
      send_after: decision.at.toISOString(),
      block_reason: null,
    });
    return "scheduled";
  }

  const t = template!,
    s = settings!;
  const preview = renderTemplate(t.body, values).slice(0, 2000);
  // 1. Record the message in the lead's chat first, so the send can never be lost or repeated.
  const { data: msg, error: msgError } = await admin
    .from("chat_messages")
    .insert({
      lead_id: lead.id,
      role: "owner",
      author_id: item.approved_by ?? item.created_by,
      content: preview,
      sent: false,
      channel: "whatsapp",
      wa_status: "sending",
    })
    .select("id")
    .single();
  if (msgError || !msg) throw new Error(`Could not save the message: ${msgError?.message}`);
  await update(admin, item.id, { chat_message_id: msg.id, preview, block_reason: null });

  // 2. Send through Meta.
  const { sendTemplate, reconcileStatuses } = await import("./whatsapp.server");
  let wamid: string;
  try {
    wamid = await sendTemplate(
      s.phone_number_id,
      lead.phone,
      t.name,
      t.language,
      t.variables.map((v) => cleanParam(values[v])),
    );
  } catch (e) {
    const reason = (e instanceof Error ? e.message : "Send failed").slice(0, 1000);
    await admin
      .from("chat_messages")
      .update({ wa_status: "failed", wa_error: reason, wa_failed_at: new Date().toISOString() })
      .eq("id", msg.id);
    // Meta's per-person marketing limit can pass later: try again instead of failing for good.
    const used = retriesUsed(item);
    const again: MetaLimitRetry =
      used === null
        ? { action: "none" }
        : metaLimitRetry({
            errorText: reason,
            retries: used,
            campaignActive: await campaignActive(admin, item.campaign_id),
          });
    if (again.action === "retry") {
      const moved = await reschedule(admin, item.id, msg.id, again).catch((err) => {
        console.error(
          "Could not reschedule after Meta per-person limit",
          item.id,
          err instanceof Error ? err.message : String(err),
        );
        return false;
      });
      if (moved) return "scheduled";
    }
    await update(admin, item.id, {
      status: "failed",
      error: again.action === "give_up" ? again.reason : reason,
    });
    return "failed";
  }
  // 3. Store the WhatsApp id (delivery ticks match on it; the usage meter counts it).
  const now = new Date().toISOString();
  const { error: saveError } = await admin
    .from("chat_messages")
    .update({ wa_message_id: wamid, wa_status: "accepted", sent: true })
    .eq("id", msg.id);
  if (saveError)
    console.error(
      "Template sent but its id could not be saved on the chat message",
      msg.id,
      saveError.message,
    );
  await update(admin, item.id, { status: "sent", sent_at: now, wa_message_id: wamid, error: null });
  await admin.from("leads").update({ last_message_at: now }).eq("id", lead.id);
  await reconcileStatuses(admin, wamid);
  return "sent";
}
