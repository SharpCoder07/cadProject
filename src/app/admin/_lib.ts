import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import type { Principal } from "@/server/rbac/policy";

/** Current principal for server actions; permission checks happen in the services. */
export async function actor(): Promise<Principal> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Your session has ended. Sign in again.", "UNAUTHENTICATED");
  return user;
}

export const refresh = (...paths: string[]) => paths.forEach((p) => revalidatePath(p));
