import { describe, expect, it } from "vitest";
import { b64urlToBytes, bytesToB64url, encryptPayload, vapidAuthorization } from "./webpush";

const enc = new TextEncoder();
const buf = (u: Uint8Array) =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) },
      key,
      bytes * 8,
    ),
  );
}

/** What a browser does with a push: the receiving side of RFC 8291. */
async function decrypt(body: Uint8Array, ua: CryptoKeyPair, auth: Uint8Array) {
  const salt = body.slice(0, 16);
  const idlen = body[20] ?? 0;
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const asKey = await crypto.subtle.importKey(
    "raw",
    buf(asPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256),
  );
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, ecdh, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(nonce) }, key, buf(cipher)),
  );
  expect(plain[plain.length - 1]).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("webpush", () => {
  it("round-trips base64url", () => {
    const bytes = new Uint8Array([0, 251, 255, 62, 63, 1]);
    expect(b64urlToBytes(bytesToB64url(bytes))).toEqual(bytes);
  });

  it("encrypts a message the browser can read", async () => {
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const p256dh = bytesToB64url(await crypto.subtle.exportKey("raw", ua.publicKey));
    const body = await encryptPayload(
      { p256dh, auth: bytesToB64url(auth) },
      '{"title":"New lead"}',
    );
    expect(body[20]).toBe(65);
    expect(await decrypt(body, ua, auth)).toBe('{"title":"New lead"}');
  });

  it("signs a VAPID token the public key verifies", async () => {
    const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const publicKey = bytesToB64url(await crypto.subtle.exportKey("raw", kp.publicKey));
    const header = await vapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc",
      { publicKey, privateJwk: { d: jwk.d!, x: jwk.x!, y: jwk.y! }, subject: "mailto:a@b.c" },
      Date.UTC(2026, 10, 18),
    );
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const [, h, p, s, k] = m!;
    expect(k).toBe(publicKey);
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p!)));
    expect(claims).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:a@b.c" });
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      kp.publicKey,
      buf(b64urlToBytes(s!)),
      enc.encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });
});
