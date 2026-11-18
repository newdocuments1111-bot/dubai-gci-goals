import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess, requireOwner } from "./agency-access";
import { ALERT_TEMPLATE } from "./alerts";

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };
const guard = (context: Ctx) => getAccess(context.supabase, context.userId);

/** My alert settings, the push key for subscribing, and (owners) the WhatsApp alert template status. */
export const getMyAlertSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    const [{ data: me }, { data: key }, { data: subs }, { data: template }, { data: wa }] =
      await Promise.all([
        context.supabase
          .from("agency_members")
          .select("mobile,alert_push,alert_whatsapp")
          .eq("agency_id", access.agencyId)
          .eq("user_id", context.userId)
          .maybeSingle(),
        context.supabase.rpc("push_public_key"),
        context.supabase
          .from("push_subscriptions")
          .select("endpoint,created_at,last_ok_at")
          .eq("user_id", context.userId),
        access.isOwner
          ? context.supabase
              .from("agent_alert_template")
              .select("*")
              .eq("agency_id", access.agencyId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        context.supabase
          .from("whatsapp_settings")
          .select("status")
          .eq("agency_id", access.agencyId)
          .maybeSingle(),
      ]);
    return {
      isOwner: access.isOwner,
      mobile: me?.mobile ?? "",
      alertPush: me?.alert_push ?? true,
      alertWhatsapp: me?.alert_whatsapp ?? true,
      publicKey: (key as string | null) ?? "",
      subscriptions: subs ?? [],
      template: template ?? null,
      whatsappConnected: wa?.status === "connected",
    };
  });

export const saveMyAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      mobile: z
        .string()
        .trim()
        .max(30)
        .regex(/^[+\d\s()-]*$/, "Use digits, spaces and + only."),
      push: z.boolean(),
      whatsapp: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.rpc("set_my_alerts", {
      _mobile: data.mobile,
      _push: data.push,
      _whatsapp: data.whatsapp,
    });
    if (error) throw new Error("Could not save your alert settings.");
    return { success: true };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      endpoint: z.string().url().startsWith("https://").max(1000),
      p256dh: z.string().min(20).max(200),
      auth: z.string().min(8).max(100),
      userAgent: z.string().max(300).default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    await guard(context);
    // One row per browser: replace this endpoint if it was saved before.
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    const { error } = await context.supabase.from("push_subscriptions").insert({
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.userAgent,
    });
    if (error) throw new Error("Could not turn on phone alerts.");
    return { success: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().max(1000))
  .handler(async ({ data, context }) => {
    await guard(context);
    await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data)
      .eq("user_id", context.userId);
    return { success: true };
  });

export const markAllAlertsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    await context.supabase
      .from("alerts")
      .update({ read: true })
      .eq("agency_id", access.agencyId)
      .eq("read", false);
    return { success: true };
  });

/** Owner: submit the agent alert template to Meta (once), or refresh its review status. */
export const submitAlertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wa } = await supabaseAdmin
      .from("whatsapp_settings")
      .select("waba_id,status")
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    if (!wa?.waba_id || wa.status !== "connected")
      throw new Error("Connect WhatsApp first (Settings → WhatsApp).");
    const { createMetaTemplate, listMetaTemplates, rejectionText } =
      await import("./whatsapp.server");
    const { mapMetaStatus } = await import("./whatsapp-templates");
    const existing = (await listMetaTemplates(wa.waba_id)).find(
      (t) => t.name === ALERT_TEMPLATE.name && t.language.startsWith(ALERT_TEMPLATE.language),
    );
    let id: string;
    let status: string;
    let detail: string | null = null;
    if (existing) {
      id = existing.id;
      status = mapMetaStatus(existing.status);
      detail = rejectionText(existing.rejected_reason);
    } else {
      const created = await createMetaTemplate(wa.waba_id, {
        name: ALERT_TEMPLATE.name,
        language: ALERT_TEMPLATE.language,
        category: ALERT_TEMPLATE.category,
        metaBody: ALERT_TEMPLATE.body,
        examples: [...ALERT_TEMPLATE.examples],
      });
      id = created.id;
      status = created.status;
    }
    const { error } = await supabaseAdmin.from("agent_alert_template").upsert(
      {
        agency_id: access.agencyId,
        name: ALERT_TEMPLATE.name,
        language: existing?.language ?? ALERT_TEMPLATE.language,
        meta_template_id: id,
        status,
        detail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id" },
    );
    if (error) throw new Error("Could not save the template status.");
    return { status };
  });
