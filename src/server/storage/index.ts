import "server-only";
import { loadStorageConfig, type EffectiveStorageConfig } from "./config";

export type StorageProvider = "local" | "azure" | "s3";

export interface StoredObject {
  key: string;
  url: string;
  provider: StorageProvider;
}

export interface StorageDriver {
  readonly provider: StorageProvider;
  /** Public URL prefix every stored file's URL starts with (ends with "/"). */
  readonly baseUrl: string;
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  /** File bytes, or null when the key doesn't exist. */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Keys in key order, `limit` at a time; pass the returned `next` to continue. */
  list(cursor: string | null, limit: number): Promise<{ keys: string[]; next: string | null }>;
}

/**
 * Storage is chosen in Admin → Integrations → Media storage (falls back to the STORAGE_* environment
 * variables until something is saved there). The config is re-read at most every 30 seconds, and at
 * once in the process that saved it.
 */
let cached: { at: number; config: EffectiveStorageConfig; drivers: Map<StorageProvider, StorageDriver> } | null = null;
const TTL_MS = 30_000;

async function state() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  cached = { at: Date.now(), config: await loadStorageConfig(), drivers: new Map() };
  return cached;
}

export function resetStorageCache() {
  cached = null;
}

async function build(provider: StorageProvider, config: EffectiveStorageConfig): Promise<StorageDriver> {
  if (provider === "azure") {
    if (!config.azure) throw new Error("Azure Blob Storage isn't set up. Add it in Admin → Integrations → Media storage.");
    const { AzureBlobStorage } = await import("./azure");
    return new AzureBlobStorage(config.azure);
  }
  if (provider === "s3") {
    const { S3Storage } = await import("./s3");
    return new S3Storage();
  }
  const { LocalStorage } = await import("./local");
  return new LocalStorage();
}

/** A specific storage, e.g. to delete a file from where it was saved, or to move files between stores. */
export async function getStorageFor(provider: StorageProvider): Promise<StorageDriver> {
  const s = await state();
  let d = s.drivers.get(provider);
  if (!d) {
    d = await build(provider, s.config);
    s.drivers.set(provider, d);
  }
  return d;
}

/** The storage new uploads go to. */
export async function getStorage(): Promise<StorageDriver> {
  return getStorageFor((await state()).config.driver);
}

/** Which storage a stored URL lives in (by its prefix), so it can be deleted from the right place. */
export async function providerForUrl(url: string): Promise<StorageProvider | null> {
  for (const p of ["azure", "s3", "local"] as const) {
    const d = await getStorageFor(p).catch(() => null);
    if (d && url.startsWith(d.baseUrl)) return p;
  }
  return null;
}

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  svg: "image/svg+xml", ico: "image/x-icon", pdf: "application/pdf", txt: "text/plain; charset=utf-8",
};
export const contentTypeFor = (key: string) => CONTENT_TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
