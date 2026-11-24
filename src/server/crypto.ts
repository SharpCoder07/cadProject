import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/server/env";

/**
 * AES-256-GCM for secrets stored in the database (e.g. the SMTP password).
 * The key is derived from APP_SECRET, so changing APP_SECRET makes stored secrets unreadable
 * (admins are then asked to enter them again).
 */
const key = () => createHash("sha256").update(`${env.APP_SECRET}:db-secrets:v1`).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Returns null when the value can't be decrypted (tampered, or APP_SECRET changed). */
export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
