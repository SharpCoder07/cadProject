import { requirePermission } from "@/server/auth/session";
import { MediaLibrary } from "@/components/admin/media-library";

export const metadata = { title: "Media library" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; page?: string; gallery?: string; folder?: string }> }) {
  const user = await requirePermission("media.view", "/admin/media");
  return <MediaLibrary user={user} sp={await searchParams} basePath="/admin/media" />;
}
