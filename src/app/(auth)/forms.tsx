"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { AUTHENTICATOR_APPS, AuthenticatorSetupCard, BackupCodesPanel, CodeInput, type AuthenticatorSetupView } from "@/components/auth/two-factor-ui";
import { acceptInviteAction, setFirstPasswordAction, cancelTwoFactorAction, confirmEmailAction, loginAction, requestResetAction, resetPasswordAction, signupAction, verifyTwoFactorAction, type FormState, type VerifyState } from "./actions";

/** Password box with an eye button to show or hide what's typed. */
function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted transition hover:bg-ink/5 hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

/** "or" divider followed by a full-width outline link button (switch between sign in and sign up). */
function SwitchLink({ prompt, href, label }: { prompt: string; href: string; label: string }) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.12em] text-muted">
        <span className="h-px flex-1 bg-line" />
        {prompt}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Link
        href={href}
        className="mt-4 flex h-10 w-full items-center justify-center rounded-control border border-line bg-surface text-sm font-semibold text-ink transition hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
      >
        {label}
      </Link>
    </div>
  );
}

export type LoginAudience = "buyer" | "vendor" | "reseller" | "team";
const TAB_LABEL: Record<LoginAudience, string> = { buyer: "Buyer", vendor: "Vendor", reseller: "Reseller", team: "Team" };

export function LoginForm({ next, audience = "buyer" }: { next?: string; audience?: LoginAudience }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error &&
        (state.switchTo ? (
          <Alert tone="danger" title="Unauthorised sign-in">
            {state.error}{" "}
            <Link href={`/login?${new URLSearchParams({ ...(state.switchTo !== "buyer" ? { as: state.switchTo } : {}), ...(next ? { next } : {}) })}`} replace className="font-semibold underline">
              Sign in as {TAB_LABEL[state.switchTo]}
            </Link>
          </Alert>
        ) : (
          <Alert tone="danger">{state.error}</Alert>
        ))}
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="as" value={audience} />
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <div className="relative">
        <Link href="/reset-password" className="absolute right-0 top-0 z-10 text-sm font-medium text-primary hover:underline">Forgot password?</Link>
        <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>
      </div>
      <Button type="submit" className="w-full" loading={pending}>Sign in</Button>
      {audience === "buyer" && <SwitchLink prompt="New here?" href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} label="Create a free account" />}
      {audience === "vendor" && <SwitchLink prompt="Not listed yet?" href="/list-your-software" label="List your software" />}
      {audience === "reseller" && <SwitchLink prompt="Not a partner yet?" href="/become-a-reseller" label="Become a reseller" />}
      {audience === "team" && <p className="rounded-control bg-bg px-4 py-3 text-center text-xs text-muted ring-1 ring-line">Team accounts are created by invitation. Ask an admin to invite you from Admin → Users.</p>}
    </form>
  );
}

