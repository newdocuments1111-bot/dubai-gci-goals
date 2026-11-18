/** Browser side of phone alerts: register the alerts worker and subscribe this device. */
import { b64urlToBytes } from "./webpush";

export type PushSupport = "ok" | "unsupported" | "ios-needs-home-screen" | "blocked";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return ios && !standalone ? "ios-needs-home-screen" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return "ok";
}

async function registration() {
  return navigator.serviceWorker.register("/alerts-sw.js", { scope: "/" });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission and subscribe; returns what the server stores. */
export async function subscribeThisDevice(publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed on this device.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const key = b64urlToBytes(publicKey);
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(
        key.byteOffset,
        key.byteOffset + key.byteLength,
      ) as ArrayBuffer,
    }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys?.["auth"])
    throw new Error("This browser gave no push keys.");
  return {
    endpoint: json.endpoint,
    p256dh: json.keys["p256dh"],
    auth: json.keys["auth"],
    userAgent: navigator.userAgent.slice(0, 300),
  };
}

export async function unsubscribeThisDevice(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

/** A short two-tone chime for new alerts while the app is open (no audio file needed). */
export function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.32);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* sound is optional */
  }
}
