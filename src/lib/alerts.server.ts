import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mobileDigits, pushMessage, templateParams } from "./alerts";
import { sendPush, type VapidKeys } from "./webpush";
import { sendBlockReason } from "./whatsapp";

type Admin = typeof supabaseAdmin;
export type DeliveryResult = { alerts: number; pushed: number; whatsapp: number; failed: number };

/**
 * Deliver new agent alerts (assigned, reminder, pool) to phones: a notification to every
 * subscribed browser, and a WhatsApp template to the agent's mobile once Meta approved it.
 * Each alert is claimed once in the database, so a retry never sends it twice.
 */
export async function deliverAlerts(
  admin: Admin,
  origin: string,
  limit = 25,
): Promise<DeliveryResult> {
  const result: DeliveryResult = { alerts: 0, pushed: 0, whatsapp: 0, failed: 0 };
  const { data: claimed, error } = await admin.rpc("claim_alert_deliveries", { _limit: limit });
  if (error) throw new Error(`Could not claim alerts: ${error.message}`);
  if (!claimed?.length) return result;
  result.alerts = claimed.length;

  const { data: keyRow } = await admin.from("push_keys").select("*").eq("id", 1).maybeSingle();
  const vapid: VapidKeys | null = keyRow
    ? {
        publicKey: keyRow.vapid_public,
        privateJwk: keyRow.vapid_private as VapidKeys["privateJwk"],
        subject: keyRow.subject,
      }
    : null;

  const userIds = [...new Set(claimed.flatMap((a) => a.recipients ?? []))];
  const agencyIds = [...new Set(claimed.map((a) => a.agency_id))];
  const leadIds = [...new Set(claimed.map((a) => a.lead_id).filter((x): x is string => !!x))];
  const [
    { data: members },
    { data: subs },
    { data: leads },
    { data: templates },
    { data: waSettings },
  ] = await Promise.all([
    admin
      .from("agency_members")
      .select("user_id,agency_id,mobile,alert_push,alert_whatsapp")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("leads")
      .select("id,name,source,area")
      .in("id", leadIds.length ? leadIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("agent_alert_template")
      .select("*")
      .in("agency_id", agencyIds)
      .eq("status", "approved"),
    admin
      .from("whatsapp_settings")
      .select("agency_id,phone_number_id,test_mode,test_recipients,status")
      .in("agency_id", agencyIds),
  ]);

  for (const alert of claimed) {
    const lead = leads?.find((l) => l.id === alert.lead_id) ?? null;
    for (const userId of alert.recipients ?? []) {
      const member = members?.find((m) => m.user_id === userId && m.agency_id === alert.agency_id);
      if (!member) continue;

      if (member.alert_push && vapid) {
        const message = pushMessage({
          id: alert.alert_id,
          kind: alert.kind,
          message: alert.message,
          lead_id: alert.lead_id,
        });
        for (const sub of subs?.filter((s) => s.user_id === userId) ?? []) {
          try {
            const r = await sendPush(sub, message, vapid);
            if (r.ok) {
              result.pushed++;
              await admin
                .from("push_subscriptions")
                .update({ last_ok_at: new Date().toISOString() })
                .eq("id", sub.id);
            } else {
              result.failed++;
              if (r.gone) await admin.from("push_subscriptions").delete().eq("id", sub.id);
              else console.error(`Push refused [${r.status}] for subscription ${sub.id}`);
            }
          } catch (e) {
            result.failed++;
            console.error("Push failed", e);
          }
        }
      }

      const template = templates?.find((t) => t.agency_id === alert.agency_id);
      const wa = waSettings?.find((w) => w.agency_id === alert.agency_id);
      const to = mobileDigits(member.mobile);
      if (
        member.alert_whatsapp &&
        alert.kind !== "pool" &&
        template &&
        wa?.phone_number_id &&
        to &&
        lead
      ) {
        const block = sendBlockReason({
          settings: wa,
          to,
          stopped: false,
          lastInboundAt: null,
          template: true,
        });
        if (block) {
          console.warn(`WhatsApp alert not sent: ${block}`);
          continue;
        }
        try {
          const { sendTemplate } = await import("./whatsapp.server");
          await sendTemplate(
            wa.phone_number_id,
            to,
            template.name,
            template.language,
            templateParams(lead, `${origin}/lead/${lead.id}`),
          );
          result.whatsapp++;
        } catch (e) {
          result.failed++;
          console.error("WhatsApp alert failed", e);
        }
      }
    }
  }
  return result;
}