/** Buyer sign-up. After submitting, shows "check your email". */
export function SignupForm({ next, optionalConsents = [] }: { next?: string; optionalConsents?: { key: string; name: string; description: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});
  // For the live password checklist (the server checks the same rule).
  const [typed, setTyped] = useState({ name: "", email: "", password: "" });
  if (state.message) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="Check your email">
          We&apos;ve sent a confirmation link to <strong>{state.message}</strong>. Click it to finish creating your account — it&apos;s valid for 24 hours.
        </Alert>
        <p className="text-sm text-muted">No email after a few minutes? Check your spam folder, or sign in with your email and password and we&apos;ll send a new link.</p>
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="inline-block text-sm font-semibold text-primary hover:underline">Go to sign in</Link>
      </div>
    );
  }
  const fe = (k: string) => state.fieldErrors?.[k];
  return (
    <form
      action={action}
      className="space-y-4"
      onInput={(e) => {
        const f = e.currentTarget.elements as unknown as Record<string, HTMLInputElement | undefined>;
        setTyped({ name: f.name?.value ?? "", email: f.email?.value ?? "", password: f.password?.value ?? "" });
      }}
    >
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={fe("name")}>
          <Input id="name" name="name" autoComplete="name" required autoFocus maxLength={80} />
        </Field>
        <Field label="Email" htmlFor="email" error={fe("email")}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" error={fe("password")}>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={fe("confirm")}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
        </Field>
        <PasswordChecklist compact password={typed.password} email={typed.email} name={typed.name} className="-mt-1 sm:col-span-2" />
      </div>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 rounded border-line text-primary" />
        <span>
          I agree to the <Link href="/terms" target="_blank" className="text-primary hover:underline">terms</Link> and{" "}
          <Link href="/privacy-policy" target="_blank" className="text-primary hover:underline">privacy policy</Link>.
        </span>
      </label>
      {fe("agree") && <p className="-mt-2 text-xs text-danger">{fe("agree")?.[0]}</p>}
      {optionalConsents.length > 0 && (
        <fieldset className="-mt-1 space-y-1.5">
          <legend className="sr-only">Optional</legend>
          {optionalConsents.map((c) => (
            <label key={c.key} className="flex items-start gap-2 text-sm text-muted" title={c.description}>
              <input type="checkbox" name={`consent_${c.key}`} className="mt-0.5 h-4 w-4 rounded border-line text-primary" />
              <span>{c.name} <span className="text-xs">(optional: {c.description.charAt(0).toLowerCase() + c.description.slice(1)})</span></span>
            </label>
          ))}
        </fieldset>
      )}
      <Button type="submit" className="w-full" loading={pending}>Create account</Button>
      <SwitchLink prompt="Already a member?" href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} label="Sign in instead" />
    </form>
  );
}

/** Button on the emailed confirmation link. */
export function ConfirmEmailForm({ token, next }: { token: string; next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(confirmEmailAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Button type="submit" className="w-full" loading={pending}>Confirm my email</Button>
    </form>
  );
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestResetAction, {});
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>Send reset link</Button>
    </form>
  );
}

