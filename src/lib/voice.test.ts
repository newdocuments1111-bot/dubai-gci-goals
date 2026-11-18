import { describe, expect, it } from "vitest";
import {
  oggOpusInfo,
  speakableText,
  VOICE_LANGUAGES,
  VOICE_MAX_CHARS,
  voiceIntro,
  voiceLanguage,
  voiceReplyDecision,
  voiceScript,
  voiceStatusLabel,
} from "./voice";
import { sendBlockReason } from "./whatsapp";

const ok = {
  enabled: true,
  inboundWasVoice: true,
  language: "hi",
  replyText: "जी हाँ, यह अपार्टमेंट उपलब्ध है।",
  blockReason: null,
};

describe("language list", () => {
  it("has the 36 languages most used in Dubai, each once", () => {
    expect(VOICE_LANGUAGES).toHaveLength(36);
    expect(new Set(VOICE_LANGUAGES.map((l) => l.code)).size).toBe(36);
    expect(new Set(VOICE_LANGUAGES.map((l) => l.name)).size).toBe(36);
    for (const name of [
      "English",
      "Arabic",
      "Hindi",
      "Urdu",
      "Malayalam",
      "Tagalog",
      "Russian",
      "Mandarin",
      "Cantonese",
      "Farsi",
      "Swahili",
    ])
      expect(VOICE_LANGUAGES.some((l) => l.name === name)).toBe(true);
  });
  it("marks voice-out only for languages the speech model documents", () => {
    expect(VOICE_LANGUAGES.filter((l) => !l.voiceOut).map((l) => l.name)).toEqual([
      "Malayalam",
      "Telugu",
      "Bengali",
      "Punjabi",
      "Gujarati",
      "Sinhala",
      "Cantonese",
      "Pashto",
      "Uzbek",
    ]);
  });
  it("has an AI-assistant introduction for every voice-out language", () => {
    for (const l of VOICE_LANGUAGES.filter((x) => x.voiceOut))
      expect(voiceIntro(l.code, "Dubai Homes"), l.name).toContain("Dubai Homes");
  });
  it("finds a language from codes and names", () => {
    expect(voiceLanguage("hi")?.name).toBe("Hindi");
    expect(voiceLanguage("pt-BR")?.name).toBe("Portuguese");
    expect(voiceLanguage("Farsi")?.code).toBe("fa");
    expect(voiceLanguage("Persian (Iran)")?.code).toBe("fa");
    expect(voiceLanguage("fil")?.name).toBe("Tagalog");
    expect(voiceLanguage("zh_CN")?.name).toBe("Mandarin");
    expect(voiceLanguage("zh-HK")?.name).toBe("Cantonese");
    expect(voiceLanguage("yue")?.name).toBe("Cantonese");
    expect(voiceLanguage("xx")).toBeNull();
    expect(voiceLanguage("")).toBeNull();
    expect(voiceLanguage(null)).toBeNull();
  });
});

describe("voice reply decision", () => {
  it("sends a voice reply to a voice note when the setting is on", () => {
    expect(voiceReplyDecision(ok)).toMatchObject({ send: true, reason: "ok" });
  });
  it("is off unless the agency switched it on", () => {
    expect(voiceReplyDecision({ ...ok, enabled: false })).toMatchObject({
      send: false,
      reason: "setting_off",
    });
  });
  it("never answers a typed message with a voice note", () => {
    expect(voiceReplyDecision({ ...ok, inboundWasVoice: false })).toMatchObject({
      send: false,
      reason: "not_a_voice_note",
    });
  });
  it("follows every WhatsApp send block (test mode, STOP, 24-hour window)", () => {
    const settings = { phone_number_id: "1", test_mode: true, test_recipients: ["919989649633"] };
    const now = new Date("2026-10-27T10:00:00Z"),
      recent = "2026-10-27T09:00:00Z";
    const testMode = sendBlockReason({
      settings,
      to: "+971501234567",
      stopped: false,
      lastInboundAt: recent,
      now,
    });
    const stopped = sendBlockReason({
      settings,
      to: "+919989649633",
      stopped: true,
      lastInboundAt: recent,
      now,
    });
    const closed = sendBlockReason({
      settings,
      to: "+919989649633",
      stopped: false,
      lastInboundAt: "2026-10-25T09:00:00Z",
      now,
    });
    for (const blockReason of [testMode, stopped, closed]) {
      expect(blockReason).toBeTruthy();
      expect(voiceReplyDecision({ ...ok, blockReason })).toEqual({
        send: false,
        reason: "blocked",
        detail: blockReason,
      });
    }
    expect(
      voiceReplyDecision({
        ...ok,
        blockReason: sendBlockReason({
          settings,
          to: "+919989649633",
          stopped: false,
          lastInboundAt: recent,
          now,
        }),
      }).send,
    ).toBe(true);
  });
  it("sends text only in languages the speech model does not document", () => {
    for (const language of ["ml", "Telugu", "bn", "yue", "zh-HK", "ps", "uz"])
      expect(voiceReplyDecision({ ...ok, language })).toMatchObject({
        send: false,
        reason: "language_not_supported",
      });
    expect(voiceReplyDecision({ ...ok, language: "xx" })).toMatchObject({
      send: false,
      reason: "language_not_supported",
    });
    expect(voiceReplyDecision({ ...ok, language: null })).toMatchObject({
      send: false,
      reason: "language_not_supported",
    });
  });
  it("needs something to say", () => {
    expect(voiceReplyDecision({ ...ok, replyText: "  " })).toMatchObject({
      send: false,
      reason: "empty",
    });
    expect(
      voiceReplyDecision({ ...ok, replyText: "https://maps.google.com/?q=1,2 👍" }),
    ).toMatchObject({ send: false, reason: "empty" });
  });
  it("keeps long answers as text only", () => {
    expect(
      voiceReplyDecision({ ...ok, language: "en", replyText: "a".repeat(VOICE_MAX_CHARS) }).send,
    ).toBe(true);
    expect(
      voiceReplyDecision({ ...ok, language: "en", replyText: "a".repeat(VOICE_MAX_CHARS + 1) }),
    ).toMatchObject({ send: false, reason: "too_long" });
  });
});

