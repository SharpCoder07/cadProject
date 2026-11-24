import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor, isBuyerRoleKey } from "@/server/rbac/permissions";

/** Who's signed in, for the header's account button (kept out of the cached page HTML). */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const body = user
    ? { signedIn: true, name: user.name, kind: isBuyerRoleKey(user.roleKey) ? "buyer" : user.vendorId ? "vendor" : "staff", home: homeFor(user.roleKey, user.vendorId) }
    : { signedIn: false };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
