import { RequestResetForm } from "../forms";

export const metadata = { title: "Reset password" };

export default function ResetRequestPage() {
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">Reset your password</h1>
      <p className="mb-5 mt-1 text-sm text-muted">We’ll email you a link to choose a new one.</p>
      <RequestResetForm />
    </>
  );
}
