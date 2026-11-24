"use client";

import { forwardRef, useState } from "react";
import { Check, Copy, Download, KeyRound, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";

export interface AuthenticatorSetupView {
  formattedSecret: string;
  secret: string;
  otpauthUrl: string;
  qr: string;
  issuer: string;
  account: string;
}

export const AUTHENTICATOR_APPS = ["Google Authenticator", "Microsoft Authenticator", "2FAS", "Authy"];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      /* clipboard blocked — the text is still visible to copy by hand */
    }
  };
  return { copied, copy };
}

/**
 * Single field for a 6-digit code (or a backup code). Submits the form by itself once
 * six digits are in, the way authenticator apps' codes are usually pasted.
 */
export const CodeInput = forwardRef<HTMLInputElement, { name?: string; mode: "totp" | "backup"; autoSubmit?: boolean; value?: string; onValue?: (v: string) => void; disabled?: boolean; id?: string }>(function CodeInput(
  { name = "code", mode, autoSubmit = true, value, onValue, disabled, id },
  ref,
) {
  const [inner, setInner] = useState("");
  const v = value ?? inner;
  return (
    <input
      ref={ref}
      id={id}
      name={name}
      value={v}
      disabled={disabled}
      onChange={(e) => {
        const next = mode === "totp" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 9);
        setInner(next);
        onValue?.(next);
        if (autoSubmit && mode === "totp" && next.length === 6) e.target.form?.requestSubmit();
      }}
      inputMode={mode === "totp" ? "numeric" : "text"}
      autoComplete="one-time-code"
      autoCapitalize="off"
      spellCheck={false}
      placeholder={mode === "totp" ? "000000" : "xxxx-xxxx"}
      aria-label={mode === "totp" ? "6-digit code" : "Backup code"}
      className={cn(
        "h-14 w-full rounded-control border border-line bg-surface text-center font-mono text-2xl font-semibold tracking-[0.45em] text-ink outline-none transition placeholder:text-ink/20 focus:border-mint focus:ring-4 focus:ring-mint-soft disabled:opacity-60",
        mode === "backup" && "tracking-[0.2em]",
      )}
    />
  );
});

/** QR code + manual key, for adding the account to an authenticator app. */
export function AuthenticatorSetupCard({ setup, compact }: { setup: AuthenticatorSetupView; compact?: boolean }) {
  const [manual, setManual] = useState(false);
  const { copied, copy } = useCopy();
  return (
    <div className={cn("flex flex-col items-center gap-3", !compact && "sm:flex-row sm:items-start sm:gap-5")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
      <img src={setup.qr} alt={`QR code to add ${setup.account} to an authenticator app`} width={200} height={200} className="h-[200px] w-[200px] shrink-0 rounded-xl border border-line bg-white" />
      <div className={cn("w-full min-w-0 text-sm", compact && "text-center")}>
        <p className="text-muted">
          In the authenticator app tap <span className="font-medium text-ink">+</span> → <span className="font-medium text-ink">Scan a QR code</span>. Your phone&apos;s normal camera won&apos;t work for this.
        </p>
        <p className="mt-1.5 text-muted">
          Can&apos;t scan?{" "}
          <button type="button" onClick={() => setManual((m) => !m)} className="font-medium text-ink underline underline-offset-4">
            {manual ? "Hide the key" : "Enter a key instead"}
          </button>
        </p>
        {manual && (
          <div className="mt-3 rounded-lg border border-line bg-bg p-3 text-left">
            <p className="text-xs text-muted">Setup key</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px] font-semibold tracking-wide text-ink" data-testid="totp-secret" data-secret={setup.secret}>
                {setup.formattedSecret}
              </code>
              <button type="button" onClick={() => void copy("secret", setup.secret)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink" aria-label="Copy setup key">
                {copied === "secret" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-muted">Account</dt>
              <dd className="truncate text-ink">{setup.issuer} ({setup.account})</dd>
              <dt className="text-muted">Type</dt>
              <dd className="text-ink">Time-based · 6 digits · 30 seconds</dd>
            </dl>
          </div>
        )}
        <a href={setup.otpauthUrl} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:hidden">
          <Smartphone className="h-4 w-4" aria-hidden /> Open in authenticator app
        </a>
      </div>
    </div>
  );
}

/** Shows freshly generated backup codes, with copy / download and a "saved" confirmation. */
export function BackupCodesPanel({ codes, account, onDone, doneLabel = "Continue" }: { codes: string[]; account: string; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const { copied, copy } = useCopy();
  const text = `Backup codes for ${account}\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "backup-codes.txt" });
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-bg p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-muted" aria-hidden /> Backup codes
        </div>
        <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[15px] text-ink" data-testid="backup-codes">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </div>
      <p className="text-sm text-muted">If you lose your phone, each code lets you sign in once. They won&apos;t be shown again.</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => void copy("codes", codes.join("\n")).then(() => setSaved(true))}>
          {copied === "codes" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} Copy
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <Download className="h-4 w-4" /> Download
        </Button>
      </div>
      <Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} label="I've saved my backup codes somewhere safe" />
      <Button className="w-full" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}
