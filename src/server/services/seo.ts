import "server-only";
import type { Tx } from "@/server/db";
import type { SeoInput } from "@/lib/validation/common";

const isEmpty = (s: SeoInput) => !s.title && !s.description && !s.keywords && !s.canonicalUrl && !s.noIndex && !s.ogImageId;

/**
 * Creates/updates/removes the SeoMeta row for an entity and returns the id to
 * store on the entity (null when all fields are empty, so defaults apply).
 */
export async function upsertSeo(tx: Tx, currentId: string | null, input: SeoInput | undefined): Promise<string | null> {
  if (!input || isEmpty(input)) {
    if (currentId) await tx.seoMeta.delete({ where: { id: currentId } }).catch(() => undefined);
    return null;
  }
  const data = {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    canonicalUrl: input.canonicalUrl,
    noIndex: input.noIndex,
    ogImageId: input.ogImageId ?? null,
  };
  if (currentId) {
    await tx.seoMeta.update({ where: { id: currentId }, data });
    return currentId;
  }
  return (await tx.seoMeta.create({ data })).id;
}
