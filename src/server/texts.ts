import "server-only";
import { getSettings } from "@/server/settings";
import { makeT, type T } from "@/lib/site-texts";

/** Website wording for server components: `const t = await getT(); t("header.login")`. */
export async function getT(): Promise<T> {
  return makeT((await getSettings()).texts);
}
