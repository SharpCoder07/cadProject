import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { ALL_CACHE_TAGS } from "@/server/cache-tags";
import { AzureBlobStorage, AzureError, type AzureConfig } from "./azure";
import { LocalStorage } from "./local";
import { STORAGE_CONFIG_KEY, loadStorageConfig, loadStoredStorageConfig, storedStorageConfig, type StoredStorageConfig } from "./config";
import { contentTypeFor, getStorageFor, resetStorageCache, type StorageProvider } from "./index";

const TEST_PREFIX = "_cadgram-test/";

/* ────────────────────────── Admin view ────────────────────────── */

export async function getStorageAdminView(user: Principal) {
  assertCan(user, "integrations.manage");
  const [stored, effective, localFiles, media] = await Promise.all([
    loadStoredStorageConfig(),
    loadStorageConfig(),
    new LocalStorage().count(),
    db.mediaAsset.groupBy({ by: ["provider"], _count: { _all: true } }),
  ]);
  const azure = stored ?? (effective.azure ? { account: effective.azure.account, container: effective.azure.container, publicUrl: effective.azure.publicUrl, keyEnc: "" } : null);
  const hasKey = Boolean(stored ? stored.keyEnc : effective.azure?.key);
  return {
    source: effective.source,
    active: effective.driver,
    envDriver: env.STORAGE_DRIVER,
    production: env.NODE_ENV === "production",
    account: azure?.account ?? "",
    container: azure?.container || "uploads",
    publicUrl: azure?.publicUrl ?? "",
    hasKey,
    keyReadable: !stored?.keyEnc || decryptSecret(stored.keyEnc) !== null,
    azureReady: Boolean(effective.azure),
    azureBaseUrl: effective.azure ? new AzureBlobStorage(effective.azure).baseUrl : null,
    localFiles,
    mediaByProvider: Object.fromEntries(media.map((m) => [m.provider, m._count._all])) as Record<string, number>,
  };
}
export type StorageAdminView = Awaited<ReturnType<typeof getStorageAdminView>>;

/* ────────────────────────── Azure connection ────────────────────────── */

export const azureInput = z.object({
  account: z.string().trim().toLowerCase().regex(/^[a-z0-9]{3,24}$/, "3–24 lowercase letters and numbers, as shown in the Azure portal"),
  /** Blank keeps the stored key. */
  key: z.string().trim().max(200).optional().default(""),
  container: z.string().trim().toLowerCase().regex(/^(?!-)(?!.*--)[a-z0-9-]{3,63}(?<!-)$/, "3–63 lowercase letters, numbers and single hyphens, e.g. uploads"),
  publicUrl: z.union([z.string().trim().url("Enter a full URL like https://media.cadgram.com").refine((u) => u.startsWith("https://"), "Use an https:// address"), z.literal("")]).default(""),
});
export type AzureInput = z.infer<typeof azureInput>;

async function resolveAzure(input: AzureInput): Promise<AzureConfig> {
  let key = input.key;
  if (!key) {
    const effective = await loadStorageConfig();
    key = effective.azure && effective.azure.account === input.account ? effective.azure.key : "";
  }
  if (!key) throw new AppError("Enter the access key.", "BAD_REQUEST", { key: ["Enter the access key"] });
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(key) || Buffer.from(key, "base64").length < 32) {
    throw new AppError("That doesn't look like an Azure access key.", "BAD_REQUEST", { key: ["Paste key1 or key2 from Storage account → Security + networking → Access keys"] });
  }
  return { account: input.account, key, container: input.container, publicUrl: input.publicUrl.replace(/\/+$/, "") };
}

function friendly(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (!(e instanceof AzureError)) {
    console.error("[storage] Azure test failed", e);
    return new AppError("The Azure test failed unexpectedly. The error has been logged.");
  }
  switch (e.code) {
    case "AccountNotFound":
      return new AppError(e.message, "BAD_REQUEST", { account: ["No storage account with this name"] });
    case "AuthenticationFailed":
    case "InvalidAuthenticationInfo":
      return new AppError("Azure rejected the access key.", "BAD_REQUEST", { key: ["Copy key1 or key2 again from Storage account → Security + networking → Access keys"] });
    case "AuthorizationFailure":
    case "AuthorizationPermissionMismatch":
      return new AppError("Azure refused the request. If the storage account has a firewall (Networking → Public network access), allow this server's IP address.");
    case "PublicAccessNotPermitted":
      return new AppError(
        "Public read access is turned off for this storage account, so website visitors couldn't see the images. In the Azure portal open the storage account → Settings → Configuration, set “Allow Blob anonymous access” to Enabled, save, and test again.",
      );
    case "InvalidResourceName":
    case "ContainerBeingDeleted":
      return new AppError(`Azure didn't accept that container (${e.code}).`, "BAD_REQUEST", { container: ["Use a different container name"] });
    default:
      return new AppError(`Azure said: ${e.code}${e.message ? ` — ${e.message}` : ""}`);
  }
}

