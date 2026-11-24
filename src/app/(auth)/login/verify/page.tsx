import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getChallenge } from "@/server/auth/two-factor";
import { TwoFactorSetupForm, TwoFactorVerifyForm } from "../../forms";

export const metadata = { title: "Two-step verification" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, challenge] = await Promise.all([searchParams, getChallenge()]);
  if (!challenge) {
    const user = await getCurrentUser();
    redirect(user ? (user.vendorId ? "/vendor" : "/admin") : "/login");
  }
  if (challenge.kind === "setup") {
    return (
      <div data-auth-wide>
        <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Set up two-step verification</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Every account needs a code from an authenticator app as well as a password. This takes about a minute.</p>
        <TwoFactorSetupForm next={next} email={challenge.email} setup={challenge.setup} />
      </div>
    );
  }
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Two-step verification</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Hi {challenge.name.split(" ")[0]}, one more step to sign in.</p>
      <TwoFactorVerifyForm next={next} email={challenge.email} backupLeft={challenge.backupLeft} />
    </>
  );
}
