import Link from "next/link";
import { checkVerifyToken } from "@/server/auth/signup";
import { ConfirmEmailForm } from "../../forms";

export const metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await checkVerifyToken(token);
  if (!valid) {
    return (
      <>
        <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">This link has expired</h1>
        <p className="mt-2 text-sm text-muted">Confirmation links work once and expire after 24 hours. Sign in with your email and password and we&apos;ll send you a new one.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Go to sign in</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Confirm your email</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Hi {valid.name}, confirm <strong className="text-ink">{valid.email}</strong> to finish creating your account.</p>
      <ConfirmEmailForm token={token} />
    </>
  );
}
