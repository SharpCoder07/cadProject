import Link from "next/link";
import { Building2, FolderClosed, FolderOpen, ImageOff, Library } from "lucide-react";
import { env } from "@/server/env";
import { listMedia } from "@/server/services/media";
import { MEDIA_FOLDERS, VENDOR_FOLDERS, folderCounts, isMediaFolder, resolveGallery, vendorGalleries, type MediaFolderKey } from "@/server/services/media-folders";
import type { Principal } from "@/server/rbac/policy";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar, PageHeader } from "@/components/admin/page-header";
import { PANEL, SearchField, SelectField } from "@/components/admin/list-panel";
import { MediaGrid } from "@/app/admin/media/media-grid";

type SP = { q?: string; kind?: string; page?: string; gallery?: string; folder?: string };

/**
 * Media library page shared by the admin panel and the vendor portal. Staff get "Our library"
 * plus one gallery per vendor company; vendors only see their company's gallery. Each gallery is
 * split into folders by where files are used, with an "Unused images" folder.
 */
export async function MediaLibrary({ user, sp, basePath, companyName }: { user: Principal; sp: SP; basePath: string; companyName?: string | null }) {
  const gallery = resolveGallery(user, sp.gallery);
  const isVendor = Boolean(user.vendorId);
  const folders = isVendor || gallery !== "staff" ? MEDIA_FOLDERS.filter((f) => VENDOR_FOLDERS.includes(f.key)) : MEDIA_FOLDERS;
  const folder: MediaFolderKey = isMediaFolder(sp.folder) && folders.some((f) => f.key === sp.folder) ? sp.folder : "all";
  const kind = sp.kind === "image" || sp.kind === "document" ? sp.kind : undefined;

  const [data, counts, vendors] = await Promise.all([
    listMedia(user, { q: sp.q, kind, page: Number(sp.page) || 1, perPage: 48, gallery, folder }),
    folderCounts(gallery, folders.map((f) => f.key)),
    isVendor ? Promise.resolve([]) : vendorGalleries(user),
  ]);
  const viewingVendor = !isVendor && gallery !== "staff" ? vendors.find((v) => `vendor:${v.id}` === gallery) : null;
  const galleryName = isVendor ? companyName ?? "Your company" : viewingVendor ? viewingVendor.name : "Our library";
  const current = folders.find((f) => f.key === folder)!;
  const href = (params: Partial<SP>) => {
    const q = new URLSearchParams();
    const merged = { gallery: gallery === "staff" || isVendor ? undefined : gallery, folder: folder === "all" ? undefined : folder, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const link = "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition";
  const on = "bg-mint-soft font-semibold text-mint-ink";
  const off = "text-ink hover:bg-ink/5";

  return (
    <>
      <PageHeader
        title="Media library"
        description={
          isVendor
            ? "Manage every image and file your team uploads."
            : `${galleryName} · Stored in ${env.STORAGE_DRIVER === "s3" ? "object storage" : "local disk (development)"}.`
        }
      />
      <div className="grid gap-5 lg:grid-cols-[15.5rem_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {!isVendor && (
            <nav className={cn(PANEL, "p-2")} aria-label="Galleries">
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Galleries</p>
              <Link href={basePath} className={cn(link, gallery === "staff" ? on : off)} aria-current={gallery === "staff" ? "page" : undefined}>
                <Library className="h-4 w-4 shrink-0" aria-hidden /> <span className="flex-1 truncate">Our library</span>
              </Link>
              <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted">Vendors</p>
              {vendors.length === 0 ? (
                <p className="px-3 pb-2 text-xs text-muted">No vendor has uploaded files yet.</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto show-scrollbar">
                  {vendors.map((v) => {
                    const active = gallery === `vendor:${v.id}`;
                    return (
                      <li key={v.id}>
                        <Link href={`${basePath}?gallery=vendor:${v.id}`} className={cn(link, active ? on : off)} aria-current={active ? "page" : undefined}>
                          <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="flex-1 truncate">{v.name}</span>
                          <span className="text-xs text-muted">{v.files}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>
          )}
          <nav className={cn(PANEL, "p-2")} aria-label="Folders">
            <p className="truncate px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Folders · {galleryName}</p>
            <ul>
              {folders.map((f) => {
                const active = f.key === folder;
                const Icon = f.key === "unused" ? ImageOff : active ? FolderOpen : FolderClosed;
                return (
                  <li key={f.key} className={cn(f.key === "unused" && "mt-1 border-t border-line pt-1")}>
                    <Link href={href({ folder: f.key === "all" ? undefined : f.key, page: undefined })} title={f.hint} className={cn(link, active ? on : off)} aria-current={active ? "page" : undefined}>
                      <Icon className={cn("h-4 w-4 shrink-0", f.key === "unused" && !active && "text-warning")} aria-hidden />
                      <span className="flex-1 truncate">{f.label}</span>
                      <span className={cn("text-xs", f.key === "unused" && counts[f.key] > 0 ? "font-semibold text-warning" : "text-muted")}>{counts[f.key]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          <div className="mb-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">{current.label}</h2>
            <p className="text-sm text-muted">
              {current.hint} {data.total} file{data.total === 1 ? "" : "s"}.
              {folder === "unused" && data.total > 0 && " Delete the ones you no longer need — nothing on the website will change."}
            </p>
          </div>
          <FilterBar action={basePath} oneLine>
            {gallery !== "staff" && !isVendor && <input type="hidden" name="gallery" value={gallery} />}
            {folder !== "all" && <input type="hidden" name="folder" value={folder} />}
            <SearchField defaultValue={sp.q} placeholder="Search by name, alt text or caption…" />
            <SelectField name="kind" label="Type" value={sp.kind}>
              <option value="">All files</option>
              <option value="image">Images</option>
              <option value="document">PDFs</option>
            </SelectField>
          </FilterBar>
          <MediaGrid
            maxMb={env.MAX_UPLOAD_MB}
            canUpload={isVendor || gallery === "staff"}
            emptyText={
              folder === "unused"
                ? "Nothing here — every file in this gallery is used somewhere."
                : viewingVendor
                  ? `${viewingVendor.name} has no files in this folder.`
                  : folder === "all"
                    ? "Upload logos, screenshots and brochures to use across the site."
                    : "No files are used here yet. Files appear in this folder automatically once they're used on these pages."
            }
            uploadNote={folder !== "all" && folder !== "unused" ? "New uploads appear under Unused images until you use them somewhere; then they move to the right folder by themselves." : undefined}
            assets={data.items.map((a) => ({
              id: a.id, url: a.url, filename: a.filename, mimeType: a.mimeType, alt: a.alt, caption: a.caption, sizeBytes: a.sizeBytes, width: a.width, height: a.height, createdAt: a.createdAt.toISOString(),
              uploadedBy: a.uploadedBy ? `${a.uploadedBy.name}${a.uploadedBy.vendor && !isVendor ? ` (${a.uploadedBy.vendor.name})` : ""}` : null,
            }))}
          />
          <div className="mt-6"><Pagination page={data.page} pages={data.pages} basePath={basePath} params={{ ...sp }} /></div>
        </div>
      </div>
    </>
  );
}
