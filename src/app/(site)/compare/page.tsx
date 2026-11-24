import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { buildMetadata } from "@/server/seo/metadata";
import { legacyCompareTarget } from "@/server/services/compare-urls";
import { getT } from "@/server/texts";
import { CompareTool } from "./compare-tool";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Old query links (?p=a,b or ?products[]=97061&products[]=97341) move to /compare/a-vs-b. */
async function legacyTarget(sp: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, x);
  const legacy = [...params.keys()].some((k) => k === "p" || k === "product" || /^products(\[\d*\])?$/.test(k));
  return legacy ? legacyCompareTarget(params) : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  // The tool page itself is indexable; picked comparisons live at /compare/a-vs-b.
  return buildMetadata({ path: "/compare", title: t("compare.metaTitle"), description: t("compare.metaDescription") });
}

export default async function ComparePage({ searchParams }: Props) {
  // Normally answered by the middleware with a 301; this is the fallback.
  const target = await legacyTarget(await searchParams);
  if (target) permanentRedirect(target);
  return <CompareTool slugs={[]} />;
}