export function SetPasswordForm({ token, mode, email, name }: { token: string; mode: "reset" | "invite"; email?: string; name?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "reset" ? resetPasswordAction : acceptInviteAction, {});
  const [pw, setPw] = useState("");
  return (
    <form action={action} className="space-y-4" onInput={(e) => setPw((e.currentTarget.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "")}>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" error={state.fieldErrors?.password}>
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      </Field>
      <PasswordChecklist password={pw} email={email} name={name} />
      <Field label="Confirm password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>{mode === "reset" ? "Set new password" : "Create my account"}</Button>
    </form>
  );
}

// ─── Two-step verification ───────────────────────────────────────────────────

function NotYou({ email }: { email: string }) {
  return (
    <form action={cancelTwoFactorAction} className="mt-5 border-t border-line pt-4 text-center text-sm text-muted">
      Signing in as <span className="font-medium text-ink">{email}</span>.{" "}
      <button type="submit" className="font-medium text-primary hover:underline">Not you?</button>
    </form>
  );
}

function useVerify() {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyTwoFactorAction, {});
  const ref = useRef<HTMLInputElement>(null);
  // Clear and refocus after a wrong code so the next one can be typed straight away.
  useEffect(() => {
    if (state.error && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [state]);
  return { state, action, pending, ref };
}

export function TwoFactorVerifyForm({ next, email, backupLeft }: { next?: string; email: string; backupLeft: number }) {
  const { state, action, pending, ref } = useVerify();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [value, setValue] = useState("");
  if (state.continueTo === "/login") return <ExpiredNotice message={state.error} />;
  return (
    <>
      <form action={action} className="space-y-4">
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        <input type="hidden" name="next" value={next ?? ""} />
        <p className="text-sm text-muted">
          {mode === "totp" ? "Open your authenticator app and enter the 6-digit code for this account." : "Enter one of the backup codes you saved when you set up two-step verification."}
        </p>
        <CodeInput ref={ref} key={mode} mode={mode} value={value} onValue={setValue} disabled={pending} />
        {state.fieldErrors?.code && <p className="text-sm text-danger">{state.fieldErrors.code[0]}</p>}
        <Button type="submit" className="w-full" loading={pending} disabled={mode === "totp" ? value.length !== 6 : value.replace(/-/g, "").length !== 8}>
          Verify
        </Button>
        <p className="text-center text-sm">
          {mode === "totp" ? (
            backupLeft > 0 ? (
              <button type="button" className="text-primary hover:underline" onClick={() => { setMode("backup"); setValue(""); }}>
                Lost your phone? Use a backup code
              </button>
            ) : (
              <span className="text-muted">Lost your phone? Ask an administrator to reset two-step verification.</span>
            )
          ) : (
            <button type="button" className="text-primary hover:underline" onClick={() => { setMode("totp"); setValue(""); }}>
              Use the code from my app instead
            </button>
          )}
        </p>
      </form>
      <NotYou email={email} />
    </>
  );
}

function ExpiredNotice({ message }: { message?: string }) {
  return (
    <div className="space-y-4">
      <Alert tone="warning">{message ?? "Your sign-in has expired."}</Alert>
      <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">Back to sign in</Link>
    </div>
  );
}

export function TwoFactorSetupForm({ next, email, setup }: { next?: string; email: string; setup: AuthenticatorSetupView }) {
  const { state, action, pending, ref } = useVerify();
  const [value, setValue] = useState("");
  if (state.backupCodes && state.continueTo) {
    const to = state.continueTo;
    return (
      <div data-auth-wide>
        <div className="mb-4 flex items-center gap-2 text-success">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <p className="font-semibold">Two-step verification is on</p>
        </div>
        <BackupCodesPanel codes={state.backupCodes} account={`${setup.issuer} (${email})`} onDone={() => window.location.assign(to)} />
      </div>
    );
  }
  if (state.continueTo === "/login") return <ExpiredNotice message={state.error} />;
  return (
    <div data-auth-wide>
      <ol className="space-y-5">
        <Step n={1} title="Install an authenticator app">
          <p className="text-sm text-muted">Any app that supports time-based codes works, for example:</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {AUTHENTICATOR_APPS.map((a) => (
              <li key={a} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink">{a}</li>
            ))}
          </ul>
        </Step>
        <Step n={2} title="Scan this QR code with the app">
          <AuthenticatorSetupCard setup={setup} compact />
        </Step>
        <Step n={3} title="Type the 6-digit code from the app">
          <p className="mb-3 text-sm text-muted">
            After scanning, the app lists <span className="font-medium text-ink">{setup.issuer}</span> with a code that changes every 30 seconds. This page won&apos;t move on by itself — enter that code here.
          </p>
          <form action={action} className="space-y-3">
            {state.error && <Alert tone="danger">{state.error}</Alert>}
            <input type="hidden" name="next" value={next ?? ""} />
            <CodeInput ref={ref} mode="totp" value={value} onValue={setValue} disabled={pending} />
            {state.fieldErrors?.code && <p className="text-sm text-danger">{state.fieldErrors.code[0]}</p>}
            <Button type="submit" className="w-full" loading={pending} disabled={value.length !== 6}>
              Turn on and continue
            </Button>
          </form>
        </Step>
      </ol>
      <NotYou email={email} />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">{n}</span>
      <div className="min-w-0 pt-0.5">
        <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** First sign-in with a password set by an admin: choose your own. */
export function FirstPasswordForm({ email, name }: { email: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setFirstPasswordAction, {});
  const [pw, setPw] = useState("");
  return (
    <form action={action} className="space-y-4" onInput={(e) => setPw((e.currentTarget.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "")}>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Your new password" htmlFor="password" error={state.fieldErrors?.password}>
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} autoFocus />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <PasswordChecklist password={pw} email={email} name={name} />
      <Button type="submit" className="w-full" loading={pending}>Save and continue</Button>
    </form>
  );
}
