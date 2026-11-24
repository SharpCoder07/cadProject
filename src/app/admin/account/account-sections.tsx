"use client";

import Image from "next/image";
import { PasteUrlInput } from "@/components/admin/media-picker";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Eye, EyeOff, KeyRound, Loader2, LogOut, Monitor, Smartphone, Upload } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useServerAction } from "@/components/admin/use-action";
import { PasswordChecklist, passwordOk } from "@/components/auth/password-checklist";
import { changePasswordAction, sendResetLinkAction, signOutOthersAction, signOutSessionAction, updateProfileAction } from "./actions";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export function Avatar({ name, url, size = 72 }: { name: string; url: string | null; size?: number }) {
  return url ? (
    <Image src={url} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-full object-cover ring-1 ring-ink ring-offset-2 ring-offset-surface" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-mint-soft font-bold text-mint-ink ring-1 ring-ink ring-offset-2 ring-offset-surface" style={{ width: size, height: size, fontSize: size / 2.8 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Upload or remove your own photo; saves immediately. */
export function AvatarUploader({ name, url }: { name: string; url: string | null }) {
  const router = useRouter();
  const { notify } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(url);
  useEffect(() => setPreview(url), [url]);

  /** A File to upload, a pasted link (string) to import, or null to remove the photo. */
  const send = async (file: File | string | null): Promise<string | null> => {
    setBusy(true);
    try {
      const res = file
        ? await fetch("/api/account/avatar", { method: "POST", body: (() => { const f = new FormData(); f.append(typeof file === "string" ? "url" : "file", file); return f; })() })
        : await fetch("/api/account/avatar", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { url?: string | null; error?: string; pending?: boolean; message?: string };
      if (!res.ok) throw new Error(data.error ?? "The photo couldn't be saved.");
      if (data.pending) {
        // Vendor portal: the change waits for Super Admin approval; keep showing the current photo.
        notify("success", data.message ?? "Sent for approval");
      } else {
        setPreview(data.url ?? null);
        notify("success", file ? "Profile photo updated" : "Profile photo removed");
      }
      router.refresh();
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "The photo couldn't be saved.";
      notify("error", message);
      return message;
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex items-start gap-5">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="group relative mt-0.5 shrink-0 rounded-full" aria-label="Change profile photo">
        <Avatar name={name} url={preview} size={64} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> {preview ? "Change photo" : "Upload photo"}
          </Button>
          {preview && (
            <Button size="sm" variant="secondary" className="text-danger hover:border-danger/40 hover:bg-danger/5" disabled={busy} onClick={() => void send(null)}>
              Remove
            </Button>
          )}
          <span className="text-xs text-muted">JPG, PNG or WebP, up to 3 MB. A square photo works best.</span>
        </div>
        <PasteUrlInput className="mt-3" placeholder="Or paste a photo link (https://…)" buttonLabel="Use link" onSubmit={(url) => send(url)} />
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
    </div>
  );
}

export function ProfileForm({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {
  const [value, setValue] = useState(name);
  const save = useServerAction(updateProfileAction);
  return (
    <form
      className="space-y-5 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save.run({ name: value });
      }}
    >
      <AvatarUploader name={name} url={avatarUrl} />
      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="acc-name" error={save.fieldErrors.name} required>
          <Input id="acc-name" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="name" maxLength={80} />
        </Field>
        <Field label="Email" htmlFor="acc-email" hint="Ask a Super Admin if your email needs to change.">
          <Input id="acc-email" value={email} readOnly disabled />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button size="sm" type="submit" loading={save.pending} disabled={value.trim() === name || !value.trim()}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function PasswordForm({ hasPassword, email, name }: { hasPassword: boolean; email?: string; name?: string }) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [mismatch, setMismatch] = useState(false);
  const change = useServerAction(changePasswordAction, { onSuccess: () => setF({ current: "", next: "", confirm: "" }) });
  const reset = useServerAction(sendResetLinkAction, { refresh: false });
  const strong = passwordOk(f.next, { email, name });

  if (!hasPassword) {
    return (
      <div className="p-5 text-sm text-muted sm:p-6">
        <p>Your account doesn&apos;t have a password yet. We&apos;ll email you a link to set one.</p>
        <Button size="sm" className="mt-4" variant="secondary" loading={reset.pending} onClick={() => void reset.run({})}>
          <KeyRound className="h-4 w-4" aria-hidden /> Email me a link
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.next !== f.confirm) return setMismatch(true);
        setMismatch(false);
        void change.run({ current: f.current, next: f.next });
      }}
    >
      <Field label="Current password" htmlFor="pw-current" error={change.fieldErrors.current} required>
        <PasswordInput id="pw-current" value={f.current} onChange={(v) => setF({ ...f, current: v })} autoComplete="current-password" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="pw-next" error={change.fieldErrors.next} required>
          <PasswordInput id="pw-next" value={f.next} onChange={(v) => setF({ ...f, next: v })} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={mismatch ? "The two passwords don't match." : undefined} required>
          <PasswordInput id="pw-confirm" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" />
        </Field>
      </div>
      <PasswordChecklist password={f.next} email={email} name={name} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <button type="button" onClick={() => void reset.run({})} disabled={reset.pending} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50">
          Forgot your current password? Email me a reset link
        </button>
        <Button size="sm" type="submit" loading={change.pending} disabled={!f.current || !strong || !f.confirm}>
          Update password
        </Button>
      </div>
      <p className="text-xs text-muted">Changing your password signs you out on every other device.</p>
    </form>
  );
}

/** "Chrome on Windows" from a user-agent string. */
function describeDevice(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return { label: `${browser} on ${os}`, mobile: /Android|iPhone|iPad|Mobile/.test(ua) };
}

export function DevicesList({ sessions, currentId, signOutCurrent }: { sessions: { id: string; createdAt: string; lastSeenAt: string; ipAddress: string | null; userAgent: string | null }[]; currentId: string | null; signOutCurrent: () => Promise<void> }) {
  const one = useServerAction(signOutSessionAction);
  const others = useServerAction(signOutOthersAction);
  const otherCount = sessions.filter((s) => s.id !== currentId).length;
  const sorted = [...sessions].sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0));
  return (
    <div>
      <ul className="divide-y divide-line">
        {sorted.map((s) => {
          const d = describeDevice(s.userAgent);
          const Icon = d.mobile ? Smartphone : Monitor;
          const current = s.id === currentId;
          return (
            <li key={s.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg text-ink/70 ring-1 ring-line">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {d.label}
                  {current && <Badge tone="success">This device</Badge>}
                </span>
                <span className="block truncate text-xs text-muted" title={s.userAgent ?? undefined}>
                  {s.ipAddress ?? "Unknown IP"} · signed in {formatDateTime(s.createdAt)} · {current ? "active now" : `last active ${formatDateTime(s.lastSeenAt)}`}
                </span>
              </span>
              {current ? (
                <form action={signOutCurrent}>
                  <Button size="sm" type="submit" variant="secondary">
                    <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
                  </Button>
                </form>
              ) : (
                <Button size="sm" variant="secondary" loading={one.pending} onClick={() => void one.run({ id: s.id })}>
                  Sign out
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <p className="text-xs text-muted">{otherCount ? `Signed in on ${otherCount} other ${otherCount === 1 ? "device" : "devices"}.` : "You're only signed in on this device."}</p>
        <Button size="sm" variant="danger" disabled={!otherCount} loading={others.pending} onClick={() => void others.run({})}>
          Sign out of all other devices
        </Button>
      </div>
    </div>
  );
}
