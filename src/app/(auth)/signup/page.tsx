import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/rbac/permissions";
import { SignupForm } from "../forms";
import { purposesFor } from "@/server/services/compliance/consent";

export const metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.roleKey, user.vendorId));
  const { next } = await searchParams;
  // Optional consents (never pre-ticked). Before the database is migrated there are none.
  const optional = (await purposesFor("signup").catch(() => [])).filter((p) => !p.isNecessary).map((p) => ({ key: p.key, name: p.name, description: p.description }));
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Create your free account</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Save products to your favourites, get emailed when they have offers, and share reviews.</p>
      <SignupForm next={next} optionalConsents={optional} />
    </>
  );
}
