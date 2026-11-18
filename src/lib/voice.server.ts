import { generateSpeech, GatewayError } from "@lovable.dev/ai-gateway";
import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import { oggOpusInfo, voiceReplyDecision, voiceScript } from "./voice";
import { sendBlockReason, type WhatsAppSettingsLike } from "./whatsapp";
import { deliverVoiceReply } from "./whatsapp.server";

type Admin = typeof supabaseAdmin;

/** The gateway's text-to-speech model. It takes no language setting: it speaks the language the text is written in. */
export const SPEECH_MODEL = "openai/gpt-4o-mini-tts";
const SPEECH_TIMEOUT_MS = 45_000;

/**
 * Text → a WhatsApp voice note (OGG/Opus). The one place that calls the text-to-speech service.
 * Throws when the service fails or returns anything other than OGG/Opus, so nothing else is ever sent as "voice".
 */
export async function synthesizeSpeech(
  text: string,
): Promise<{ bytes: Uint8Array; mime: "audio/ogg"; mono: boolean }> {
  let audio: Blob;
  try {
    const result = await generateSpeech(
      {
        model: SPEECH_MODEL,
        input: text,
        voice: "coral",
        response_format: "opus",
        instructions:
          "Speak warmly and clearly at a natural pace, in the same language as the text. Read the text exactly as written; add nothing.",
      },
      { signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS) },
    );
    audio = await result.blob();
  } catch (e) {
    if (e instanceof GatewayError) console.error("Voice AI failure", e.code, e.ids);
    throw new Error("The text-to-speech service could not make the voice reply.");
  }
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const info = oggOpusInfo(bytes);
  if (!info.ok)
    throw new Error(
      "The text-to-speech service did not return OGG/Opus audio, so no voice note was sent.",
    );
  return { bytes, mime: "audio/ogg", mono: info.channels === 1 };
}

/**
 * After the text reply has gone out: also answer a client's voice note with a voice note, when the agency switched
 * Voice replies on. Never throws and never touches the text reply; returns a short note for the webhook outcome.
 */
export async function maybeSendVoiceReply(
  admin: Admin,
  input: {
    messageId: string;
    lead: {
      id: string;
      agency_id: string;
      phone: string;
      stopped: boolean;
      whatsapp_last_inbound_at: string | null;
    };
    settings: WhatsAppSettingsLike | null;
    inboundWasVoice: boolean;
    language: string;
    script: "latin" | "native";
    replyText: string;
  },
): Promise<string> {
  try {
    if (!input.inboundWasVoice) return "";
    // A missing column (schema change not applied yet) reads as "off".
    const { data: rules, error } = await admin
      .from("ai_reply_settings")
      .select("agency_name,voice_replies")
      .eq("agency_id", input.lead.agency_id)
      .maybeSingle();
    if (error || !rules?.voice_replies) return "";
    const decision = voiceReplyDecision({
      enabled: true,
      inboundWasVoice: true,
      language: input.language,
      replyText: input.replyText,
      blockReason: sendBlockReason({
        settings: input.settings,
        to: input.lead.phone,
        stopped: input.lead.stopped,
        lastInboundAt: input.lead.whatsapp_last_inbound_at,
      }),
    });
    if (!decision.send) return `; no voice reply: ${decision.detail}`;
    const { data: earlier, error: earlierError } = await admin
      .from("chat_messages")
      .select("id")
      .eq("lead_id", input.lead.id)
      .eq("voice_status", "sent")
      .limit(1);
    if (earlierError) return "; no voice reply: could not read earlier voice replies";
    const words = voiceScript({
      replyText: input.replyText,
      language: input.language,
      agencyName: rules.agency_name,
      firstVoiceReply: !earlier?.length,
      script: input.script,
    });
    if (!words)
      return "; no voice reply: add the agency name in AI Reply Rules so the voice can say whose AI assistant it is";
    const sent = await deliverVoiceReply(admin, input.messageId, () => synthesizeSpeech(words));
    if (!sent.ok) console.error("Voice reply not sent", input.messageId, sent.reason);
    return sent.ok ? "; voice reply sent" : `; voice reply not sent: ${sent.reason}`;
  } catch (e) {
    console.error(
      "Voice reply failed",
      input.messageId,
      e instanceof Error ? e.message : String(e),
    );
    return "; voice reply failed";
  }
}
