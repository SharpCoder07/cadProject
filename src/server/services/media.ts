import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { getStorage } from "@/server/storage";
import { processUpload } from "@/server/uploads";
import { fetchRemoteFile } from "@/server/remote-file";
import { enforce, RULES } from "@/server/rate-limit";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { folderWhere, galleryWhere, mediaUsedIn, resolveGallery, type MediaFolderKey } from "./media-folders";
import { withBin } from "@/server/system/trash";
import { guardDelete } from "@/server/rbac/deletion";

/** Vendor-portal users only see and manage their own company's files (shared by the vendor's team). */
const scope = (user: Principal): Prisma.MediaAssetWhereInput => (user.vendorId ? { uploadedBy: { vendorId: user.vendorId } } : {});

export async function uploadMedia(user: Principal, file: { buffer: Buffer; name: string }, meta: { alt?: string | null; folderId?: string | null } = {}) {
  assertCan(user, "media.create");
  const processed = await processUpload(file.buffer, file.name);

  // Same bytes already in the library (for this user's scope): reuse the asset.
  const duplicate = await db.mediaAsset.findFirst({ where: { checksum: processed.checksum, ...scope(user) } });
  if (duplicate) return duplicate;

  const storage = await getStorage();
  const stored = await storage.put(processed.storageKey, processed.buffer, processed.mimeType);
  try {
    const asset = await db.mediaAsset.create({
      data: {
        storageKey: stored.key,
        provider: stored.provider,
        url: stored.url,
        filename: file.name.slice(0, 200),
        mimeType: processed.mimeType,
        sizeBytes: processed.sizeBytes,
        width: processed.width,
        height: processed.height,
        checksum: processed.checksum,
        alt: meta.alt ?? null,
        folderId: user.vendorId ? null : meta.folderId ?? null,
        uploadedById: user.id,
      },
    });
    await audit({ actorId: user.id, action: "media.upload", entityType: "media", entityId: asset.id, summary: asset.filename });
    return asset;
  } catch (e) {
    await storage.delete(stored.key).catch(() => undefined); // don't orphan the object
    throw e;
  }
}

/** "Paste URL": downloads the link on the server and adds it to the library like an upload. */
export async function importMediaFromUrl(user: Principal, url: string, meta: { alt?: string | null; folderId?: string | null } = {}) {
  assertCan(user, "media.create");
  await enforce(RULES.urlImport, user.id, "Too many links imported. Wait a few minutes and try again.");
  const file = await fetchRemoteFile(url);
  return uploadMedia(user, file, meta);
}

/**
 * Files for the media library page and pickers. `gallery` picks whose files (staff only; vendors are
 * always shown their company's), `folder` filters by where files are used, including "unused".
 */
export async function listMedia(
  user: Principal,
  opts: { q?: string; folderId?: string | null; kind?: "image" | "document"; page?: number; perPage?: number; gallery?: string | null; folder?: MediaFolderKey },
) {
  assertCan(user, "media.view");
  const page = opts.page ?? 1;
  const perPage = Math.min(opts.perPage ?? 40, 100);
  const filters: Prisma.MediaAssetWhereInput[] = [scope(user)];
  if (opts.gallery || user.vendorId) filters.push(galleryWhere(resolveGallery(user, opts.gallery)));
  if (opts.folder && opts.folder !== "all") filters.push(await folderWhere(opts.folder));
  if (opts.folderId !== undefined) filters.push({ folderId: opts.folderId });
  if (opts.kind === "image") filters.push({ mimeType: { startsWith: "image/" } });
  else if (opts.kind === "document") filters.push({ mimeType: "application/pdf" });
  if (opts.q) filters.push({ OR: [{ filename: { contains: opts.q, mode: "insensitive" } }, { alt: { contains: opts.q, mode: "insensitive" } }, { caption: { contains: opts.q, mode: "insensitive" } }] });
  const where: Prisma.MediaAssetWhereInput = { AND: filters };
  const [items, total] = await Promise.all([
    db.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage, include: { uploadedBy: { select: { name: true, vendor: { select: { name: true } } } } } }),
    db.mediaAsset.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function updateMedia(user: Principal, id: string, data: { alt?: string | null; caption?: string | null; folderId?: string | null; filename?: string }) {
  assertCan(user, "media.manage");
  const asset = await db.mediaAsset.findFirst({ where: { id, ...scope(user) } });
  if (!asset) throw notFound("File");
  return db.mediaAsset.update({ where: { id }, data: { ...data, ...(user.vendorId ? { folderId: undefined } : {}) } });
}

/** Counts references so admins don't delete images that are in use (links plus mentions in text and page sections). */
export async function mediaUsage(id: string) {
  const [software, screenshots, vendors, brands, categories, industries, posts, authors, banners, seo, testimonials, usedIn] = await Promise.all([
    db.software.count({ where: { logoId: id } }),
    db.softwareMedia.count({ where: { mediaId: id } }),
    db.vendor.count({ where: { logoId: id } }),
    db.brand.count({ where: { logoId: id } }),
    db.category.count({ where: { OR: [{ imageId: id }, { bannerId: id }] } }),
    db.industry.count({ where: { imageId: id } }),
    db.post.count({ where: { coverId: id } }),
    db.author.count({ where: { avatarId: id } }),
    db.banner.count({ where: { OR: [{ imageId: id }, { mobileImageId: id }] } }),
    db.seoMeta.count({ where: { ogImageId: id } }),
    db.testimonial.count({ where: { avatarId: id } }),
    mediaUsedIn(id),
  ]);
  const links = software + screenshots + vendors + brands + categories + industries + posts + authors + banners + seo + testimonials;
  // Text mentions aren't counted one by one; a file that's only mentioned in text still counts as used once.
  return { count: Math.max(links, usedIn.length), usedIn };
}

/** Where a file the user can see is used (for the file details panel). */
export async function mediaUsageFor(user: Principal, id: string) {
  assertCan(user, "media.view");
  const asset = await db.mediaAsset.findFirst({ where: { id, ...scope(user) }, select: { id: true } });
  if (!asset) throw notFound("File");
  return mediaUsage(id);
}

export async function deleteMedia(user: Principal, id: string, force = false) {
  assertCan(user, "media.view");
  const asset = await db.mediaAsset.findFirst({ where: { id, ...scope(user) } });
  if (!asset) throw notFound("File");
  await guardDelete(user, "media", { id, force }, asset.filename);
  const { count: uses } = await mediaUsage(id);
  if (uses > 0 && !force) throw new AppError(`This file is used in ${uses} place(s). Replace it there first, or delete anyway.`, "CONFLICT");
  // The file itself stays in storage while the item is in the recycle bin; it is removed when the bin item is.
  await withBin(user, "MediaAsset", [id], (tx) => tx.mediaAsset.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "media.delete", entityType: "media", entityId: id, summary: `${asset.filename}${uses ? ` (was used ${uses}×)` : ""}` });
}

export async function createFolder(user: Principal, name: string, parentId: string | null) {
  assertCan(user, "media.create");
  if (user.vendorId) throw new AppError("Folders are managed by the Cadgram team.");
  return db.mediaFolder.create({ data: { name: name.trim().slice(0, 60), parentId } });
}
