import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { loadStorageConfig } from "@/server/storage/config";
import type { AzureTarget } from "./backup-remote";

/**
 * Backup settings (Admin › System › Backup & restore), stored in the Integration row "backups.config":
 * the automatic schedule, how many automatic backups to keep, and where backups are kept: this server's disk, or
 * Azure Blob Storage (by default the media library's storage account, in its own private container).
 */
export const BACKUP_CONFIG_KEY = "backups.config";

export const SCOPES = ["full", "database", "media"] as const;
export type BackupScope = (typeof SCOPES)[number];
export const FREQUENCIES = ["hourly", "daily", "weekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const scheduleSchema = z.object({
  enabled: z.boolean().default(false),
  scope: z.enum(SCOPES).default("full"),
  frequency: z.enum(FREQUENCIES).default("daily"),
  hour: z.coerce.number().int().min(0).max(23).default(3),
  minute: z.coerce.number().int().min(0).max(59).default(0),
  timezone: z.string().trim().max(60).refine(isTimeZone, "Unknown timezone, e.g. Asia/Kolkata").default("Asia/Kolkata"),
  /** Weekly: 0 = Sunday … 6 = Saturday. */
  weekday: z.coerce.number().int().min(0).max(6).default(0),
  /** Monthly: day 1–28 (so every month has it). */
  monthDay: z.coerce.number().int().min(1).max(28).default(1),
});
export const keepSchema = z.object({
  daily: z.coerce.number().int().min(1).max(60).default(7),
  weekly: z.coerce.number().int().min(0).max(52).default(4),
  monthly: z.coerce.number().int().min(0).max(36).default(3),
});

const containerName = z.string().trim().toLowerCase().regex(/^(?=.{3,63}$)[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$/, "3–63 lowercase letters, numbers and single hyphens");
export const destinationInput = z.object({
  kind: z.enum(["local", "azure"]),
  /** Use the storage account already set up for media (Integrations › Media storage). */
  useMediaAccount: z.boolean().default(true),
  account: z.string().trim().toLowerCase().max(24).default(""),
  /** Blank keeps the saved key. */
  key: z.string().trim().max(200).default(""),
  container: containerName.default("cadgram-backups"),
  prefix: z.string().trim().max(120).regex(/^[a-zA-Z0-9/_.-]*$/, "Letters, numbers, / _ . - only").default(""),
  /** With Azure: also keep each backup on this server (faster restores). */
  keepLocal: z.boolean().default(true),
});

export interface BackupConfig {
  schedule: z.infer<typeof scheduleSchema>;
  keep: z.infer<typeof keepSchema>;
  destination: { kind: "local" | "azure"; keepLocal: boolean; azure: { useMediaAccount: boolean; account: string; hasKey: boolean; container: string; prefix: string } };
  /** When the schedule was last switched on or changed (no catch-up runs for times before that). */
  scheduleSince: string | null;
  /** The last scheduled time a backup was started for. */
  lastSlot: string | null;
}

interface StoredAzure { useMediaAccount?: boolean; account?: string; keyEnc?: string; container?: string; prefix?: string }
interface Stored {
  schedule?: unknown; keep?: unknown; scheduleSince?: string | null; lastSlot?: string | null;
  destination?: { kind?: "local" | "azure"; keepLocal?: boolean; azure?: StoredAzure };
}

async function readStored(): Promise<Stored> {
  const row = await db.integration.findUnique({ where: { key: BACKUP_CONFIG_KEY } }).catch(() => null);
  return (row?.config as Stored | null) ?? {};
}
async function writeStored(next: Stored) {
  const config = JSON.parse(JSON.stringify(next));
  await db.integration.upsert({ where: { key: BACKUP_CONFIG_KEY }, create: { key: BACKUP_CONFIG_KEY, isEnabled: true, config }, update: { config } });
}

export const normPrefix = (p: string) => (p ? `${p.replace(/^\/+/, "").replace(/\/*$/, "")}/` : "");

export async function getBackupConfig(): Promise<BackupConfig> {
  const s = await readStored();
  const d = s.destination ?? {};
  const a = d.azure ?? {};
  return {
    schedule: scheduleSchema.parse(s.schedule ?? {}),
    keep: keepSchema.parse(s.keep ?? {}),
    destination: {
      kind: d.kind === "azure" ? "azure" : "local",
      keepLocal: d.keepLocal ?? true,
      azure: { useMediaAccount: a.useMediaAccount ?? true, account: a.account ?? "", hasKey: Boolean(a.keyEnc), container: a.container ?? "cadgram-backups", prefix: a.prefix ?? "" },
    },
    scheduleSince: s.scheduleSince ?? null,
    lastSlot: s.lastSlot ?? null,
  };
}

/** The media library's Azure account (Integrations › Media storage), when one is set up. */
export async function mediaAzureAccount() {
  const cfg = await loadStorageConfig().catch(() => null);
  return cfg?.azure ?? null;
}

async function targetFrom(a: { useMediaAccount?: boolean; account?: string; key: string | null; container?: string; prefix?: string }): Promise<AzureTarget | null> {
  const container = a.container || "cadgram-backups";
  const prefix = normPrefix(a.prefix ?? "");
  if (a.useMediaAccount ?? true) {
    const media = await mediaAzureAccount();
    return media ? { account: media.account, key: media.key, container, prefix } : null;
  }
  return a.account && a.key ? { account: a.account, key: a.key, container, prefix } : null;
}

/** Where off-site copies go, or null when backups stay on this server only (or Azure isn't usable). */
export async function getRemoteTarget(): Promise<AzureTarget | null> {
  const d = (await readStored()).destination;
  if (d?.kind !== "azure") return null;
  const a = d.azure ?? {};
  return targetFrom({ ...a, key: a.keyEnc ? decryptSecret(a.keyEnc) : null });
}

/** The target a form input describes, to test before saving. A blank key means the saved one. */
export async function targetForInput(input: z.infer<typeof destinationInput>): Promise<AzureTarget | null> {
  const saved = (await readStored()).destination?.azure;
  const key = input.key || (saved?.keyEnc ? decryptSecret(saved.keyEnc) : null);
  return targetFrom({ useMediaAccount: input.useMediaAccount, account: input.account, key, container: input.container, prefix: input.prefix });
}

export async function saveSchedule(schedule: z.infer<typeof scheduleSchema>, keep: z.infer<typeof keepSchema>) {
  const s = await readStored();
  const before = scheduleSchema.parse(s.schedule ?? {});
  const changed = JSON.stringify(before) !== JSON.stringify(schedule);
  await writeStored({ ...s, schedule, keep, scheduleSince: changed ? new Date().toISOString() : s.scheduleSince ?? new Date().toISOString() });
}

/** Saves where backups go (the caller has tested an Azure target first). */
export async function saveDestination(input: z.infer<typeof destinationInput>) {
  const s = await readStored();
  const prev = s.destination?.azure;
  const keyEnc = input.key ? encryptSecret(input.key) : prev?.keyEnc;
  await writeStored({
    ...s,
    destination: {
      kind: input.kind,
      keepLocal: input.kind === "local" ? true : input.keepLocal,
      azure: { useMediaAccount: input.useMediaAccount, account: input.account, keyEnc, container: input.container, prefix: input.prefix },
    },
  });
}

export async function markSlot(slot: Date) {
  const s = await readStored();
  await writeStored({ ...s, lastSlot: slot.toISOString() });
}

// ─── Schedule times (in the chosen timezone) ─────────────────────────────────

type Sched = z.infer<typeof scheduleSchema>;

/** Calendar date and time in a timezone. */
function zoned(d: Date, tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), h: Number(parts.hour), mi: Number(parts.minute), s: Number(parts.second) };
}
/** UTC instant of a wall-clock time in a timezone (handles daylight saving). */
function fromZoned(y: number, m: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const offset = (t: number) => { const z = zoned(new Date(t), tz); return Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s) - t; };
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}
/** The calendar day `k` days after (or before) a date. */
const shift = (y: number, m: number, d: number, k: number) => { const t = new Date(Date.UTC(y, m - 1, d + k)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() }; };

