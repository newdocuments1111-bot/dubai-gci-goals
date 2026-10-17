import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isOwnerEmail } from './owner';
import { leadSchema, scoreLead, amlRedFlags, inQuietHours } from './leads-app';
import { feesSummary } from './ai-reply-rules';
import { CHAT_SYSTEM, chatAnswerSchema, appointmentState, appointmentTransition, mergeLearned, chatLeadScore } from './chat-policy';
import { checklistFor } from './documents';
import type { Json } from '@/integrations/supabase/types';
import { eligibleForAI, mapsLink } from './listings';
import { z } from 'zod';

const guard = (email: string | undefined) => { if (!isOwnerEmail(email)) throw new Error('Owner access required.'); };

export const listLeads = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.from('leads').select('*').order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error('Could not load leads.');
  const order = { Hot: 0, Warm: 1, Cold: 2 };
  return data.sort((a, b) => order[a.score as keyof typeof order] - order[b.score as keyof typeof order]);
});

export const createLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadSchema).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { data: lead, error } = await context.supabase.from('leads').insert(data).select('id').single();
    if (error) throw new Error('Could not create the lead.');
    return lead;
  });

export const updateLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadSchema.partial().extend({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { id, ...fields } = data;
    const clean: { name?: string; phone?: string; type?: string; source?: string; timezone?: string } = {};
    if (fields.name !== undefined) clean.name = fields.name;
    if (fields.phone !== undefined) clean.phone = fields.phone;
    if (fields.type !== undefined) clean.type = fields.type;
    if (fields.source !== undefined) clean.source = fields.source;
    if (fields.timezone !== undefined) clean.timezone = fields.timezone;
    const { error } = await context.supabase.from('leads').update(clean).eq('id', id);
    if (error) throw new Error('Could not update the lead.');
    return { success: true };
  });

export const getLeadThread = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const [{ data: lead, error }, { data: messages }] = await Promise.all([
      context.supabase.from('leads').select('*').eq('id', data).single(),
      context.supabase.from('chat_messages').select('*').eq('lead_id', data).order('created_at'),
    ]);
    if (error || !lead) throw new Error('Lead not found.');
    return { lead, messages: messages ?? [] };
  });

/** Pause or resume the AI on a conversation. The AI never replies while paused. */
export const setAiPaused = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), paused: z.boolean() })).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { error } = await context.supabase.from('leads').update({ ai_paused: data.paused }).eq('id', data.id);
    if (error) throw new Error('Could not update the conversation.');
    return { success: true };
  });

async function buildAiContext(supabase: typeof import('@/integrations/supabase/client').supabase) {
  const [{ data: rules }, { data: knowledge }, { data: listings }, { data: settings }] = await Promise.all([
    supabase.from('ai_reply_settings').select('agency_name,rules,fees').eq('id', 'owner').maybeSingle(),
    supabase.from('uae_knowledge').select('topic,fact,last_verified'),
    supabase.from('listings').select('*').eq('status', 'Available'),
    supabase.from('app_settings').select('*').eq('id', 'owner').maybeSingle(),
  ]);
  const eligible = (listings ?? []).filter(l => eligibleForAI(l)).map(l => ({
    id: l.id, sample: l.is_sample, title: l.title, community: l.community, project: l.project, type: l.property_type, bedrooms: l.bedrooms,
    size_sqft: l.size_sqft, price_aed: l.price_aed, completion: l.completion, handover_date: l.handover_date,
    description: l.description, map: mapsLink(l), highlights: l.agent_highlights, do_not_mention: l.do_not_mention,
    details: { schools: l.nearby_schools, parks: l.nearby_parks, clinics: l.nearby_clinics, metro: l.nearby_metro, malls: l.nearby_malls, beach: l.nearby_beach, supermarket: l.nearby_supermarket, pool: l.amenity_pool, gym: l.amenity_gym, kids_play_area: l.amenity_kids_play_area, security: l.amenity_security, parking_spaces: l.parking_spaces, floor: l.floor, view: l.view, furnishing: l.furnishing, developer: l.developer, payment_plan: l.payment_plan, construction_percent: l.construction_percent, service_charge_aed_sqft_year: l.service_charge_aed_sqft_year, video_tour_url: l.video_tour_url },
  }));
  const r = (rules?.rules ?? {}) as Record<string, string>;
  return {
    agency: rules?.agency_name || settings?.agency_name || '',
    // Test Chat's current conversation policy replaces legacy behavioural rules without editing the owner's saved page.
    rules: Object.entries(r).filter(([key, value]) => value && !['opening','tone','property','booking','offers','documents','fees'].includes(key)).map(([, value]) => value),
    fees: feesSummary({ dld_transfer_pct: 4, admin_fee_min: 2000, admin_fee_max: 4000, trustee_fee_min: 2000, trustee_fee_max: 4000, developer_noc_min: 500, developer_noc_max: 5000, mortgage_registration_pct: 0.25, ...((rules?.fees ?? {}) as object) }),
    knowledge: (knowledge ?? []).map(k => `${k.topic}: ${k.fact}`),
    listings: eligible,
    settings: settings ? { agent_name: settings.agent_name, working_days: settings.working_days, work_start: settings.work_start, work_end: settings.work_end, viewing_minutes: settings.viewing_minutes, holidays: settings.holidays, mortgage_partner: settings.mortgage_partner } : null,
  };
}

