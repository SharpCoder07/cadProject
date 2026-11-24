"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { deletePermissionFor } from "@/lib/delete-permission";

/** What the signed-in person may delete without asking (for wording only; the server decides). */
interface Rights { superAdmin: boolean; deletes: string[]; /** Days deleted items stay in the recycle bin. */ binDays?: number }
const Ctx = createContext<Rights | null>(null);

export function DeleteRightsProvider({ superAdmin, deletes, binDays, children }: Rights & { children: ReactNode }) {
  return <Ctx.Provider value={{ superAdmin, deletes, binDays }}>{children}</Ctx.Provider>;
}

/** Days deleted items stay in the recycle bin (Website settings › Business rules). */
export const useBinDays = () => useContext(Ctx)?.binDays ?? 30;

/** Is this the Super Admin (who restores from the recycle bin themselves)? */
export const useIsSuperAdmin = () => Boolean(useContext(Ctx)?.superAdmin);

/**
 * True when the signed-in staff member lacks the Delete permission for deletions here (they're refused).
 * `permission` overrides the one worked out from the page URL.
 */
export function useDeleteNotAllowed(permission?: string): boolean {
  const rights = useContext(Ctx);
  const pathname = usePathname() ?? "";
  if (!rights || rights.superAdmin) return false;
  const needed = permission ?? deletePermissionFor(pathname);
  return Boolean(needed && !rights.deletes.includes(needed));
}
