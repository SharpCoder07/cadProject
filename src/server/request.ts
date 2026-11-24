import "server-only";
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { env } from "@/server/env";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/** Client IP and user agent. Trusts the first X-Forwarded-For hop (set by the platform proxy). */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
  };
}

/** Keyed hash so raw IPs are never stored with leads or reviews. */
export const hashIp = (ip: string | null) => (ip ? createHmac("sha256", env.APP_SECRET).update(ip).digest("hex").slice(0, 32) : null);
