"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { azureInput, copyStorageBatch, finishStorageMove, moveDirection, saveAzure, setActiveStorage, testAzure } from "@/server/storage/admin";
import { actor, refresh } from "../_lib";

export const testAzureAction = action(azureInput, async (input) => {
  await testAzure(await actor(), input);
  return ok(undefined, "Connected — Azure accepted the upload and the file opened from its public link");
});

export const saveAzureAction = action(azureInput, async (input) => {
  await saveAzure(await actor(), input);
  refresh("/admin/integrations");
  return ok(undefined, "Azure connection tested and saved");
});

export const setActiveStorageAction = action(z.object({ driver: z.enum(["local", "azure"]) }), async ({ driver }) => {
  await setActiveStorage(await actor(), driver);
  refresh("/admin/integrations");
  return ok(undefined, driver === "azure" ? "New uploads now go to Azure" : "New uploads now go to local storage");
});

export const copyStorageBatchAction = action(z.object({ from: z.enum(["local", "azure"]), to: z.enum(["local", "azure"]), cursor: z.string().nullable() }), async ({ from, to, cursor }) => {
  if (from === to) return { ok: false as const, error: "Pick two different storages." };
  return ok(await copyStorageBatch(await actor(), from, to, cursor));
});

export const finishStorageMoveAction = action(moveDirection, async ({ from, to }) => {
  const res = await finishStorageMove(await actor(), from, to);
  refresh("/admin/integrations", "/admin/media");
  return ok(res);
});
