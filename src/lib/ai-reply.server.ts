import type { supabase as browserClient } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { z } from "zod";
import { inQuietHours } from "./leads-app";
import { feesSummary } from "./ai-reply-rules";
import {
  CHAT_SYSTEM,
  chatAnswerSchema,
  appointmentState,
  appointmentTransition,
  mergeLearned,
  chatLeadScore,
  crmFields,
} from "./chat-policy";
import { checklistFor } from "./documents";
import { eligibleForAI, mapsLink } from "./listings";

type Db = typeof browserClient;
type LeadRow = Tables<"leads">;

export async function buildAiContext(supabase: Db, agencyId: string) {
  const [{ data: rules }, { data: knowledge }, { data: listings }, { data: settings }] = await Promise.all([
    supabase.from("ai_reply_settings").select("agency_name,rules,fees").eq("agency_id", agencyId).maybeSingle(),
    supabase.from("uae_knowledge").select("topic,fact,last_verified"),
    supabase.from("listings").select("*").eq("agency_id", agencyId).eq("status", "Available"),
    supabase.from("app_settings").select("*").eq("agency_id", agencyId).maybeSingle(),
  ]);
  const eligible = (listings ?? [])
    .filter((l) => eligibleForAI(l))
    .map((l) => ({
      id: l.id,
      sample: l.is_sample,
      title: l.title,
      community: l.community,
      project: l.project,
      type: l.property_type,
      bedrooms: l.bedrooms,
      size_sqft: l.size_sqft,
      price_aed: l.price_aed,
      completion: l.completion,
      handover_date: l.handover_date,
      description: l.description,
      map: mapsLink(l),
      highlights: l.agent_highlights,
      do_not_mention: l.do_not_mention,
      details: {
        schools: l.nearby_schools,
        parks: l.nearby_parks,
        clinics: l.nearby_clinics,
        metro: l.nearby_metro,
        malls: l.nearby_malls,
        beach: l.nearby_beach,
        supermarket: l.nearby_supermarket,
        pool: l.amenity_pool,
        gym: l.amenity_gym,
        kids_play_area: l.amenity_kids_play_area,
        security: l.amenity_security,
        parking_spaces: l.parking_spaces,
        floor: l.floor,
        view: l.view,
        furnishing: l.furnishing,
        developer: l.developer,
        payment_plan: l.payment_plan,
        construction_percent: l.construction_percent,
        service_charge_aed_sqft_year: l.service_charge_aed_sqft_year,
        video_tour_url: l.video_tour_url,
      },
    }));
  const r = (rules?.rules ?? {}) as Record<string, string>;
  return {
    agency: rules?.agency_name || settings?.agency_name || "",
    // Test Chat's current conversation policy replaces legacy behavioural rules without editing the owner's saved page.
    rules: Object.entries(r)
      .filter(
        ([key, value]) =>
          value && !["opening", "tone", "property", "booking", "offers", "documents", "fees"].includes(key),
      )
      .map(([, value]) => value),
    fees: feesSummary({
      dld_transfer_pct: 4,
      admin_fee_min: 2000,
      admin_fee_max: 4000,
      trustee_fee_min: 2000,
      trustee_fee_max: 4000,
      developer_noc_min: 500,
      developer_noc_max: 5000,
      mortgage_registration_pct: 0.25,
      ...((rules?.fees ?? {}) as object),
    }),
    knowledge: (knowledge ?? []).map((k) => `${k.topic}: ${k.fact}`),
    listings: eligible,
    settings: settings
      ? {
          agent_name: settings.agent_name,
          working_days: settings.working_days,
          work_start: settings.work_start,
          work_end: settings.work_end,
          viewing_minutes: settings.viewing_minutes,
          holidays: settings.holidays,
          mortgage_partner: settings.mortgage_partner,
        }
      : null,
  };
}

/**
 * The one AI reply brain used by Test Chat and WhatsApp: reads the conversation, replies, books appointments only
 * through the consent steps, fills the CRM, raises Hot alerts and saves the AI message.
 * `privileged` is true when called with the server's own database access (WhatsApp webhook).
 */