describe("what the voice says", () => {
  it("starts the first voice reply by saying it is the agency AI assistant", () => {
    expect(
      voiceScript({
        replyText: "Yes, it is available.",
        language: "en",
        agencyName: "Dubai Homes",
        firstVoiceReply: true,
      }),
    ).toBe("Hello, this is the AI assistant of Dubai Homes.\nYes, it is available.");
    expect(
      voiceScript({
        replyText: "نعم، الشقة متاحة.",
        language: "ar",
        agencyName: "Dubai Homes",
        firstVoiceReply: true,
      }),
    ).toMatch(/^مرحباً، أنا مساعد الذكاء الاصطناعي لدى Dubai Homes\.\n/);
  });
  it("does not repeat the introduction in later voice replies", () => {
    expect(
      voiceScript({
        replyText: "Yes, it is available.",
        language: "en",
        agencyName: "Dubai Homes",
        firstVoiceReply: false,
      }),
    ).toBe("Yes, it is available.");
  });
  it("uses Latin letters for Hinglish", () => {
    expect(
      voiceScript({
        replyText: "Ji haan, available hai.",
        language: "hi",
        agencyName: "Dubai Homes",
        firstVoiceReply: true,
        script: "latin",
      }),
    ).toBe("Namaste, main Dubai Homes ka AI assistant hoon.\nJi haan, available hai.");
  });
  it("refuses a first voice reply that cannot say who is speaking", () => {
    expect(
      voiceScript({ replyText: "Yes.", language: "en", agencyName: "  ", firstVoiceReply: true }),
    ).toBeNull();
    expect(
      voiceScript({
        replyText: "Yes.",
        language: "ml",
        agencyName: "Dubai Homes",
        firstVoiceReply: true,
      }),
    ).toBeNull();
    expect(
      voiceScript({
        replyText: " ",
        language: "en",
        agencyName: "Dubai Homes",
        firstVoiceReply: false,
      }),
    ).toBeNull();
  });
  it("does not read links, formatting marks or emoji aloud", () => {
    expect(
      speakableText(
        "*Marina Gate* 👋 is available.\n\nMap: https://maps.google.com/?q=25.1,55.2\nSee www.example.com now",
      ),
    ).toBe("Marina Gate is available.\nMap:\nSee now");
    expect(speakableText("Price is AED 2,500,000.")).toBe("Price is AED 2,500,000.");
  });
});

describe("audio format", () => {
  const page = (channels: number, head = "OpusHead") => {
    const b = new Uint8Array(64);
    b.set(
      [..."OggS"].map((c) => c.charCodeAt(0)),
      0,
    );
    b.set(
      [...head].map((c) => c.charCodeAt(0)),
      28,
    );
    b[28 + 8] = 1;
    b[28 + 9] = channels;
    return b;
  };
  it("accepts OGG/Opus and reads the channel count", () => {
    expect(oggOpusInfo(page(1))).toEqual({ ok: true, channels: 1 });
    expect(oggOpusInfo(page(2))).toEqual({ ok: true, channels: 2 });
  });
  it("rejects MP3, OGG/Vorbis and empty audio", () => {
    expect(
      oggOpusInfo(
        new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, ...new Array<number>(60).fill(0)]),
      ).ok,
    ).toBe(false);
    expect(oggOpusInfo(page(1, "\u0001vorbis")).ok).toBe(false);
    expect(oggOpusInfo(new Uint8Array()).ok).toBe(false);
  });
});

describe("thread marker", () => {
  it("labels the voice reply on the message", () => {
    expect(voiceStatusLabel("sent")).toBe("Voice reply sent");
    expect(voiceStatusLabel("failed", "Meta refused")).toBe("Voice reply not sent: Meta refused");
    expect(voiceStatusLabel(null)).toBe("");
  });
});
