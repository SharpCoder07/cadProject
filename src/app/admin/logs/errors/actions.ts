"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { saveErrorNote, setErrorStatus } from "@/server/error-log";
import { actor, refresh } from "../../_lib";

const status = z.enum(["PENDING", "RESOLVED"]);

/** One row at a time (bulk bar) or several at once. */
export const setErrorStatusAction = action(z.object({ id: z.string().cuid(), status }), async ({ id, status: s }) => {
  await setErrorStatus(await actor(), [id], s);
  refresh("/admin/logs/errors", `/admin/logs/errors/${id}`);
  return ok(undefined, s === "RESOLVED" ? "Marked resolved" : "Marked pending");
});

export const saveErrorAction = action(z.object({ id: z.string().cuid(), status, note: z.string().max(2000).nullable() }), async ({ id, status: s, note }) => {
  await setErrorStatus(await actor(), [id], s, note);
  refresh("/admin/logs/errors", `/admin/logs/errors/${id}`);
  return ok(undefined, "Saved");
});

export const saveErrorNoteAction = action(z.object({ id: z.string().cuid(), note: z.string().max(2000).nullable() }), async ({ id, note }) => {
  await saveErrorNote(await actor(), id, note);
  refresh(`/admin/logs/errors/${id}`);
  return ok(undefined, "Note saved");
});

/** "Resolve automatically after … hours without a repeat" on the Error logs page (0 = off). */
export const setAutoResolveAction = action(z.object({ hours: z.number().int().min(0).max(720) }), async ({ hours }) => {
  const { updateSetting } = await import("@/server/settings");
  await updateSetting(await actor(), "errorLogs", { autoResolveHours: hours });
  refresh("/admin/logs/errors");
  return ok(undefined, hours ? `Errors now resolve themselves after ${hours} hours without a repeat` : "Automatic resolving is off");
});
