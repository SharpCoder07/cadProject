"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { deleteFromBin, emptyBin, restoreFromBin } from "@/server/system/trash";
import { createBackup, deleteBackup, restoreBackup, saveBackupDestination, saveBackupSchedule, testBackupStorage } from "@/server/system/backup";
import { actor, refresh } from "../_lib";

const ids = z.object({ ids: z.array(z.string().cuid()).min(1).max(200) });
const name = z.object({ name: z.string().min(1).max(120) });

export const restoreBinAction = action(ids, async ({ ids }) => {
  const r = await restoreFromBin(await actor(), ids);
  refresh("/admin/system/recycle-bin");
  const extra = r.skipped || r.cleared ? ` Some links to records deleted for good were left out.` : "";
  return ok(r, `${r.items === 1 ? "Item" : `${r.items} items`} restored.${extra}`);
});

export const deleteBinAction = action(ids, async ({ ids }) => {
  const n = await deleteFromBin(await actor(), ids);
  refresh("/admin/system/recycle-bin");
  return ok(n, `${n === 1 ? "Item" : `${n} items`} deleted for good`);
});

export const emptyBinAction = action(z.object({}), async () => {
  const n = await emptyBin(await actor());
  refresh("/admin/system/recycle-bin");
  return ok(n, n ? `Recycle bin emptied (${n} item${n === 1 ? "" : "s"})` : "The recycle bin was already empty");
});

export const createBackupAction = action(z.object({ note: z.string().max(200).nullable(), scope: z.enum(["full", "database", "media"]).default("full") }), async ({ note, scope }) => {
  const b = await createBackup(await actor(), note, scope);
  refresh("/admin/system/backups");
  return ok(b.name, b.remoteError ? `Backup made on this server, but the Azure copy failed: ${b.remoteError}` : "Backup completed");
});

export const testBackupStorageAction = action(z.object({}), async () => {
  const msg = await testBackupStorage(await actor());
  return ok(msg, msg);
});

export const saveBackupScheduleAction = action(z.object({ schedule: z.unknown(), keep: z.unknown() }), async (input) => {
  const next = await saveBackupSchedule(await actor(), input);
  refresh("/admin/system/backups");
  return ok(undefined, next ? `Schedule saved. Next automatic backup: ${next.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}` : "Schedule saved. Automatic backups are off.");
});

export const saveBackupDestinationAction = action(z.record(z.unknown()), async (input) => {
  await saveBackupDestination(await actor(), input);
  refresh("/admin/system/backups");
  return ok(undefined, input.kind === "azure" ? "Azure container checked (private and writable) and saved. New backups are copied there." : "Saved. Backups stay on this server.");
});

export const deleteBackupAction = action(name, async ({ name }) => {
  await deleteBackup(await actor(), name);
  refresh("/admin/system/backups");
  return ok(undefined, "Backup deleted");
});

export const restoreBackupAction = action(name, async ({ name }) => {
  const r = await restoreBackup(await actor(), name);
  if (r.scope === "media") refresh("/admin/system/backups", "/admin/media");
  return ok(r, r.scope === "media" ? `Media restored: ${r.files} file(s)${r.failedFiles ? `, ${r.failedFiles} couldn't be written` : ""}` : "Backup restored");
});
