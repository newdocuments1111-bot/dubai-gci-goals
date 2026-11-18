/**
 * Browser-safe rules for the Voice Agent on WhatsApp: the language list, when a voice reply may be sent,
 * what the voice says (the first voice reply in a conversation says it is the agency's AI assistant) and
 * the audio format check. No network, no database: the server parts live in voice.server.ts and whatsapp.server.ts.
 */

/** Spoken replies stay short; longer answers go out as text only. */
export const VOICE_MAX_CHARS = 600;

export type VoiceLanguage = {
  code: string;
  name: string;
  /**
   * True only when the speech model's own documentation lists the language (OpenAI text-to-speech guide,
   * "Supported languages", checked 2026-11-18). False means: text reply only, no voice note.
   */
  voiceOut: boolean;
};

/** The 36 languages most used in Dubai. "Understands" = the client's voice note is transcribed and answered in text. */
export const VOICE_LANGUAGES: readonly VoiceLanguage[] = [
  { code: "en", name: "English", voiceOut: true },
  { code: "ar", name: "Arabic", voiceOut: true },
  { code: "hi", name: "Hindi", voiceOut: true },
  { code: "ur", name: "Urdu", voiceOut: true },
  { code: "ml", name: "Malayalam", voiceOut: false },
  { code: "ta", name: "Tamil", voiceOut: true },
  { code: "te", name: "Telugu", voiceOut: false },
  { code: "bn", name: "Bengali", voiceOut: false },
  { code: "pa", name: "Punjabi", voiceOut: false },
  { code: "gu", name: "Gujarati", voiceOut: false },
  { code: "mr", name: "Marathi", voiceOut: true },
  { code: "kn", name: "Kannada", voiceOut: true },
  { code: "si", name: "Sinhala", voiceOut: false },
  { code: "ne", name: "Nepali", voiceOut: true },
  { code: "tl", name: "Tagalog", voiceOut: true },
  { code: "ru", name: "Russian", voiceOut: true },
  { code: "uk", name: "Ukrainian", voiceOut: true },
  { code: "zh", name: "Mandarin", voiceOut: true },
  { code: "yue", name: "Cantonese", voiceOut: false },
  { code: "fa", name: "Farsi", voiceOut: true },
  { code: "ps", name: "Pashto", voiceOut: false },
  { code: "tr", name: "Turkish", voiceOut: true },
  { code: "fr", name: "French", voiceOut: true },
  { code: "de", name: "German", voiceOut: true },
  { code: "it", name: "Italian", voiceOut: true },
  { code: "es", name: "Spanish", voiceOut: true },
  { code: "pt", name: "Portuguese", voiceOut: true },
  { code: "nl", name: "Dutch", voiceOut: true },
  { code: "pl", name: "Polish", voiceOut: true },
  { code: "ro", name: "Romanian", voiceOut: true },
  { code: "kk", name: "Kazakh", voiceOut: true },
  { code: "uz", name: "Uzbek", voiceOut: false },
  { code: "ko", name: "Korean", voiceOut: true },
  { code: "ja", name: "Japanese", voiceOut: true },
  { code: "id", name: "Indonesian", voiceOut: true },
  { code: "sw", name: "Swahili", voiceOut: true },
];

/** Other spellings the reply model may return for a language (codes, three-letter codes, names). */
const ALIASES: Record<string, string> = {
  english: "en",
  eng: "en",
  arabic: "ar",
  ara: "ar",
  hindi: "hi",
  hin: "hi",
  hinglish: "hi",
  urdu: "ur",
  urd: "ur",
  malayalam: "ml",
  mal: "ml",
  tamil: "ta",
  tam: "ta",
  telugu: "te",
  tel: "te",
  bengali: "bn",
  bangla: "bn",
  ben: "bn",
  punjabi: "pa",
  panjabi: "pa",
  pan: "pa",
  gujarati: "gu",
  guj: "gu",
  marathi: "mr",
  mar: "mr",
  kannada: "kn",
  kan: "kn",
  sinhala: "si",
  sinhalese: "si",
  sin: "si",
  nepali: "ne",
  nep: "ne",
  tagalog: "tl",
  filipino: "tl",
  fil: "tl",
  tgl: "tl",
  russian: "ru",
  rus: "ru",
  ukrainian: "uk",
  ukr: "uk",
  mandarin: "zh",
  chinese: "zh",
  cmn: "zh",
  zho: "zh",
  cantonese: "yue",
  farsi: "fa",
  persian: "fa",
  fas: "fa",
  per: "fa",
  dari: "fa",
  prs: "fa",
  pashto: "ps",
  pushto: "ps",
  pus: "ps",
  turkish: "tr",
  tur: "tr",
  french: "fr",
  fra: "fr",
  fre: "fr",
  german: "de",
  deu: "de",
  ger: "de",
  italian: "it",
  ita: "it",
  spanish: "es",
  spa: "es",
  portuguese: "pt",
  por: "pt",
  dutch: "nl",
  nld: "nl",
  polish: "pl",
  pol: "pl",
  romanian: "ro",
  ron: "ro",
  rum: "ro",
  kazakh: "kk",
  kaz: "kk",
  uzbek: "uz",
  uzb: "uz",
  korean: "ko",
  kor: "ko",
  japanese: "ja",
  jpn: "ja",
  indonesian: "id",
  bahasa: "id",
  ind: "id",
  swahili: "sw",
  kiswahili: "sw",
  swa: "sw",
};

