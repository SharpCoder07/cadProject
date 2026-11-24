import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/** Cached data on the website, by tag (see the services). Cleared after a restore changes many records at once. */
const TAGS = ["catalog", "categories", "pages", "blog", "cms:menus", "cms:banners", "cms:announcements", "cms:blocks", "redirects", "comparisons", "offers", "terms", "settings", "approvals"];

export function refreshWholeSite() {
  for (const t of TAGS) revalidateTag(t);
  revalidatePath("/", "layout");
}
