import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/session";
import { VIEW_ONLY_MESSAGE } from "@/server/rbac/permissions";
import { setMyAvatar } from "@/server/services/account";
import { proposeOwnProfile } from "@/server/services/vendor-team";
import { storeImage } from "@/server/uploads";
import { fetchRemoteFile } from "@/server/remote-file";
import { enforce, RULES } from "@/server/rate-limit";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";

async function me(req: NextRequest) {
  assertSameOrigin(req);
  const user = await getCurrentUser();
  if (!user) throw new AppError("Sign in to continue.", "UNAUTHENTICATED");
  if (user.readOnly) throw new AppError(VIEW_ONLY_MESSAGE, "FORBIDDEN");
  return user;
}

/** Upload (POST, multipart "file", or "url" to import from a link) or remove (DELETE) the signed-in user's profile photo. */
export async function POST(req: NextRequest) {
  try {
    const user = await me(req);
    const form = await req.formData();
    const file = form.get("file");
    const link = form.get("url");
    let buffer: Buffer;
    let name: string;
    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer());
      name = file.name;
    } else if (typeof link === "string" && link.trim()) {
      await enforce(RULES.urlImport, user.id, "Too many links imported. Wait a few minutes and try again.");
      ({ buffer, name } = await fetchRemoteFile(link.slice(0, 2000), 3 * 1024 * 1024));
    } else throw new AppError("Choose an image to upload.");
    const fileName = name;
    if (user.vendorId) {
      // Vendor-portal photos wait for Super Admin approval.
      const url = await storeImage(buffer, fileName, "avatars", 3);
      const r = await proposeOwnProfile(user, { avatarUrl: url });
      revalidatePath("/vendor", "layout");
      return NextResponse.json({ url: null, pending: true, message: r.message }, { status: 202 });
    }
    const url = await setMyAvatar(user, { buffer, name: fileName });
    revalidatePath("/admin", "layout");
    revalidatePath("/vendor", "layout");
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await me(req);
    if (user.vendorId) {
      const r = await proposeOwnProfile(user, { avatarUrl: null });
      revalidatePath("/vendor", "layout");
      return NextResponse.json({ url: null, pending: true, message: r.message }, { status: 202 });
    }
    await setMyAvatar(user, null);
    revalidatePath("/admin", "layout");
    revalidatePath("/vendor", "layout");
    return NextResponse.json({ url: null });
  } catch (e) {
    return errorResponse(e);
  }
}
