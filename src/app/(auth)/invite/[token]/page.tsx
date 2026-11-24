import { validateToken } from "@/server/services/users";
import { SetPasswordForm } from "../../forms";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await validateToken(token, "INVITE");
  if (!valid) {
    return (
      <>
        <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">This invitation has expired</h1>
        <p className="mt-2 text-sm text-muted">Ask your administrator to send a new invite.</p>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Welcome, {valid.name}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Set a password for {valid.email} to finish setting up your account.</p>
      <SetPasswordForm token={token} mode="invite" email={valid.email} name={valid.name} />
    </>
  );
}
