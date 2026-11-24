import { NextResponse } from "next/server";
import { getRedirectMap } from "@/server/services/navigation";

/** Redirect rules for the middleware. Public by design: it only exposes what visitors would see anyway. */
export async function GET() {
  const map = await getRedirectMap();
  return NextResponse.json(map, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
