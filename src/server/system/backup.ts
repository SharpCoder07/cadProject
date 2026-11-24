import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, statfs, unlink, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createGunzip, createGzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import type { Principal } from "@/server/rbac/policy";
import { contentTypeFor, getStorage, getStorageFor, resetStorageCache, type StorageProvider } from "@/server/storage";
import { reportError } from "@/server/error-log";
import { delegate, fromPlain, insertOrder, model, models, toPlain, type Row } from "./graph";
import { assertSystemAdmin } from "./access";
import { binBackup } from "./trash";
import { refreshWholeSite } from "./revalidate";
import { z } from "zod";
import { destinationInput, getBackupConfig, getRemoteTarget, keepSchema, lastSlot, markSlot, mediaAzureAccount, nextSlot, periodKeys, saveDestination, saveSchedule, scheduleSchema, targetForInput, type BackupScope } from "./backup-config";
import { remoteDelete, remoteGetFile, remoteGetText, remoteList, remotePutFile, remotePutText, remoteTest, type AzureTarget } from "./backup-remote";

/**
 * Backup and restore (Admin → System → Backup & restore). A backup is one gzip file of JSON lines:
 *   {"type":"meta",…}  then  {"type":"rows","model":"Software","rows":[…]} batches  then
 *   {"type":"file","provider":"local","key":"…","data":"<base64>"} for every uploaded file  then {"type":"end",…}.
 * A backup is Full (database + media), Database only or Media only. Files are kept in BACKUP_DIR (default
 * ./backups, never inside public/), each with a small <name>.info.json beside it, and/or in a private Azure Blob
 * Storage container (backup-config.ts, backup-remote.ts). Automatic backups run from /api/cron on the chosen schedule and are thinned out
 * to the chosen number of daily, weekly and monthly copies; manual, imported and safety backups are never removed
 * automatically. Restoring replaces every table (unless media only), then puts the files back (unless database only).
 */
export const BACKUP_FORMAT = "cadgram-backup";
const VERSION = 2;
/** Short-lived tables that aren't worth saving: sign-in sessions, one-time tokens, rate-limit counters. */
const SKIP = new Set(["Session", "AuthToken", "RateLimitBucket"]);
const BATCH = 500;
/** A backup still "running" after this long was cut off (server restarted). */
const STALE_MS = 3 * 60 * 60_000;

export const backupDir = () => path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
const NAME = /^cadgram-backup-\d{8}-\d{6}(?:-[a-z0-9]{1,12}){0,4}\.json\.gz$/;
export const isBackupName = (n: string) => NAME.test(n);
const fileOf = (name: string) => {
  if (!isBackupName(name)) throw notFound("Backup");
  return path.join(backupDir(), name);
};
const infoOf = (name: string) => `${fileOf(name)}.info.json`;

export type BackupTrigger = "manual" | "scheduled" | "before-restore" | "uploaded";
export type BackupStatus = "running" | "completed" | "failed";
export type BackupStorage = "local" | "azure" | "both";
export interface BackupInfo {
  name: string;
  trigger: BackupTrigger;
  scope: BackupScope;
  status: BackupStatus;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  createdBy: string | null;
  note: string | null;
  rows: number;
  tables: number;
  files: number;
  /** Files that couldn't be read (e.g. a storage that is no longer set up). */
  missingFiles: number;
  bytes: number;
  migrations: string[];
  storage: BackupStorage;
  /** The off-site copy failed (the local one is fine). */
  remoteError?: string | null;
  /** Deleted: in the recycle bin since then (hidden from the list; the files stay until the bin item is removed). */
  binnedAt?: string | null;
}