/** Creates the container if needed, uploads a small file, opens it by its public link, then deletes it. */
async function runAzureTest(cfg: AzureConfig) {
  const d = new AzureBlobStorage(cfg);
  try {
    await d.ensurePublicContainer();
    const key = `${TEST_PREFIX}${randomBytes(6).toString("hex")}.txt`;
    const body = Buffer.from(`Cadgram storage test ${new Date().toISOString()}`);
    const stored = await d.put(key, body, "text/plain; charset=utf-8");
    try {
      const res = await fetch(stored.url, { cache: "no-store" }).catch(() => null);
      if (!res?.ok || !(await res.text()).startsWith("Cadgram storage test")) {
        throw new AppError(
          cfg.publicUrl
            ? `Uploading works, but ${cfg.publicUrl} didn't return the test file${res ? ` (HTTP ${res.status})` : ""}. Point the CDN or custom domain at the “${cfg.container}” container, or leave Public URL blank.`
            : `Uploading works, but the file couldn't be opened from its public link${res ? ` (HTTP ${res.status})` : ""}. Check that anonymous blob access is allowed on the storage account.`,
        );
      }
    } finally {
      await d.delete(key).catch(() => undefined);
    }
  } catch (e) {
    throw friendly(e);
  }
}

export async function testAzure(user: Principal, input: AzureInput) {
  assertCan(user, "integrations.manage");
  await runAzureTest(await resolveAzure(input));
}

async function writeStored(next: StoredStorageConfig) {
  const config = storedStorageConfig.parse(next) as unknown as Prisma.InputJsonValue;
  await db.integration.upsert({ where: { key: STORAGE_CONFIG_KEY }, create: { key: STORAGE_CONFIG_KEY, isEnabled: true, config }, update: { isEnabled: true, config } });
  resetStorageCache();
}

async function currentStored(): Promise<StoredStorageConfig> {
  const stored = await loadStoredStorageConfig();
  if (stored) return stored;
  // First save from the admin panel: start from what the environment variables say.
  const eff = await loadStorageConfig();
  return storedStorageConfig.parse({
    driver: eff.driver === "azure" ? "azure" : "local",
    ...(eff.azure ? { account: eff.azure.account, keyEnc: encryptSecret(eff.azure.key), container: eff.azure.container, publicUrl: eff.azure.publicUrl } : {}),
  });
}

/** Tests the connection, then saves it. Doesn't change where new uploads go. */
export async function saveAzure(user: Principal, input: AzureInput) {
  assertCan(user, "integrations.manage");
  const cfg = await resolveAzure(input);
  await runAzureTest(cfg);
  const prev = await currentStored();
  await writeStored({ ...prev, account: cfg.account, keyEnc: encryptSecret(cfg.key), container: cfg.container, publicUrl: cfg.publicUrl });
  await audit({ actorId: user.id, action: "integration.update", entityType: "integration", entityId: STORAGE_CONFIG_KEY, summary: `Saved Azure storage connection (${cfg.account}/${cfg.container})` });
}

/** Chooses where new uploads go. Existing files stay where they are until moved. */
export async function setActiveStorage(user: Principal, driver: "local" | "azure") {
  assertCan(user, "integrations.manage");
  const prev = await currentStored();
  if (driver === "azure" && !(await loadStorageConfig()).azure) throw new AppError("Connect Azure Blob Storage first.");
  await writeStored({ ...prev, driver });
  await audit({ actorId: user.id, action: "integration.update", entityType: "integration", entityId: STORAGE_CONFIG_KEY, summary: `New uploads now go to ${driver === "azure" ? "Azure Blob Storage" : "local storage"}` });
}

/* ────────────────────────── Moving files ────────────────────────── */

export const moveDirection = z.object({ from: z.enum(["local", "azure"]), to: z.enum(["local", "azure"]) }).refine((d) => d.from !== d.to, "Pick two different storages");

