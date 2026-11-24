import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/rbac/permissions";
import { FirstPasswordForm } from "../forms";

export const metadata = { title: "Choose your password" };
export const dynamic = "force-dynamic";

/**
 * Shown right after the first sign-in to an account an admin created with a password: the person
 * replaces it with their own before using the admin panel or portal (requireUser sends them here).
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(homeFor(user.roleKey, user.vendorId));
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Choose your own password</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Your account ({user.email}) was set up with a password from your administrator. Replace it with one only you know. Your other devices will be signed out.</p>
      <FirstPasswordForm email={user.email} name={user.name} />
    </>
  );
}