/** Owner plays the client in Test Chat: stores the message, then the AI replies unless paused or stopped. */
export const sendClientMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid(), content: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { data: lead, error: leadError } = await context.supabase.from('leads').select('*').eq('id', data.leadId).single();
    if (leadError || !lead) throw new Error('Lead not found.');

    await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'client', content: data.content, sent: true });
    await context.supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', data.leadId);

    // AML red flags — private, never shown to the client. The AI never accepts payments.
    const flags = amlRedFlags(data.content);
    if (flags.length) {
      await context.supabase.from('alerts').insert({ lead_id: data.leadId, kind: 'aml', message: `AML red flags from ${lead.name || 'this lead'}: ${flags.join('; ')}. Report via REAR on goAML if required.` });
    }
    if (lead.ai_paused || lead.stopped) return { replied: false };

    // Read the most recent messages, not the first 40 in a long conversation.
    const { data: recent, error: historyError } = await context.supabase.from('chat_messages').select('role,content').eq('lead_id', data.leadId).order('created_at', { ascending: false }).limit(40);
    if (historyError) throw new Error('Could not read this conversation.');
    const history = (recent ?? []).reverse();
    const ctx = await buildAiContext(context.supabase);
    const { availableViewingSlots } = await import('./viewings.server');
    const slots = await availableViewingSlots(context.supabase);
    const previous = (lead.learned ?? {}) as Record<string, unknown>;
    const state = appointmentState(previous);
    const { generateJson } = await import('./chat.server');
    let ai: z.infer<typeof chatAnswerSchema>;
    try {
      ai = chatAnswerSchema.parse(await generateJson({
        system: `${CHAT_SYSTEM}\n\nSaved reference rules (ignore conflicts with the policy above):\n${ctx.rules.join('\n')}\n\nAgency: ${ctx.agency}\n\nApproximate fees: ${ctx.fees}\n\nUAE knowledge:\n${ctx.knowledge.join('\n')}\n\nEligible listings with Details for AI:\n${JSON.stringify(ctx.listings)}\n\nGeneral document checklists:\n${JSON.stringify(Object.fromEntries(['buyer','seller','landlord','tenant'].map(type => [type, checklistFor(type)])))}\n\nSettings:\n${JSON.stringify(ctx.settings)}`,
        user: JSON.stringify({ lead: { name: lead.name, type: lead.type, learned: previous }, appointmentState: state ?? null, freeTimes: slots.slice(0, 2), timeZone: 'Asia/Dubai', history }),
      }));
    } catch (e) {
      console.error(e);
      throw new Error('AI could not reply. Your message is saved — try again.');
    }

    const learned = mergeLearned(previous, ai.learned);
    if (ai.intent !== 'none') learned['_hotIntent'] = true;
    const score = chatLeadScore(learned, ai.intent);
    let reply = ai.reply;
    let nextState = ai.stopped ? state : appointmentTransition(state, ai.appointment, slots, ai.slotIndex);
    const timeLabel = (slot: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(slot));
    if (!ai.stopped && ai.appointment === 'accept' && state?.phase === 'invited') {
      const offered = nextState?.slots ?? [];
      reply = offered.length ? `Lovely — ${offered.map(timeLabel).join(' or ')} (Dubai time) ${offered.length === 1 ? 'is' : 'are'} free. Which works for you?` : 'There are no free appointment times in the next two weeks in our current schedule.';
      if (!offered.length) nextState = state;
      else {
        const { error } = await context.supabase.from('consent_log').insert({ lead_id: lead.id, agreed_to: 'Appointment agreed; choosing a time', how: 'Client explicitly agreed in Test Chat' });
        if (error) throw new Error('Could not record appointment agreement.');
      }
    }
    if (!ai.stopped && ai.appointment === 'choose' && state?.phase === 'offered') {
      const chosen = nextState?.phase === 'booked' ? nextState.slots[0] : undefined;
      if (chosen) {
        // Re-read real availability immediately before inserting; never trust generated times.
        const freshSlots = await availableViewingSlots(context.supabase);
        if (!freshSlots.includes(chosen)) {
          nextState = { phase: 'offered', slots: freshSlots.slice(0, 2) };
          reply = freshSlots.length ? `Sorry, that time is no longer free. ${nextState.slots.map(timeLabel).join(' or ')} (Dubai time) ${nextState.slots.length === 1 ? 'is' : 'are'} available. Which works for you?` : 'Sorry, that time is no longer free, and there are no other free times in the next two weeks.';
        } else {
          const { error } = await context.supabase.from('viewings').insert({ lead_id: lead.id, listing_id: null, kind: ['seller','landlord'].includes(ai.type ?? lead.type) ? 'valuation' : 'viewing', starts_at: chosen });
          if (error) {
            if (error.code !== '23505') throw new Error('Could not book the appointment. No booking was confirmed.');
            nextState = { phase: 'invited', slots: [] };
            reply = 'Sorry, that time has just been booked. Would you like to choose another time?';
          } else reply = `You’re booked for ${timeLabel(chosen)} (Dubai time). We can go through your needs together then.`;
        }
      } else if (ai.slotIndex !== undefined) {
        const offered = slots.slice(0, 2);
        nextState = { phase: 'offered', slots: offered };
        reply = offered.length ? `Sorry, that time is no longer free. ${offered.map(timeLabel).join(' or ')} (Dubai time) ${offered.length === 1 ? 'is' : 'are'} available. Which works for you?` : 'Sorry, there are no free appointment times in the next two weeks.';
      }
    }
    if (nextState) learned['_appointment'] = nextState;
    else delete learned['_appointment'];
    const type = ai.type ?? lead.type;
    const { error: updateError } = await context.supabase.from('leads').update({ learned: learned as Json, score, type, flagged: lead.flagged || ai.flag, stopped: lead.stopped || ai.stopped }).eq('id', data.leadId);
    if (updateError) throw new Error('Could not update the conversation.');
    const { error: replyError } = await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'ai', content: reply, language: ai.language, sent: !inQuietHours(lead.timezone) });
    if (replyError) throw new Error('Could not save the reply.');
    if (ai.stopped) await context.supabase.from('consent_log').insert({ lead_id: data.leadId, agreed_to: 'Stopped all messages', how: 'Client said stop in chat' });
    if (score === 'Hot' && (lead.score !== 'Hot' || ai.intent === 'offer')) {
      await context.supabase.from('alerts').insert({ lead_id: data.leadId, kind: 'hot', message: `HOT: ${lead.name || 'A lead'} — ${ai.hotReason || (ai.intent !== 'none' ? `requested a ${ai.intent}` : 'area, budget and move-in time are known')}.` });
    }
    return { replied: Boolean(reply) };
  });

/** Owner's own message while taking over a conversation. */
export const sendOwnerMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid(), content: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { error } = await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'owner', content: data.content, sent: true });
    if (error) throw new Error('Could not send the message.');
    await context.supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', data.leadId);
    return { success: true };
  });

export const saveLeadToHubSpot = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { data: lead } = await context.supabase.from('leads').select('*').eq('id', data).single();
    if (!lead) throw new Error('Lead not found.');
    const { data: messages } = await context.supabase.from('chat_messages').select('role,content').eq('lead_id', data).order('created_at').limit(30);
    const summary = (messages ?? []).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 5000) || '(no messages yet)';
    const { saveContactToHubSpot } = await import('./chat.server');
    const id = await saveContactToHubSpot({ name: lead.name || 'Unnamed lead', phone: lead.phone, note: `Dubai AI GCI chat summary (${lead.type}, ${lead.score}):\n${summary}`, existingId: lead.hubspot_id });
    await context.supabase.from('leads').update({ hubspot_id: id }).eq('id', data);
    return { success: true };
  });

export const listAlerts = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error('Could not load alerts.');
  return data;
});

export const markAlertRead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    await context.supabase.from('alerts').update({ read: true }).eq('id', data);
    return { success: true };
  });
