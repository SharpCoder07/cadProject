import Link from "next/link";
import { validateToken } from "@/server/services/users";
import { SetPasswordForm } from "../../forms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await validateToken(token, "PASSWORD_RESET");
  if (!valid) {
    return (
      <>
        <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">This link has expired</h1>
        <p className="mt-2 text-sm text-muted">Reset links work once and expire after an hour.</p>
        <Link href="/reset-password" className="mt-4 inline-block text-sm text-primary hover:underline">Request a new link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Choose a new password</h1>
      <p className="mb-5 mt-1 text-sm text-muted">For {valid.email}. You’ll be signed out everywhere else.</p>
      <SetPasswordForm token={token} mode="reset" email={valid.email} name={valid.name} />
    </>
  );
}