function matchesDay(s: Sched, day: { d: number; wd: number }) {
  if (s.frequency === "weekly") return day.wd === s.weekday;
  if (s.frequency === "monthly") return day.d === s.monthDay;
  return true;
}

/** The most recent scheduled time at or before `now` (null if none in the last two months). */
export function lastSlot(s: Sched, now = new Date()): Date | null {
  const z = zoned(now, s.timezone);
  if (s.frequency === "hourly") {
    const t = fromZoned(z.y, z.m, z.d, z.h, s.minute, s.timezone);
    return t <= now ? t : new Date(t.getTime() - 3_600_000);
  }
  for (let k = 0; k >= -62; k--) {
    const day = shift(z.y, z.m, z.d, k);
    if (!matchesDay(s, day)) continue;
    const t = fromZoned(day.y, day.m, day.d, s.hour, s.minute, s.timezone);
    if (t <= now) return t;
  }
  return null;
}

/** The next scheduled time after `now`. */
export function nextSlot(s: Sched, now = new Date()): Date | null {
  const z = zoned(now, s.timezone);
  if (s.frequency === "hourly") {
    const t = fromZoned(z.y, z.m, z.d, z.h, s.minute, s.timezone);
    return t > now ? t : new Date(t.getTime() + 3_600_000);
  }
  for (let k = 0; k <= 62; k++) {
    const day = shift(z.y, z.m, z.d, k);
    if (!matchesDay(s, day)) continue;
    const t = fromZoned(day.y, day.m, day.d, s.hour, s.minute, s.timezone);
    if (t > now) return t;
  }
  return null;
}

/** Day / ISO-week / month labels of an instant in a timezone, for keeping daily, weekly and monthly backups. */
export function periodKeys(d: Date, tz: string) {
  const z = zoned(d, tz);
  const t = new Date(Date.UTC(z.y, z.m - 1, z.d));
  const dayNum = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { day: `${z.y}-${z.m}-${z.d}`, week: `${t.getUTCFullYear()}-W${week}`, month: `${z.y}-${z.m}` };
}
