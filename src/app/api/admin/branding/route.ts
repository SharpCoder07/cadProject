import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/session";
import { VIEW_ONLY_MESSAGE } from "@/server/rbac/permissions";
import { getSettings, updateSetting } from "@/server/settings";
import { storeImage } from "@/server/uploads";
import { fetchRemoteFile } from "@/server/remote-file";
import { enforce, RULES } from "@/server/rate-limit";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";
import { assertCan } from "@/server/rbac/policy";

/**
 * Quick branding edit from the admin sidebar: the admin-only display name, its label and the logo.
 * The website name (site.name) is not changed here — that lives in Website settings.
 * multipart fields: name, label (line under the name), logo (File, optional), logoUrl (link to import, optional), removeLogo ("1" to clear).
 */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getCurrentUser();
    assertCan(user, "settings.manage");
    if (user.readOnly) throw new AppError(VIEW_ONLY_MESSAGE, "FORBIDDEN");
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    if (!name) throw new AppError("Enter the company name.", "BAD_REQUEST", { name: ["Required"] });
    const { site } = await getSettings();
    const logo = form.get("logo");
    let logoUrl = site.logoUrl;
    const logoLink = form.get("logoUrl");
    if (logo instanceof File && logo.size > 0) logoUrl = await storeImage(Buffer.from(await logo.arrayBuffer()), logo.name, "branding");
    else if (typeof logoLink === "string" && logoLink.trim()) {
      await enforce(RULES.urlImport, user.id, "Too many links imported. Wait a few minutes and try again.");
      const remote = await fetchRemoteFile(logoLink.slice(0, 2000), 5 * 1024 * 1024);
      logoUrl = await storeImage(remote.buffer, remote.name, "branding");
    } else if (form.get("removeLogo") === "1") logoUrl = "";
    const label = form.has("label") ? String(form.get("label") ?? "").trim().slice(0, 40) || "Admin workspace" : site.adminLabel;
    const saved = await updateSetting(user, "site", { ...site, adminName: name === site.name ? "" : name, logoUrl, adminLabel: label });
    revalidatePath("/", "layout");
    return NextResponse.json({ name: saved.adminName || saved.name, label: saved.adminLabel, logoUrl: saved.logoUrl || null });
  } catch (e) {
    return errorResponse(e);
  }
}
