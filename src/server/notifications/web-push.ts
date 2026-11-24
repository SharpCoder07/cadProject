import "server-only";
import { createCipheriv, createECDH, createPrivateKey, generateKeyPairSync, hkdfSync, randomBytes, sign, type KeyObject } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { decryptSecret, encryptSecret } from "@/server/crypto";

/**
 * Web Push without a package: VAPID (RFC 8292, ES256 JWT) and payload encryption
 * (RFC 8291, aes128gcm). Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or are generated
 * once and kept in the Integration table (private key encrypted with APP_SECRET).
 */
const VAPID_KEY = "push.vapid";

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const fromB64u = (s: string) => Buffer.from(s.replace(/=+$/, ""), "base64url");

interface Vapid { publicKey: string; privateKey: KeyObject }
let cached: Vapid | null = null;

function toKeyObject(publicKey: string, d: string): KeyObject {
  const pub = fromB64u(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID public key must be an uncompressed P-256 point.");
  return createPrivateKey({ key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)), d }, format: "jwk" });
}

function generate() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  const publicKey = b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x!), fromB64u(jwk.y!)]));
  return { publicKey, d: jwk.d! };
}

/** The VAPID key pair (the public key goes to browsers as applicationServerKey). */
export async function getVapid(): Promise<Vapid> {
  if (cached) return cached;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: toKeyObject(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY) };
    return cached;
  }
  const read = async () => {
    const row = await db.integration.findUnique({ where: { key: VAPID_KEY } });
    const cfg = (row?.config ?? null) as { publicKey?: string; privateKeyEnc?: string } | null;
    const d = cfg?.privateKeyEnc ? decryptSecret(cfg.privateKeyEnc) : null;
    return cfg?.publicKey && d ? { publicKey: cfg.publicKey, d } : null;
  };
  let keys = await read();
  if (!keys) {
    // First use (or APP_SECRET changed): make a new pair. Existing browser subscriptions stop working
    // in the second case, so they are cleared and people turn notifications on again.
    const fresh = generate();
    const config = { publicKey: fresh.publicKey, privateKeyEnc: encryptSecret(fresh.d) } as Prisma.InputJsonValue;
    const existing = await db.integration.findUnique({ where: { key: VAPID_KEY }, select: { key: true } });
    if (existing) {
      await db.integration.update({ where: { key: VAPID_KEY }, data: { config, isEnabled: true } });
      await db.pushSubscription.deleteMany({});
    } else {
      try {
        await db.integration.create({ data: { key: VAPID_KEY, isEnabled: true, config } });
      } catch {
        /* created at the same moment by another request: use that one */
      }
    }
    keys = (await read()) ?? fresh;
  }
  cached = { publicKey: keys.publicKey, privateKey: toKeyObject(keys.publicKey, keys.d) };
  return cached;
}

function subject() {
  if (env.VAPID_SUBJECT) return env.VAPID_SUBJECT;
  if (env.APP_URL.startsWith("https://")) return env.APP_URL;
  const from = /<([^>]+@[^>]+\.[^>]+)>/.exec(env.EMAIL_FROM)?.[1];
  return from ? `mailto:${from}` : "mailto:admin@example.com";
}

function vapidHeader(endpoint: string, v: Vapid) {
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject() })));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key: v.privateKey, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${v.publicKey}`;
}

/** RFC 8291 aes128gcm encryption of one push message (single record). */
function encrypt(payload: Buffer, p256dh: string, auth: string): Buffer {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const ecdh = createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

export interface PushTarget { endpoint: string; p256dh: string; auth: string }
export interface PushMessage { title: string; body?: string | null; href?: string | null; tag?: string }

/** Sends one push. Returns the push service's HTTP status (404/410 mean the subscription is gone). */
export async function sendWebPush(target: PushTarget, message: PushMessage): Promise<number> {
  const url = new URL(target.endpoint);
  if (url.protocol !== "https:") return 400;
  const v = await getVapid();
  const payload = Buffer.from(JSON.stringify(message).slice(0, 3000));
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidHeader(target.endpoint, v),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(24 * 3600),
      Urgency: "normal",
    },
    body: new Uint8Array(encrypt(payload, target.p256dh, target.auth)),
    signal: AbortSignal.timeout(10_000),
  });
  return res.status;
}
