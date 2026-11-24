import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { MediaLibrary } from "@/components/admin/media-library";

export const metadata = { title: "Media library" };

export default async function VendorMediaPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; page?: string; folder?: string }> }) {
  const user = await requireUser("/vendor/media");
  if (!user.vendorId || !user.permissions.has("media.manage")) redirect("/vendor");
  const vendor = await db.vendor.findUnique({ where: { id: user.vendorId }, select: { name: true } });
  return <MediaLibrary user={user} sp={await searchParams} basePath="/vendor/media" companyName={vendor?.name} />;
}