/** Older .info.json files (before scopes and schedules). */
function normalise(raw: Partial<BackupInfo> & { kind?: string }, name: string): BackupInfo {
  const trigger = (raw.trigger ?? (raw.kind === "before-restore" ? "before-restore" : raw.kind === "uploaded" ? "uploaded" : "manual")) as BackupTrigger;
  return {
    name, trigger, scope: raw.scope ?? "full", status: raw.status ?? "completed", error: raw.error ?? null,
    createdAt: raw.createdAt ?? new Date(0).toISOString(), finishedAt: raw.finishedAt ?? null, durationMs: raw.durationMs ?? null,
    createdBy: raw.createdBy ?? null, note: raw.note ?? null, rows: raw.rows ?? 0, tables: raw.tables ?? 0, files: raw.files ?? 0,
    missingFiles: raw.missingFiles ?? 0, bytes: raw.bytes ?? 0, migrations: raw.migrations ?? [], storage: raw.storage ?? "local", remoteError: raw.remoteError ?? null,
    binnedAt: raw.binnedAt ?? null,
  };
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
const SCOPE_SUFFIX: Record<BackupScope, string> = { full: "full", database: "db", media: "media" };
const TRIGGER_SUFFIX: Record<BackupTrigger, string> = { manual: "", scheduled: "auto", "before-restore": "prerestore", uploaded: "upload" };
const newName = (scope: BackupScope, trigger: BackupTrigger, at = new Date()) =>
  `cadgram-backup-${stamp(at)}${[SCOPE_SUFFIX[scope], TRIGGER_SUFFIX[trigger], randomBytes(2).toString("hex")].filter(Boolean).map((s) => `-${s}`).join("")}.json.gz`;

async function appliedMigrations(client: Tx | typeof db = db): Promise<string[]> {
  const rows = await client.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
  return rows.map((r) => r.migration_name);
}

/** Tables to save/restore, parents before children. */
function tables() {
  return insertOrder([...models().keys()].filter((m) => !SKIP.has(m)));
}

// ─── One at a time ───────────────────────────────────────────────────────────

const lockFile = () => path.join(backupDir(), ".backup.lock");
async function lockAge(): Promise<number | null> {
  const t = await readFile(lockFile(), "utf8").then((x) => Number(JSON.parse(x).at)).catch(() => null);
  return t ? Date.now() - t : null;
}
async function withLock<T>(what: string, fn: () => Promise<T>): Promise<T> {
  await mkdir(backupDir(), { recursive: true });
  try {
    await writeFile(lockFile(), JSON.stringify({ at: Date.now(), what }), { flag: "wx" });
  } catch {
    const age = await lockAge();
    if (age !== null && age < STALE_MS) throw new AppError("A backup or restore is already running. Try again when it has finished.", "CONFLICT");
    await writeFile(lockFile(), JSON.stringify({ at: Date.now(), what }));
  }
  try {
    return await fn();
  } finally {
    await unlink(lockFile()).catch(() => undefined);
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

async function writeBackup(file: string, scope: BackupScope, by: string | null, note: string | null) {
  const gz = createGzip({ level: 6 });
  const out = createWriteStream(file);
  gz.pipe(out);
  const closed = once(out, "close");
  const write = async (obj: unknown) => {
    if (!gz.write(`${JSON.stringify(obj)}\n`)) await once(gz, "drain");
  };
  const createdAt = new Date().toISOString();
  const migrations = await appliedMigrations();
  const { order } = tables();
  await write({ type: "meta", format: BACKUP_FORMAT, version: VERSION, scope, createdAt, createdBy: by, note, migrations, tables: scope === "media" ? [] : order });

  let rowCount = 0;
  let tableCount = 0;
  if (scope !== "media") {
    // One consistent view of the database while reading every table.
    await db.$transaction(
      async (tx) => {
        for (const m of order) {
          const pk = model(m).pk;
          let n = 0;
          for (let skip = 0; ; skip += BATCH) {
            const rows = await delegate(tx, m).findMany({ orderBy: pk.map((k) => ({ [k]: "asc" })), skip, take: BATCH });
            if (!rows.length) break;
            await write({ type: "rows", model: m, rows: rows.map((r) => toPlain(m, r)) });
            n += rows.length;
            if (rows.length < BATCH) break;
          }
          rowCount += n;
          if (n) tableCount++;
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30 * 60_000, maxWait: 10_000 },
    );
  }

  // Uploaded files: everything in the storage in use now, plus any other storage that media still points at.
  let files = 0;
  let missingFiles = 0;
  if (scope !== "database") {
    const providers = new Set<StorageProvider>([(await getStorage()).provider]);
    for (const p of await db.mediaAsset.groupBy({ by: ["provider"] })) providers.add(p.provider as StorageProvider);
    for (const provider of providers) {
      const driver = await getStorageFor(provider).catch(() => null);
      if (!driver) {
        missingFiles += await db.mediaAsset.count({ where: { provider } });
        continue;
      }
      let cursor: string | null = null;
      do {
        const page: { keys: string[]; next: string | null } = await driver.list(cursor, 200).catch(() => ({ keys: [], next: null }));
        for (const key of page.keys) {
          const body = await driver.get(key).catch(() => null);
          if (!body) { missingFiles++; continue; }
          await write({ type: "file", provider, key, data: body.toString("base64") });
          files++;
        }
        cursor = page.next;
      } while (cursor);
    }
  }
  await write({ type: "end", rows: rowCount, files });
  gz.end();
  await closed;
  return { rows: rowCount, tables: tableCount, files, missingFiles, migrations };
}

async function saveInfo(info: BackupInfo) {
  await writeFile(infoOf(info.name), JSON.stringify(info, null, 2));
}

/** Makes a backup (no lock: callers hold it). Failed backups stay in the list with the reason. */
async function makeBackup(by: { id: string | null; name: string | null }, opts: { scope: BackupScope; trigger: BackupTrigger; note?: string | null }): Promise<BackupInfo> {
  await mkdir(backupDir(), { recursive: true });
  const started = new Date();
  const name = newName(opts.scope, opts.trigger, started);
  const file = fileOf(name);
  const part = `${file}.part`;
  const info: BackupInfo = normalise({ trigger: opts.trigger, scope: opts.scope, status: "running", createdAt: started.toISOString(), createdBy: by.name, note: opts.note?.trim() || null }, name);
  await saveInfo(info);
  try {
    Object.assign(info, await writeBackup(part, opts.scope, by.name, info.note));
    await rename(part, file);
    info.bytes = (await stat(file)).size;
    info.status = "completed";
    info.finishedAt = new Date().toISOString();
    info.durationMs = Date.now() - started.getTime();
    info.storage = "local";
    // Off-site copy.
    const remote = await getRemoteTarget();
    if (remote) {
      try {
        await remotePutFile(remote, name, file);
        const keepLocal = (await getBackupConfig()).destination.keepLocal;
        info.storage = keepLocal ? "both" : "azure";
        await remotePutText(remote, `${name}.info.json`, JSON.stringify(info, null, 2));
        if (!keepLocal) await unlink(file);
      } catch (e) {
        info.remoteError = e instanceof Error ? e.message : String(e);
        reportError({ type: "NETWORK", message: `Backup ${name} couldn't be copied to Azure: ${info.remoteError}`, source: "backup" });
      }
    }
    await saveInfo(info);
    await audit({ actorId: by.id, action: "backup.create", entityType: "backup", entityId: name, summary: `${TRIGGER_LABEL[opts.trigger]} ${SCOPE_LABEL[opts.scope].toLowerCase()} backup: ${info.rows} rows, ${info.files} files` });
    return info;
  } catch (e) {
    await unlink(part).catch(() => undefined);
    info.status = "failed";
    info.error = e instanceof Error ? e.message : String(e);
    info.finishedAt = new Date().toISOString();
    info.durationMs = Date.now() - started.getTime();
    await saveInfo(info).catch(() => undefined);
    reportError({ type: "BACKEND", message: `Backup failed: ${info.error}`, details: e instanceof Error ? e.stack : null, source: "backup" });
    throw new AppError(`The backup failed: ${info.error}`);
  }
}

export const SCOPE_LABEL: Record<BackupScope, string> = { full: "Full", database: "Database", media: "Media" };
const TRIGGER_LABEL: Record<BackupTrigger, string> = { manual: "Manual", scheduled: "Automatic", "before-restore": "Safety", uploaded: "Imported" };

export async function createBackup(user: Principal, note: string | null, scope: BackupScope = "full"): Promise<BackupInfo> {
  assertSystemAdmin(user);
  return withLock("backup", () => makeBackup({ id: user.id, name: user.name }, { scope, trigger: "manual", note }));
}

// ─── List, delete, download, upload ──────────────────────────────────────────

/** Every backup, here and off-site, newest first. `remoteError` when the bucket couldn't be read. */
export async function listBackups(user: Principal): Promise<{ items: BackupInfo[]; remoteError: string | null }> {
  assertSystemAdmin(user);
  const all = await readAll(true);
  // A deleted backup whose recycle-bin item is gone without removing it (e.g. the database was restored to
  // an earlier point) would stay hidden for ever: show it again.
  const binned = all.items.filter((b) => b.binnedAt);
  if (binned.length) {
    const inBin = new Set((await db.trashItem.findMany({ where: { entityType: "Backup" }, select: { entityId: true } })).map((t) => t.entityId));
    for (const b of binned) if (!inBin.has(b.name)) { await setBinned(b.name, null); b.binnedAt = null; }
  }
  return { items: all.items.filter((b) => !b.binnedAt), remoteError: all.remoteError };
}

/** Backups in the list; `binned` = also those deleted to the recycle bin. */
async function readAll(binned = false): Promise<{ items: BackupInfo[]; remoteError: string | null }> {
  const entries = await readdir(backupDir()).catch(() => [] as string[]);
  const byName = new Map<string, BackupInfo>();
  const lockAgeMs = await lockAge();
  for (const f of entries) {
    const name = f.endsWith(".info.json") ? f.slice(0, -".info.json".length) : f;
    if (!isBackupName(name) || byName.has(name)) continue;
    const raw = await readFile(infoOf(name), "utf8").then((t) => JSON.parse(t)).catch(() => null);
    const hasFile = await stat(fileOf(name)).then(() => true).catch(() => false);
    if (raw) {
      const info = normalise(raw, name);
      if (info.status === "running" && (lockAgeMs === null || lockAgeMs > STALE_MS)) Object.assign(info, { status: "failed", error: "Interrupted (the server stopped while it was running)" });
      if (info.status === "completed" && !hasFile && info.storage === "both") info.storage = "azure";
      if (info.status === "completed" && !hasFile && info.storage === "local") continue; // file removed by hand
      byName.set(name, info);
    } else if (hasFile) {
      const s = await stat(fileOf(name));
      byName.set(name, normalise({ trigger: "uploaded", createdAt: s.mtime.toISOString(), note: "Details unavailable", bytes: s.size }, name));
    }
  }
  let remoteError: string | null = null;
  const remote = await getRemoteTarget();
  if (remote) {
    try {
      const keys = await remoteList(remote);
      for (const k of keys) {
        if (!k.endsWith(".info.json")) continue;
        const name = k.slice(0, -".info.json".length);
        if (!isBackupName(name)) continue;
        const local = byName.get(name);
        if (local) {
          if (local.storage === "local" && keys.includes(name)) local.storage = "both";
          continue;
        }
        if (!keys.includes(name)) continue;
        const raw = await remoteGetText(remote, k).then((t) => (t ? JSON.parse(t) : null)).catch(() => null);
        if (raw) byName.set(name, { ...normalise(raw, name), storage: "azure" });
      }
    } catch (e) {
      remoteError = e instanceof Error ? e.message : String(e);
    }
  }
  const items = [...byName.values()].filter((b) => binned || !b.binnedAt);
  return { items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), remoteError };
}

async function removeBackup(name: string, remote: AzureTarget | null) {
  await unlink(fileOf(name)).catch(() => undefined);
  await unlink(infoOf(name)).catch(() => undefined);
  if (remote) {
    await remoteDelete(remote, name).catch(() => undefined);
    await remoteDelete(remote, `${name}.info.json`).catch(() => undefined);
  }
}

/** Marks a backup as in (or back out of) the recycle bin, in its local and Azure details files. */
async function setBinned(name: string, binnedAt: string | null) {
  const local = await readFile(infoOf(name), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (local) await writeFile(infoOf(name), JSON.stringify({ ...local, binnedAt }, null, 2));
  const remote = await getRemoteTarget();
  if (remote) {
    const raw = await remoteGetText(remote, `${name}.info.json`).then((t) => (t ? JSON.parse(t) : null)).catch(() => null);
    if (raw) await remotePutText(remote, `${name}.info.json`, JSON.stringify({ ...raw, binnedAt }, null, 2));
  }
}

/**
 * Deleting a backup moves it to the recycle bin (System › Recycle bin), like every other deletion: the
 * files stay (here and in Azure) and it is hidden from the list until it is restored from the bin, or
 * removed for good there (or when its bin time runs out).
 */
export async function deleteBackup(user: Principal, name: string) {
  assertSystemAdmin(user);
  fileOf(name);
  const info = (await readAll()).items.find((b) => b.name === name);
  if (!info) throw notFound("Backup");
  if (info.status === "running") throw new AppError("This backup is still being made. Wait for it to finish.", "CONFLICT");
  await setBinned(name, new Date().toISOString());
  const when = new Date(info.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  await binBackup(user, name, `${SCOPE_LABEL[info.scope]} backup from ${when}${info.note ? ` — ${info.note}` : ""}`);
  await audit({ actorId: user.id, action: "backup.delete", entityType: "backup", entityId: name, summary: `Moved backup ${name} to the recycle bin` });
}

/** Recycle bin › Restore: shows the backup in the list again. */
export async function restoreBinnedBackup(name: string) {
  fileOf(name);
  const info = (await readAll(true)).items.find((b) => b.name === name);
  if (!info) throw new AppError("The backup's files are gone (deleted outside Cadgram), so it can't be restored.", "CONFLICT");
  await setBinned(name, null);
}

/** Recycle bin › Delete for good (or bin time over): removes the backup's files here and in Azure. */
export async function purgeBinnedBackup(name: string) {
  fileOf(name);
  await removeBackup(name, await getRemoteTarget());
}

/**
 * The backup as a local file. Off-site only backups are downloaded first; `temporary` files are removed by the
 * caller when done.
 */
async function localCopy(name: string): Promise<{ file: string; temporary: boolean }> {
  const file = fileOf(name);
  if (await stat(file).then(() => true).catch(() => false)) return { file, temporary: false };
  const remote = await getRemoteTarget();
  if (!remote) throw notFound("Backup");
  await mkdir(backupDir(), { recursive: true });
  const tmp = path.join(backupDir(), `.download-${randomBytes(6).toString("hex")}.part`);
  await remoteGetFile(remote, name, tmp).catch(() => {
    throw new AppError("This backup couldn't be fetched from Azure. Check the storage settings (Test storage).");
  });
  return { file: tmp, temporary: true };
}

export async function backupFileForDownload(user: Principal, name: string) {
  assertSystemAdmin(user);
  const { file, temporary } = await localCopy(name);
  const s = await stat(file);
  await audit({ actorId: user.id, action: "backup.download", entityType: "backup", entityId: name, summary: `Downloaded backup ${name}` });
  return { file, size: s.size, cleanup: temporary ? () => unlink(file).catch(() => undefined) : () => Promise.resolve() };
}

function lines(file: string) {
  return createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
}

interface Meta { type: "meta"; format: string; version: number; scope?: BackupScope; createdAt: string; createdBy: string | null; note: string | null; migrations: string[] }

async function readMeta(file: string): Promise<Meta> {
  const rl = lines(file);
  try {
    for await (const line of rl) {
      const meta = JSON.parse(line) as Meta;
      if (meta.type !== "meta" || meta.format !== BACKUP_FORMAT) break;
      return meta;
    }
  } catch {
    /* not gzip / not JSON */
  } finally {
    rl.close();
  }
  throw new AppError("This isn't a Cadgram backup file.");
}

/** Saves an uploaded backup (already written to `tmpFile`) into the backup folder after checking it. */
export async function acceptUploadedBackup(user: Principal, tmpFile: string): Promise<BackupInfo> {
  assertSystemAdmin(user);
  try {
    const meta = await readMeta(tmpFile);
    let rows = 0;
    let files = 0;
    const tablesSeen = new Set<string>();
    let ended = false;
    for await (const line of lines(tmpFile)) {
      const rec = JSON.parse(line) as { type: string; model?: string; rows?: unknown[] };
      if (rec.type === "rows") { rows += rec.rows?.length ?? 0; tablesSeen.add(rec.model!); }
      else if (rec.type === "file") files++;
      else if (rec.type === "end") ended = true;
    }
    if (!ended) throw new AppError("This backup file is incomplete (it was cut off while copying). Download it again and retry.");
    await mkdir(backupDir(), { recursive: true });
    const scope: BackupScope = meta.scope ?? "full";
    const name = newName(scope, "uploaded", new Date(meta.createdAt));
    await rename(tmpFile, fileOf(name)).catch(async () => {
      // Different disk: copy instead.
      await writeFile(fileOf(name), await readFile(tmpFile));
      await unlink(tmpFile);
    });
    const info = normalise({ trigger: "uploaded", scope, status: "completed", createdAt: meta.createdAt, finishedAt: new Date().toISOString(), createdBy: meta.createdBy, note: meta.note, rows, tables: tablesSeen.size, files, bytes: (await stat(fileOf(name))).size, migrations: meta.migrations, storage: "local" }, name);
    await saveInfo(info);
    await audit({ actorId: user.id, action: "backup.upload", entityType: "backup", entityId: name, summary: `Imported backup from ${meta.createdAt}` });
    return info;
  } catch (e) {
    await unlink(tmpFile).catch(() => undefined);
    if (e instanceof AppError) throw e;
    throw new AppError("This isn't a Cadgram backup file, or it is damaged.");
  }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export interface StorageSummary {
  kind: "local" | "azure";
  label: string;
  location: string;
  keepLocal: boolean;
  /** Free and total bytes on this server's backup disk (null when unknown). */
  free: number | null;
  total: number | null;
  /** Azure is chosen but can't be used (e.g. the media storage account was removed). */
  problem: string | null;
}

export async function storageSummary(user: Principal): Promise<StorageSummary> {
  assertSystemAdmin(user);
  const cfg = await getBackupConfig();
  await mkdir(backupDir(), { recursive: true }).catch(() => undefined);
  const fs = await statfs(backupDir()).catch(() => null);
  const target = cfg.destination.kind === "azure" ? await getRemoteTarget() : null;
  const a = cfg.destination.azure;
  return {
    kind: cfg.destination.kind,
    label: cfg.destination.kind === "azure" ? "Azure Blob Storage" : "Local disk",
    location: cfg.destination.kind === "azure" ? `${target?.account ?? (a.useMediaAccount ? "media account" : a.account)}/${a.container}${a.prefix ? `/${a.prefix.replace(/\/+$/, "")}` : ""}` : backupDir(),
    keepLocal: cfg.destination.keepLocal,
    free: fs ? fs.bavail * fs.bsize : null,
    total: fs ? fs.blocks * fs.bsize : null,
    problem: cfg.destination.kind === "azure" && !target ? (a.useMediaAccount ? "Media storage has no Azure account set up any more (Integrations › Media storage), so backups only stay on this server." : "The Azure account key can't be read (was APP_SECRET changed?). Enter it again below.") : null,
  };
}

/** Checks that backups can be written where they're kept. Returns what was checked. */
export async function testBackupStorage(user: Principal): Promise<string> {
  assertSystemAdmin(user);
  await mkdir(backupDir(), { recursive: true });
  const probe = path.join(backupDir(), `.write-test-${randomBytes(4).toString("hex")}`);
  try {
    await writeFile(probe, "ok");
    if ((await readFile(probe, "utf8")) !== "ok") throw new Error("read back failed");
  } catch (e) {
    throw new AppError(`Backups can't be written to ${backupDir()} on this server (${e instanceof Error ? e.message : e}).`);
  } finally {
    await unlink(probe).catch(() => undefined);
  }
  const cfg = await getBackupConfig();
  if (cfg.destination.kind !== "azure") return `This server's backup folder (${backupDir()}) can be written to.`;
  const target = await getRemoteTarget();
  if (!target) throw new AppError("Azure is chosen but can't be used: set up the storage account (or Media storage) first.");
  try {
    await remoteTest(target);
  } catch (e) {
    throw new AppError(`The Azure container can't be used: ${e instanceof Error ? e.message : e}`);
  }
  return `Both work: this server's backup folder and the private Azure container “${target.container}” (${target.account}).`;
}

// ─── Automatic backups ───────────────────────────────────────────────────────

/** When the next automatic backup is due (null when automatic backups are off). */
export async function nextAutomaticBackup(): Promise<Date | null> {
  const cfg = await getBackupConfig();
  return cfg.schedule.enabled ? nextSlot(cfg.schedule) : null;
}

/**
 * Called by /api/cron (which should run at least every hour, or every 15 minutes for hourly backups): makes the
 * automatic backup once its time has come, then thins out older automatic backups.
 */
export async function runScheduledBackup(now = new Date()): Promise<{ ran: boolean; name?: string; pruned?: number; error?: string }> {
  const cfg = await getBackupConfig();
  if (!cfg.schedule.enabled) return { ran: false };
  const slot = lastSlot(cfg.schedule, now);
  if (!slot) return { ran: false };
  if (cfg.scheduleSince && slot < new Date(cfg.scheduleSince)) return { ran: false };
  if (cfg.lastSlot && slot <= new Date(cfg.lastSlot)) return { ran: false };
  await markSlot(slot);
  try {
    const info = await withLock("scheduled backup", () => makeBackup({ id: null, name: "Automatic" }, { scope: cfg.schedule.scope, trigger: "scheduled", note: null }));
    const pruned = await pruneAutomaticBackups();
    return { ran: true, name: info.name, pruned };
  } catch (e) {
    return { ran: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Keeps the newest automatic backup of each of the last N days, N weeks and N months (in the schedule's
 * timezone); deletes the other automatic backups. Manual, imported and safety backups are never touched.
 */
export async function pruneAutomaticBackups(): Promise<number> {
  const cfg = await getBackupConfig();
  const tz = cfg.schedule.timezone;
  const autos = (await readAll()).items.filter((b) => b.trigger === "scheduled" && b.status === "completed");
  const keep = new Set<string>();
  const pick = (period: "day" | "week" | "month", n: number) => {
    const seen = new Set<string>();
    for (const b of autos) {
      if (seen.size >= n) break;
      const key = periodKeys(new Date(b.createdAt), tz)[period];
      if (seen.has(key)) continue;
      seen.add(key);
      keep.add(b.name);
    }
  };
  pick("day", cfg.keep.daily);
  pick("week", cfg.keep.weekly);
  pick("month", cfg.keep.monthly);
  const remote = await getRemoteTarget();
  const gone = autos.filter((b) => !keep.has(b.name));
  for (const b of gone) await removeBackup(b.name, remote);
  // Failed automatic attempts older than a week aren't useful any more.
  const weekAgo = Date.now() - 7 * 86_400_000;
  for (const b of (await readAll()).items) if (b.trigger === "scheduled" && b.status === "failed" && new Date(b.createdAt).getTime() < weekAgo) await removeBackup(b.name, null);
  if (gone.length) await audit({ actorId: null, action: "backup.prune", entityType: "backup", summary: `Removed ${gone.length} older automatic backup(s) (keeping ${cfg.keep.daily} daily, ${cfg.keep.weekly} weekly, ${cfg.keep.monthly} monthly)` });
  return gone.length;
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export interface RestoreResult { rows: number; files: number; failedFiles: number; safetyBackup: string; newerTables: boolean; scope: BackupScope }

export async function restoreBackup(user: Principal, name: string): Promise<RestoreResult> {
  assertSystemAdmin(user);
  return withLock("restore", async () => {
    const copy = await localCopy(name);
    try {
      return await restoreFrom(user, name, copy.file);
    } finally {
      if (copy.temporary) await unlink(copy.file).catch(() => undefined);
    }
  });
}

async function restoreFrom(user: Principal, name: string, file: string): Promise<RestoreResult> {
  const meta = await readMeta(file);
  const scope: BackupScope = meta.scope ?? "full";
  const current = await appliedMigrations();
  const unknown = meta.migrations.filter((m) => !current.includes(m));
  if (scope !== "media" && unknown.length) throw new AppError("This backup was made by a newer version of Cadgram. Update the website first (run the database migrations), then restore.");

  // Split the file per table first, so rows can be inserted parents-first whatever order they were saved in.
  const work = await mkdtemp(path.join(os.tmpdir(), "cadgram-restore-"));
  try {
    const writers = new Map<string, ReturnType<typeof createWriteStream>>();
    const filesOut = createWriteStream(path.join(work, "_files.ndjson"));
    let ended = false;
    for await (const line of lines(file)) {
      if (!line) continue;
      const rec = JSON.parse(line) as { type: string; model?: string };
      if (rec.type === "rows" && rec.model && models().has(rec.model) && !SKIP.has(rec.model)) {
        let w = writers.get(rec.model);
        if (!w) writers.set(rec.model, (w = createWriteStream(path.join(work, `${rec.model}.ndjson`))));
        if (!w.write(`${line}\n`)) await once(w, "drain");
      } else if (rec.type === "file") {
        if (!filesOut.write(`${line}\n`)) await once(filesOut, "drain");
      } else if (rec.type === "end") ended = true;
    }
    for (const w of [...writers.values(), filesOut]) { w.end(); await once(w, "close"); }
    if (!ended) throw new AppError("This backup file is incomplete, so nothing was changed.");

    // A copy of what's about to be replaced, in case this restore isn't what you wanted.
    const safety = await makeBackup({ id: user.id, name: user.name }, { scope, trigger: "before-restore", note: `Automatic copy before restoring ${name}` });

    let rows = 0;
    if (scope !== "media") {
      const { order, deferred } = tables();
      await db.$transaction(
        async (tx) => {
          const all = order.map((m) => `"${m}"`).join(", ");
          await tx.$executeRawUnsafe(`TRUNCATE TABLE ${all} CASCADE`);
          const later: { m: string; field: string; pk: string; values: [string, string][] }[] = [];
          for (const m of order) {
            if (!writers.has(m)) continue;
            const info = model(m);
            const myDeferred = deferred.filter((fk) => fk.model === m && !fk.required);
            const pending = myDeferred.map((fk) => ({ m, field: fk.field, pk: info.pk[0]!, values: [] as [string, string][] }));
            for await (const line of createInterface({ input: createReadStream(path.join(work, `${m}.ndjson`)), crlfDelay: Infinity })) {
              if (!line) continue;
              const rec = JSON.parse(line) as { rows: Row[] };
              const data = rec.rows.map((r) => {
                const row = { ...r };
                for (const p of pending) {
                  if (row[p.field] != null) { p.values.push([String(row[p.pk]), String(row[p.field])]); row[p.field] = null; }
                }
                return fromPlain(m, row);
              });
              for (let i = 0; i < data.length; i += BATCH) await delegate(tx, m).createMany({ data: data.slice(i, i + BATCH) });
              rows += data.length;
            }
            later.push(...pending.filter((p) => p.values.length));
          }
          // Keys that point "forwards" (or at the same table) are filled in now that every row exists.
          for (const p of later) {
            for (let i = 0; i < p.values.length; i += 1000) {
              const chunk = p.values.slice(i, i + 1000);
              const ids = chunk.map((v) => v[0]);
              const vals = chunk.map((v) => v[1]);
              await tx.$executeRawUnsafe(
                `UPDATE "${p.m}" AS t SET "${p.field}" = v.val FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS val) AS v WHERE t."${p.pk}" = v.id`,
                ids,
                vals,
              );
            }
          }
          await tx.$executeRawUnsafe(`SELECT refresh_software_search(s."id") FROM "Software" s`);
        },
        { timeout: 60 * 60_000, maxWait: 10_000 },
      );
    }

    // Uploaded files back to the storage they came from.
    resetStorageCache();
    let files = 0;
    let failedFiles = 0;
    if (scope !== "database") {
      for await (const line of createInterface({ input: createReadStream(path.join(work, "_files.ndjson")), crlfDelay: Infinity })) {
        if (!line) continue;
        const f = JSON.parse(line) as { provider: StorageProvider; key: string; data: string };
        try {
          const driver = await getStorageFor(f.provider);
          await driver.put(f.key, Buffer.from(f.data, "base64"), contentTypeFor(f.key));
          files++;
        } catch (e) {
          failedFiles++;
          console.error("[restore] file", f.key, e);
        }
      }
    }
    refreshWholeSite();
    // The audit log was replaced too (unless media only), so this entry goes in after the restore.
    await audit({ actorId: (await db.user.findUnique({ where: { id: user.id }, select: { id: true } }))?.id ?? null, action: "backup.restore", entityType: "backup", entityId: name, summary: `Restored ${SCOPE_LABEL[scope].toLowerCase()} backup from ${meta.createdAt}: ${rows} rows, ${files} files` });
    return { rows, files, failedFiles, safetyBackup: safety.name, newerTables: current.length > meta.migrations.length, scope };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function saveBackupSchedule(user: Principal, raw: unknown) {
  assertSystemAdmin(user);
  const parsed = z.object({ schedule: scheduleSchema, keep: keepSchema }).safeParse(raw);
  if (!parsed.success) throw new AppError("Check the highlighted fields.", "BAD_REQUEST", Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), [i.message]])));
  await saveSchedule(parsed.data.schedule, parsed.data.keep);
  const { schedule: s, keep: k } = parsed.data;
  await audit({ actorId: user.id, action: "backup.schedule", entityType: "backup", summary: s.enabled ? `Automatic ${SCOPE_LABEL[s.scope].toLowerCase()} backups ${s.frequency} at ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")} ${s.timezone}; keep ${k.daily} daily, ${k.weekly} weekly, ${k.monthly} monthly` : "Automatic backups switched off" });
  return s.enabled ? nextSlot(s) : null;
}

/** Saves where backups are kept; an Azure container is checked (private, writable) first and not saved if it fails. */
export async function saveBackupDestination(user: Principal, raw: unknown) {
  assertSystemAdmin(user);
  const parsed = destinationInput.safeParse(raw);
  if (!parsed.success) throw new AppError("Check the highlighted fields.", "BAD_REQUEST", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const input = parsed.data;
  if (input.kind === "azure") {
    const media = await mediaAzureAccount();
    if (input.useMediaAccount && !media) throw new AppError("Media storage doesn't use Azure yet (Integrations › Media storage). Set it up there, or enter a storage account here.", "BAD_REQUEST", { useMediaAccount: ["No Azure account in Media storage"] });
    if (!input.useMediaAccount && !input.account) throw new AppError("Enter the storage account.", "BAD_REQUEST", { account: ["Required"] });
    const target = await targetForInput(input);
    if (!target) throw new AppError("Enter the storage account's access key.", "BAD_REQUEST", { key: ["Required"] });
    // Never the media container: it's public, and backups hold the whole database.
    if (media && target.account === media.account && target.container === media.container) {
      throw new AppError("Use a different container from the media library's: that one is public, and backups must be private.", "BAD_REQUEST", { container: ["Same as the public media container"] });
    }
    try {
      await remoteTest(target);
    } catch (e) {
      throw new AppError(`Not saved: ${e instanceof Error ? e.message : e}`);
    }
  }
  await saveDestination(input);
  await audit({ actorId: user.id, action: "backup.storage", entityType: "backup", summary: input.kind === "azure" ? `Backups now copied to Azure container ${input.container}${input.keepLocal ? " (and kept on this server)" : ""}` : "Backups now stay on this server's disk" });
}
