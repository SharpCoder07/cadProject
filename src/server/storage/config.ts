import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { decryptSecret } from "@/server/crypto";
import type { AzureConfig } from "./azure";

/**
 * Media storage settings, managed in Admin → Integrations → Media storage and saved in the
 * Integration table. Until something is saved there, the STORAGE_DRIVER / AZURE_STORAGE_* /
 * S3_* environment variables decide. The Azure access key is stored encrypted (key from APP_SECRET).
 */
export const STORAGE_CONFIG_KEY = "storage.config";

export const storedStorageConfig = z.object({
  driver: z.enum(["local", "azure"]).default("local"),
  account: z.string().default(""),
  keyEnc: z.string().default(""),
  container: z.string().default(""),
  publicUrl: z.string().default(""),
});
export type StoredStorageConfig = z.infer<typeof storedStorageConfig>;

export interface EffectiveStorageConfig {
  driver: "local" | "azure" | "s3";
  source: "admin" | "env";
  azure: AzureConfig | null;
}

export async function loadStoredStorageConfig() {
  const row = await db.integration.findUnique({ where: { key: STORAGE_CONFIG_KEY } });
  return row ? storedStorageConfig.parse(row.config ?? {}) : null;
}

export async function loadStorageConfig(): Promise<EffectiveStorageConfig> {
  const stored = await loadStoredStorageConfig().catch((e) => {
    console.error("[storage] couldn't read storage settings, using environment variables", e);
    return null;
  });
  if (stored) {
    const key = stored.keyEnc ? decryptSecret(stored.keyEnc) : null;
    const azure = stored.account && stored.container && key ? { account: stored.account, key, container: stored.container, publicUrl: stored.publicUrl } : null;
    if (stored.driver === "azure" && !azure) console.error("[storage] Azure is selected but its settings are incomplete or the key can't be read; new uploads go to local storage.");
    return { driver: stored.driver === "azure" && azure ? "azure" : "local", source: "admin", azure };
  }
  const azure =
    env.AZURE_STORAGE_ACCOUNT && env.AZURE_STORAGE_KEY && env.AZURE_STORAGE_CONTAINER
      ? { account: env.AZURE_STORAGE_ACCOUNT, key: env.AZURE_STORAGE_KEY, container: env.AZURE_STORAGE_CONTAINER, publicUrl: env.STORAGE_PUBLIC_URL ?? "" }
      : null;
  return { driver: env.STORAGE_DRIVER, source: "env", azure };
}
