import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPage, HOME_SLUG, pageSectionsFor } from "@/server/services/cms";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/server/seo/metadata";
import { Blocks } from "@/components/blocks/render";


export async function generateMetadata(): Promise<Metadata> {
  const [page, { seo }] = await Promise.all([getPublishedPage(HOME_SLUG), getSettings()]);
  return buildMetadata({ path: "/", title: seo.defaultTitle, description: seo.defaultDescription, seo: page?.seo, absoluteTitle: true });
}

export default async function HomePage() {
  const page = await getPublishedPage(HOME_SLUG);
  if (!page) notFound();
  return <Blocks sections={await pageSectionsFor(page)} />;
}
