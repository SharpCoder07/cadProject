"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { bulkCreateGeoPages, deleteGeoPages, deleteLocation, geoPageInput, installStarterLocations, locationInput, saveGeoPage, saveLocation, setGeoPagesPublished, setLocationPublished } from "@/server/services/geo";
import { settingSchemas, updateSetting } from "@/server/settings";
import { actor } from "../_lib";

const refresh = () => revalidatePath("/admin/geo", "layout");

export const saveLocationAction = action(z.intersection(locationInput, z.object({ id: z.string().cuid().nullable() })), async ({ id, ...data }) => {
  const loc = await saveLocation(await actor(), id, data);
  refresh();
  return ok({ id: loc.id }, id ? "Location saved" : `Added ${loc.name}`);
});

export const deleteLocationAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteLocation(await actor(), id);
  refresh();
  return ok(undefined, "Location deleted");
});

export const setLocationPublishedAction = action(z.object({ id: z.string().cuid(), isPublished: z.boolean() }), async ({ id, isPublished }) => {
  await setLocationPublished(await actor(), id, isPublished);
  refresh();
  return ok(undefined, isPublished ? "Location published" : "Location unpublished");
});

export const installLocationsAction = action(z.object({}), async () => {
  const r = await installStarterLocations(await actor());
  refresh();
  return ok(undefined, r.added || r.repaired ? `Added ${r.added} and repaired ${r.repaired} locations` : "All starter locations are already installed");
});

export const saveGeoPageAction = action(z.intersection(geoPageInput, z.object({ id: z.string().cuid().nullable() })), async ({ id, ...data }) => {
  await saveGeoPage(await actor(), id, data);
  refresh();
  return ok(undefined, data.isPublished ? "Geo page saved and live" : "Geo page saved as draft");
});

export const deleteGeoPagesAction = action(z.object({ ids: z.array(z.string().cuid()).min(1).max(500) }), async ({ ids }) => {
  const n = await deleteGeoPages(await actor(), ids);
  refresh();
  return ok(undefined, `Deleted ${n} ${n === 1 ? "page" : "pages"}`);
});

export const publishGeoPagesAction = action(z.object({ ids: z.array(z.string().cuid()).min(1).max(500), isPublished: z.boolean() }), async ({ ids, isPublished }) => {
  const n = await setGeoPagesPublished(await actor(), ids, isPublished);
  refresh();
  return ok(undefined, `${isPublished ? "Published" : "Unpublished"} ${n} ${n === 1 ? "page" : "pages"}`);
});

export const bulkCreateGeoPagesAction = action(
  z.object({ targetType: z.enum(["software", "vendor"]), targetId: z.string().cuid("Choose a product or brand"), locationIds: z.array(z.string().cuid()).min(1, "Choose at least one location").max(500), isPublished: z.boolean() }),
  async (input) => {
    const r = await bulkCreateGeoPages(await actor(), input);
    refresh();
    return ok(undefined, `Created ${r.created} ${r.created === 1 ? "page" : "pages"}${r.skipped ? ` (${r.skipped} already existed)` : ""}`);
  },
);

export const saveGeoSettingsAction = action(settingSchemas.geo, async (value) => {
  await updateSetting(await actor(), "geo", value);
  refresh();
  return ok(undefined, "Geo settings saved");
});