/** Find a language from a code ("hi", "pt-BR", "zh-HK") or a name ("Farsi"). Null when it is not on the list. */
export function voiceLanguage(value: string | null | undefined): VoiceLanguage | null {
  const v = (value ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!v) return null;
  // Chinese written for Hong Kong / Macau is Cantonese when spoken; the speech model only documents "Chinese".
  if (/^(yue|zh-(hk|mo|yue)|cantonese)\b/.test(v)) return byCode("yue");
  const first = v.split(/[-\s(]/)[0] ?? "";
  return byCode(ALIASES[first] ?? first);
}
function byCode(code: string) {
  return VOICE_LANGUAGES.find((l) => l.code === code) ?? null;
}

/** What the voice actually reads: no links, no formatting marks, no emoji (those stay in the text reply). */
export function speakableText(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/[*_~`#>|]/g, " ")
    .replace(/\p{Extended_Pictographic}|‍|️/gu, " ")
    .replace(/[ \t]*\n[ \t\n]*/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,!?;:،。؟])/g, "$1")
    .replace(/\n[.:,;]+(?=\n|$)/g, "")
    .trim();
}

export type VoiceDecisionReason =
  | "ok"
  | "setting_off"
  | "not_a_voice_note"
  | "blocked"
  | "language_not_supported"
  | "empty"
  | "too_long";
export type VoiceDecision = { send: boolean; reason: VoiceDecisionReason; detail: string };

/**
 * Should this AI reply also go out as a voice note? Only when the agency switched Voice replies on, the client's
 * message was a voice note, no send rule blocks it (test mode, STOP, 24-hour window), the speech model documents the
 * language, and there is a short text to say.
 */
export function voiceReplyDecision(input: {
  enabled: boolean;
  inboundWasVoice: boolean;
  language: string | null | undefined;
  replyText: string;
  blockReason: string | null | undefined;
}): VoiceDecision {
  const no = (reason: VoiceDecisionReason, detail: string): VoiceDecision => ({
    send: false,
    reason,
    detail,
  });
  if (!input.enabled) return no("setting_off", "Voice replies are switched off for this agency.");
  if (!input.inboundWasVoice)
    return no("not_a_voice_note", "The client did not send a voice note.");
  if (input.blockReason) return no("blocked", input.blockReason);
  const lang = voiceLanguage(input.language);
  if (!lang)
    return no("language_not_supported", "The reply language is not on the Voice Agent list.");
  if (!lang.voiceOut)
    return no(
      "language_not_supported",
      `The speech model does not list ${lang.name}, so the reply was sent as text only.`,
    );
  if (!VOICE_INTRO[lang.code])
    return no(
      "language_not_supported",
      `There is no AI-assistant introduction for ${lang.name} yet.`,
    );
  const spoken = speakableText(input.replyText);
  if (!spoken) return no("empty", "There is nothing to say out loud.");
  if (spoken.length > VOICE_MAX_CHARS)
    return no(
      "too_long",
      `The reply is longer than ${VOICE_MAX_CHARS} characters, so it was sent as text only.`,
    );
  return { send: true, reason: "ok", detail: `Voice reply in ${lang.name}.` };
}

/** "This is the AI assistant of {agency}" in each language a voice note can be sent in. */
const VOICE_INTRO: Record<string, string> = {
  en: "Hello, this is the AI assistant of {agency}.",
  ar: "مرحباً، أنا مساعد الذكاء الاصطناعي لدى {agency}.",
  hi: "नमस्ते, मैं {agency} का एआई असिस्टेंट हूँ।",
  ur: "السلام علیکم، میں {agency} کا اے آئی اسسٹنٹ ہوں۔",
  ta: "வணக்கம், நான் {agency} நிறுவனத்தின் AI உதவியாளர்.",
  mr: "नमस्कार, मी {agency} चा एआय सहाय्यक आहे.",
  kn: "ನಮಸ್ಕಾರ, ನಾನು {agency} ನ AI ಸಹಾಯಕ.",
  ne: "नमस्ते, म {agency} को एआई सहायक हुँ।",
  tl: "Kumusta, ako ang AI assistant ng {agency}.",
  ru: "Здравствуйте, это ИИ-ассистент компании {agency}.",
  uk: "Вітаю, це ШІ-асистент компанії {agency}.",
  zh: "您好，我是 {agency} 的人工智能助手。",
  fa: "سلام، من دستیار هوش مصنوعی {agency} هستم.",
  tr: "Merhaba, ben {agency} şirketinin yapay zekâ asistanıyım.",
  fr: "Bonjour, je suis l’assistant IA de {agency}.",
  de: "Hallo, ich bin der KI-Assistent von {agency}.",
  it: "Buongiorno, sono l’assistente AI di {agency}.",
  es: "Hola, soy el asistente de IA de {agency}.",
  pt: "Olá, sou o assistente de IA da {agency}.",
  nl: "Hallo, ik ben de AI-assistent van {agency}.",
  pl: "Dzień dobry, jestem asystentem AI firmy {agency}.",
  ro: "Bună ziua, sunt asistentul AI al {agency}.",
  kk: "Сәлеметсіз бе, мен {agency} компаниясының жасанды интеллект көмекшісімін.",
  ko: "안녕하세요, {agency}의 AI 어시스턴트입니다.",
  ja: "こんにちは、{agency}のAIアシスタントです。",
  id: "Halo, saya asisten AI dari {agency}.",
  sw: "Habari, mimi ni msaidizi wa AI wa {agency}.",
};
const HINGLISH_INTRO = "Namaste, main {agency} ka AI assistant hoon.";

/** The sentence that says the voice is the agency's AI assistant. Null when the language has none or the agency has no name. */
export function voiceIntro(
  language: string | null | undefined,
  agencyName: string,
  script: "latin" | "native" = "native",
) {
  const lang = voiceLanguage(language),
    agency = agencyName.trim();
  if (!lang || !agency) return null;
  const line = lang.code === "hi" && script === "latin" ? HINGLISH_INTRO : VOICE_INTRO[lang.code];
  return line ? line.replace("{agency}", agency) : null;
}

/**
 * The exact words to speak. The first voice reply in a conversation always starts by saying it is the agency's
 * AI assistant; without that sentence (no agency name saved, or no wording for the language) there is no voice
 * reply at all, so the function returns null.
 */
export function voiceScript(input: {
  replyText: string;
  language: string | null | undefined;
  agencyName: string;
  firstVoiceReply: boolean;
  script?: "latin" | "native";
}): string | null {
  const spoken = speakableText(input.replyText);
  if (!spoken) return null;
  if (!input.firstVoiceReply) return spoken;
  const intro = voiceIntro(input.language, input.agencyName, input.script);
  return intro ? `${intro}\n${spoken}` : null;
}

/**
 * WhatsApp shows audio as a voice note only when it is an OGG file with the Opus codec (one channel).
 * Reads the first OGG page: "OggS" at the start, then the "OpusHead" header with the channel count.
 */
export function oggOpusInfo(bytes: Uint8Array): { ok: boolean; channels: number } {
  const ascii = (at: number, word: string) =>
    word.split("").every((c, i) => bytes[at + i] === c.charCodeAt(0));
  if (bytes.length < 47 || !ascii(0, "OggS")) return { ok: false, channels: 0 };
  for (let i = 4; i < Math.min(bytes.length - 10, 300); i++) {
    if (ascii(i, "OpusHead")) return { ok: true, channels: bytes[i + 9] ?? 0 };
  }
  return { ok: false, channels: 0 };
}

export function voiceStatusLabel(status: string | null | undefined, error?: string | null) {
  switch (status) {
    case "sent":
      return "Voice reply sent";
    case "sending":
      return "Voice reply sending… (not confirmed yet)";
    case "failed":
      return `Voice reply not sent${error ? `: ${error}` : ""}`;
    default:
      return "";
  }
}

export const VOICE_HELPER_TEXT =
  "When a client sends a voice note, the AI also answers with a voice note in the client's language. The voice says it is an AI assistant.";