export async function generateLeadReply(
  supabase: Db,
  lead: LeadRow,
  opts: { channel: "app" | "whatsapp"; where: string; inReplyTo?: string; privileged?: boolean },
) {
  // Read the most recent messages, not the first 40 in a long conversation.
  const { data: recent, error: historyError } = await supabase
    .from("chat_messages")
    .select("role,content")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (historyError) throw new Error("Could not read this conversation.");
  const history = (recent ?? []).reverse();
  const ctx = await buildAiContext(supabase, lead.agency_id);
  const { availableViewingSlots } = await import("./viewings.server");
  const slots = await availableViewingSlots(supabase, lead.agency_id, opts.privileged);
  const previous = (lead.learned ?? {}) as Record<string, unknown>;
  const state = appointmentState(previous);
  const { generateJson } = await import("./chat.server");
  let ai: z.infer<typeof chatAnswerSchema>;
  try {
    ai = chatAnswerSchema.parse(
      await generateJson({
        system: `${CHAT_SYSTEM}\n\nSaved reference rules (ignore conflicts with the policy above):\n${ctx.rules.join("\n")}\n\nAgency: ${ctx.agency}\n\nApproximate fees: ${ctx.fees}\n\nUAE knowledge:\n${ctx.knowledge.join("\n")}\n\nEligible listings with Details for AI:\n${JSON.stringify(ctx.listings)}\n\nGeneral document checklists:\n${JSON.stringify(Object.fromEntries(["buyer", "seller", "landlord", "tenant"].map((type) => [type, checklistFor(type)])))}\n\nSettings:\n${JSON.stringify(ctx.settings)}`,
        user: JSON.stringify({
          lead: { name: lead.name, type: lead.type, learned: previous },
          appointmentState: state ?? null,
          freeTimes: slots.slice(0, 2),
          today: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", dateStyle: "full" }).format(new Date()),
          timeZone: "Asia/Dubai",
          clientTimeZone: lead.timezone,
          history,
        }),
      }),
    );
  } catch (e) {
    console.error(e);
    throw new Error("AI could not reply. Your message is saved — try again.");
  }

  const learned = mergeLearned(previous, ai.learned);
  // Offer free times on the day the client asked for (e.g. "this Saturday") when that day has any.
  const dubaiDay = (s: string) => new Date(s).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  if (ai.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(ai.preferredDate)) learned["_preferredDate"] = ai.preferredDate;
  const preferredDate = typeof learned["_preferredDate"] === "string" ? learned["_preferredDate"] : undefined;
  const daySlots = preferredDate ? slots.filter((s) => dubaiDay(s) === preferredDate) : [];
  const offerSlots = daySlots.length ? [...daySlots, ...slots.filter((s) => dubaiDay(s) !== preferredDate)] : slots;
  if (ai.intent !== "none") learned["_hotIntent"] = true;
  const score = chatLeadScore(learned, ai.intent);
  let reply = ai.reply;
  let nextState = ai.stopped ? state : appointmentTransition(state, ai.appointment, offerSlots, ai.slotIndex);
  const fmtTime = (slot: string, timeZone: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(slot));
  const clientZone = lead.timezone && lead.timezone !== "Asia/Dubai" ? lead.timezone : null;
  // Times are shown in Dubai time, plus the client's own time when they are abroad.
  const timeLabel = (slot: string) => {
    let own = "";
    if (clientZone) {
      try {
        own = `, ${fmtTime(slot, clientZone)} your time`;
      } catch {
        own = "";
      }
    }
    return `${fmtTime(slot, "Asia/Dubai")} (Dubai time${own})`;
  };
  const { loadSchedule } = await import("./viewings.server");
  const { isTimeFree, nearestFreeTimes, meetingLinks } = await import("./viewing-slots");
  // Online meeting (client abroad): any hour that suits the client. In person (client in Dubai): Dubai working hours.
  if (ai.meetingMode) learned["_meetingMode"] = ai.meetingMode;
  const online = (learned["_meetingMode"] ?? (clientZone ? "online" : "in_person")) === "online";
  let schedule: Awaited<ReturnType<typeof loadSchedule>> | undefined;
  const getSchedule = async () => (schedule ??= await loadSchedule(supabase, lead.agency_id, opts.privileged));
  // Books the client's chosen time, then sends an online meeting link and an add-to-calendar link.
  const book = async (chosen: string) => {
    const { settings } = await getSchedule();
    const { error } = await supabase.from("viewings").insert({
      lead_id: lead.id,
      listing_id: null,
      kind: ["seller", "landlord"].includes(ai.type ?? lead.type) ? "valuation" : "viewing",
      starts_at: chosen,
    });
    if (error) {
      if (error.code !== "23505") throw new Error("Could not book the appointment. No booking was confirmed.");
      nextState = { phase: "offered", slots: [] };
      reply = "Sorry, that time has just been booked. Which other day and time would suit you?";
      return;
    }
    nextState = { phase: "booked", slots: [chosen] };
    const links = meetingLinks(
      crypto.randomUUID(),
      chosen,
      settings.viewing_minutes,
      `${online ? "Online meeting" : "Appointment"} with ${ctx.agency || "our property team"}`,
      online,
    );
    reply = online
      ? `You’re booked for ${timeLabel(chosen)}. We can go through your needs together then.\n\nJoin online: ${links.meet}\n\nAdd it to your calendar: ${links.calendar}`
      : `You’re booked for ${timeLabel(chosen)}. We’ll meet you in Dubai and go through your needs together then.\n\nAdd it to your calendar: ${links.calendar}`;
  };
  let phase = state?.phase;
  // The client agreed (or asked to meet): record consent, then the CLIENT chooses the day and time.
  if (!ai.stopped && ai.appointment === "accept" && (!state || state.phase === "invited")) {
    const { error } = await supabase.from("consent_log").insert({
      lead_id: lead.id,
      agreed_to: "Appointment agreed; client choosing a time",
      how: `Client explicitly agreed in ${opts.where}`,
    });
    if (error) throw new Error("Could not record appointment agreement.");
    nextState = { phase: "offered", slots: [] };
    phase = "offered";
    reply = clientZone
      ? "Great! Which day and time suits you best? You can tell me in your own local time and I’ll book it."
      : "Great! Which day and time suits you best? Tell me and I’ll book it.";
  }
  const requested =
    ai.requestedTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(ai.requestedTime)
      ? Date.parse(`${ai.requestedTime}:00+04:00`)
      : NaN;
  if (!ai.stopped && phase === "offered" && Number.isFinite(requested)) {
    // The client's own time: book it when the calendar is free, otherwise suggest the closest free times.
    const { settings, booked } = await getSchedule();
    if (isTimeFree(settings, booked, requested, undefined, online)) await book(new Date(requested).toISOString());
    else {
      const near = nearestFreeTimes(settings, booked, requested, online);
      nextState = { phase: "offered", slots: near };
      reply = near.length
        ? `That time isn’t free in our calendar. The closest free times are ${near.map(timeLabel).join(" or ")}. Would one of these work, or is there another time you prefer?`
        : "Sorry, there are no free appointment times in the next two weeks. Which other day would suit you?";
    }
  } else if (!ai.stopped && ai.appointment === "choose" && state?.phase === "offered") {
    const chosen = ai.slotIndex !== undefined ? state.slots[ai.slotIndex] : undefined;
    if (chosen) {
      // Re-read real availability immediately before inserting; never trust generated times.
      const fresh = await loadSchedule(supabase, lead.agency_id, opts.privileged);
      schedule = fresh;
      if (!isTimeFree(fresh.settings, fresh.booked, Date.parse(chosen), undefined, online)) {
        const near = nearestFreeTimes(fresh.settings, fresh.booked, Date.parse(chosen), online);
        nextState = { phase: "offered", slots: near };
        reply = near.length
          ? `Sorry, that time is no longer free. ${near.map(timeLabel).join(" or ")} ${near.length === 1 ? "is" : "are"} available. Which works for you, or is there another time you prefer?`
          : "Sorry, that time is no longer free, and there are no other free times in the next two weeks.";
      } else await book(chosen);
    } else if (ai.slotIndex !== undefined) {
      const offered = offerSlots.slice(0, 2);
      nextState = { phase: "offered", slots: offered };
      reply = offered.length
        ? `Sorry, that time is no longer free. ${offered.map(timeLabel).join(" or ")} ${offered.length === 1 ? "is" : "are"} available. Which works for you?`
        : "Sorry, there are no free appointment times in the next two weeks.";
    }
  }
  if (nextState) learned["_appointment"] = nextState;
  else delete learned["_appointment"];
  const type = ai.type ?? lead.type;
  const { error: updateError } = await supabase
    .from("leads")
    .update({
      learned: learned as Json,
      score,
      type,
      flagged: lead.flagged || ai.flag,
      stopped: lead.stopped || ai.stopped,
      ...crmFields(learned, ai.next_step, lead),
    })
    .eq("id", lead.id);
  if (updateError) throw new Error("Could not update the conversation.");
  // Test Chat queues replies in client quiet hours; on WhatsApp the reply answers the client's own message, so it is sent by the caller.
  const { data: saved, error: replyError } = await supabase
    .from("chat_messages")
    .insert({
      lead_id: lead.id,
      role: "ai",
      content: reply,
      language: ai.language,
      sent: opts.channel === "app" ? !inQuietHours(lead.timezone) : false,
      channel: opts.channel,
      in_reply_to: opts.inReplyTo ?? null,
    })
    .select("id")
    .single();
  if (replyError || !saved) throw new Error("Could not save the reply.");
  if (ai.stopped)
    await supabase
      .from("consent_log")
      .insert({ lead_id: lead.id, agreed_to: "Stopped all messages", how: `Client said stop in ${opts.where}` });
  if (score === "Hot" && (lead.score !== "Hot" || ai.intent === "offer")) {
    await supabase.from("alerts").insert({
      lead_id: lead.id,
      kind: "hot",
      message: `HOT: ${lead.name || "A lead"} — ${ai.hotReason || (ai.intent !== "none" ? `requested a ${ai.intent}` : "area, budget and move-in time are known")}.`,
    });
  }
  // Lets the WhatsApp handler know whether this reply changed an appointment (it must then always be sent).
  const appointmentChanged = JSON.stringify(nextState ?? null) !== JSON.stringify(state ?? null);
  return { id: saved.id, reply, stopped: ai.stopped, appointmentChanged };
}