/** Copies one batch of files. Call again with `next` until it is null. Source files are kept. */
export async function copyStorageBatch(user: Principal, from: StorageProvider, to: StorageProvider, cursor: string | null, size = 15) {
  assertCan(user, "integrations.manage");
  const [src, dst] = await Promise.all([getStorageFor(from), getStorageFor(to)]);
  const { keys, next } = await src.list(cursor, size);
  const failed: string[] = [];
  let copied = 0;
  for (const key of keys) {
    if (key.startsWith(TEST_PREFIX)) continue;
    try {
      const body = await src.get(key);
      if (!body) continue;
      await dst.put(key, body, contentTypeFor(key));
      copied++;
    } catch (e) {
      console.error(`[storage] copy failed for ${key}`, e);
      failed.push(key);
    }
  }
  return { copied, failed, next };
}

/** Text-like columns in the app's tables that can hold file links. */
async function linkColumns() {
  return db.$queryRaw<{ table_name: string; column_name: string; data_type: string; udt_name: string }[]>`
    SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name NOT IN ('_prisma_migrations', 'AuditLog', 'Session', 'Integration')
      AND (data_type IN ('text', 'character varying', 'json', 'jsonb') OR udt_name IN ('_text', '_varchar'))`;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Rewrites every stored link from one storage's URLs to the other's — in all tables, including
 * rich-text HTML and JSON — then makes the target storage the one new uploads go to.
 * Run after copying the files.
 */
export async function finishStorageMove(user: Principal, from: "local" | "azure", to: "local" | "azure") {
  assertCan(user, "integrations.manage");
  const [src, dst] = await Promise.all([getStorageFor(from), getStorageFor(to)]);
  const toBase = dst.baseUrl;
  const appUploads = `${env.APP_URL.replace(/\/+$/, "")}/uploads/`;

  // Each step: [marker that must be present, SQL expression over $col, params]
  const steps: { marker: string; expr: (col: string) => string; params: string[] }[] =
    from === "local"
      ? [
          { marker: appUploads, expr: (c) => `replace(${c}, $1, $2)`, params: [appUploads, toBase] },
          // Relative links: only where "/uploads/" starts the value or follows a quote, bracket, space, "=" or ",".
          { marker: "/uploads/", expr: (c) => `regexp_replace(${c}, $1, $2, 'g')`, params: [`(^|[\\s"'(=,\\[])/uploads/`, `\\1${toBase}`] },
        ]
      : [{ marker: src.baseUrl, expr: (c) => `replace(${c}, $1, $2)`, params: [src.baseUrl, toBase] }];

  let rows = 0;
  await db.$transaction(
    async (tx) => {
      for (const col of await linkColumns()) {
        const c = ident(col.column_name);
        const t = ident(col.table_name);
        const isJson = col.data_type === "json" || col.data_type === "jsonb";
        const isArray = col.udt_name === "_text" || col.udt_name === "_varchar";
        for (const step of steps) {
          const markerParam = `$${step.params.length + 1}`;
          let sql: string;
          if (isArray) {
            sql = `UPDATE ${t} SET ${c} = ARRAY(SELECT ${step.expr("x")} FROM unnest(${c}) WITH ORDINALITY u(x, i) ORDER BY i) WHERE strpos(array_to_string(${c}, ' '), ${markerParam}) > 0`;
          } else if (isJson) {
            sql = `UPDATE ${t} SET ${c} = (${step.expr(`${c}::text`)})::${col.data_type} WHERE strpos(${c}::text, ${markerParam}) > 0`;
          } else {
            sql = `UPDATE ${t} SET ${c} = ${step.expr(c)} WHERE strpos(${c}, ${markerParam}) > 0`;
          }
          rows += await tx.$executeRawUnsafe(sql, ...step.params, step.marker);
        }
      }
      await tx.mediaAsset.updateMany({ where: { url: { startsWith: toBase } }, data: { provider: to } });
    },
    { timeout: 120_000 },
  );

  const prev = await currentStored();
  await writeStored({ ...prev, driver: to });
  for (const tag of ALL_CACHE_TAGS) revalidateTag(tag);
  revalidatePath("/", "layout");
  await audit({ actorId: user.id, action: "integration.update", entityType: "integration", entityId: STORAGE_CONFIG_KEY, summary: `Moved files from ${from} to ${to} storage; updated ${rows} record(s)` });
  return { rows };
}
