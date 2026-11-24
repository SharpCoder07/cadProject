import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { VIEW_ONLY_MESSAGE } from "@/server/rbac/permissions";
import { importMediaFromUrl, uploadMedia } from "@/server/services/media";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";
import { assertCan } from "@/server/rbac/policy";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getCurrentUser();
    assertCan(user, "media.create");
    if (user.readOnly) throw new AppError(VIEW_ONLY_MESSAGE, "FORBIDDEN");
    const shape = (a: Awaited<ReturnType<typeof uploadMedia>>) => ({ id: a.id, url: a.url, filename: a.filename, mimeType: a.mimeType, width: a.width, height: a.height, alt: a.alt });
    // "Paste URL": JSON { url, alt?, folderId? } — the server downloads the file and stores it like an upload.
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as { url?: unknown; alt?: unknown; folderId?: unknown };
      if (typeof body.url !== "string" || !body.url.trim()) throw new AppError("Paste a link to an image or PDF.", "BAD_REQUEST", { url: ["Required"] });
      const asset = await importMediaFromUrl(user, body.url.slice(0, 2000), {
        alt: typeof body.alt === "string" ? body.alt.slice(0, 200) : null,
        folderId: typeof body.folderId === "string" && body.folderId ? body.folderId : null,
      });
      return NextResponse.json({ assets: [shape(asset)] }, { status: 201 });
    }
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (!files.length) throw new AppError("Choose a file to upload.");
    if (files.length > 20) throw new AppError("Upload at most 20 files at a time.");
    const alt = (form.get("alt") as string | null)?.slice(0, 200) ?? null;
    const folderId = (form.get("folderId") as string | null) || null;
    const assets = [];
    for (const f of files) {
      assets.push(await uploadMedia(user, { buffer: Buffer.from(await f.arrayBuffer()), name: f.name }, { alt, folderId }));
    }
    return NextResponse.json({ assets: assets.map(shape) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
