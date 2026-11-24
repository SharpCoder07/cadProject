"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { AuthenticatorSetupCard, BackupCodesPanel, CodeInput, type AuthenticatorSetupView } from "@/components/auth/two-factor-ui";
import { cancelAuthenticatorChangeAction, confirmAuthenticatorChangeAction, confirmOptionalTwoFactorAction, disableOptionalTwoFactorAction, newBackupCodesAction, startAuthenticatorChangeAction, startOptionalTwoFactorAction } from "./actions";

type Flow =
  | { kind: "idle" }
  | { kind: "codes-confirm" }
  | { kind: "codes"; codes: string[] }
  | { kind: "change-confirm" }
  | { kind: "change-scan"; setup: AuthenticatorSetupView }
  | { kind: "on-scan"; setup: AuthenticatorSetupView }
  | { kind: "off-confirm" };

/** Asks for the current code (or a backup code) before a sensitive change. */
function ConfirmWithCode({ title, busy, error, onSubmit, onCancel, submitLabel }: { title: string; busy: boolean; error?: string; onSubmit: (code: string) => void; onCancel: () => void; submitLabel: string }) {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const ready = mode === "totp" ? code.length === 6 : code.replace(/-/g, "").length === 8;
  return (
    <form
      className="space-y-3 rounded-xl border border-line bg-bg p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(code);
      }}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="max-w-xs">
        <CodeInput key={mode} mode={mode} value={code} onValue={setCode} disabled={busy} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" type="submit" loading={busy} disabled={!ready}>{submitLabel}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <button type="button" className="ml-auto text-xs text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => { setMode((m) => (m === "totp" ? "backup" : "totp")); setCode(""); }}>
          {mode === "totp" ? "Use a backup code" : "Use my app's code"}
        </button>
      </div>
    </form>
  );
}

/**
 * Two-step verification card on My account. For staff and vendors it's always on (required);
 * with `optional` (buyer accounts) it can also be turned on and off.
 */
export function TwoFactorSection({ enabledAt, backupLeft, readable, account, optional = false }: { enabledAt: string | null; backupLeft: number; readable: boolean; account: string; optional?: boolean }) {
  const [flow, setFlow] = useState<Flow>({ kind: "idle" });
  const [error, setError] = useState<string>();
  const turnOn = useServerAction(startOptionalTwoFactorAction, { refresh: false });
  const confirmOn = useServerAction(confirmOptionalTwoFactorAction, { refresh: false });
  const turnOff = useServerAction(disableOptionalTwoFactorAction);
  const newCodes = useServerAction(newBackupCodesAction, { refresh: false });
  const startChange = useServerAction(startAuthenticatorChangeAction, { refresh: false });
  const confirmChange = useServerAction(confirmAuthenticatorChangeAction);
  const cancelChange = useServerAction(cancelAuthenticatorChangeAction, { refresh: false });
  const [newCode, setNewCode] = useState("");

  const reset = () => {
    setFlow({ kind: "idle" });
    setError(undefined);
    setNewCode("");
  };

  if (optional && !enabledAt) {
    return (
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-muted">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              Authenticator app <Badge tone="neutral">Off</Badge>
            </p>
            <p className="text-sm text-muted">Optional. Adds a code from an app like Google Authenticator each time you sign in.</p>
          </div>
        </div>
        {flow.kind === "idle" && (
          <Button size="sm"
            variant="secondary"
            loading={turnOn.pending}
            onClick={async () => {
              const res = await turnOn.run({});
              if (res.ok) setFlow({ kind: "on-scan", setup: res.data });
            }}
          >
            <Smartphone className="h-4 w-4" aria-hidden /> Turn on two-step verification
          </Button>
        )}
        {flow.kind === "on-scan" && (
          <form
            className="space-y-4 rounded-xl border border-line bg-bg p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (newCode.length !== 6) return;
              const res = await confirmOn.run({ code: newCode });
              if (res.ok) {
                setError(undefined);
                setNewCode("");
                setFlow({ kind: "codes", codes: res.data });
              } else setError(res.error);
            }}
          >
            <p className="text-sm font-medium text-ink">Add this account to an authenticator app on your phone.</p>
            <AuthenticatorSetupCard setup={flow.setup} />
            <div className="max-w-xs space-y-2">
              <p className="text-sm text-muted">Then enter the 6-digit code it shows:</p>
              <CodeInput mode="totp" value={newCode} onValue={setNewCode} disabled={confirmOn.pending} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" type="submit" loading={confirmOn.pending} disabled={newCode.length !== 6}>Turn on</Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => { void cancelChange.run({}); reset(); }}>Cancel</Button>
            </div>
          </form>
        )}
        {flow.kind === "codes" && (
          <div className="max-w-md">
            <BackupCodesPanel codes={flow.codes} account={account} doneLabel="Done" onDone={() => { reset(); window.location.reload(); }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            Authenticator app <Badge tone="success">On</Badge>
          </p>
          <p className="text-sm text-muted">{enabledAt ? `Set up ${formatDate(enabledAt)}` : "Set up"} · {optional ? "you turned this on" : "required for every account"}</p>
        </div>
        <Badge tone={backupLeft <= 3 ? "warning" : "neutral"}>
          <KeyRound className="mr-1 h-3 w-3" aria-hidden /> {backupLeft} backup {backupLeft === 1 ? "code" : "codes"} left
        </Badge>
      </div>

      {!readable && (
        <Alert tone="warning" title="Your authenticator needs setting up again">
          The server&apos;s secret key changed, so codes from your app can&apos;t be checked. Use a backup code below to move to a new authenticator, or ask an administrator to reset it.
        </Alert>
      )}
      {backupLeft <= 3 && flow.kind === "idle" && (
        <Alert tone="warning">You&apos;re running low on backup codes. Generate a new set so you can still sign in if you lose your phone.</Alert>
      )}

      {flow.kind === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setFlow({ kind: "change-confirm" })}>
            <Smartphone className="h-4 w-4" aria-hidden /> Move to a new phone
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setFlow({ kind: "codes-confirm" })}>
            <KeyRound className="h-4 w-4" aria-hidden /> New backup codes
          </Button>
          {optional && (
            <Button size="sm" variant="ghost" onClick={() => setFlow({ kind: "off-confirm" })}>
              Turn off
            </Button>
          )}
        </div>
      )}

      {flow.kind === "off-confirm" && (
        <ConfirmWithCode
          title="Enter a code from your authenticator app (or a backup code) to turn two-step verification off."
          submitLabel="Turn off"
          busy={turnOff.pending}
          error={error}
          onCancel={reset}
          onSubmit={async (code) => {
            const res = await turnOff.run({ code });
            if (res.ok) reset();
            else setError(res.error);
          }}
        />
      )}

      {flow.kind === "codes-confirm" && (
        <ConfirmWithCode
          title="Enter a code from your authenticator app to create new backup codes. Your old codes will stop working."
          submitLabel="Create new codes"
          busy={newCodes.pending}
          error={error}
          onCancel={reset}
          onSubmit={async (code) => {
            const res = await newCodes.run({ code });
            if (res.ok) {
              setError(undefined);
              setFlow({ kind: "codes", codes: res.data });
            } else setError(res.error);
          }}
        />
      )}

      {flow.kind === "codes" && (
        <div className="max-w-md">
          <BackupCodesPanel codes={flow.codes} account={account} doneLabel="Done" onDone={reset} />
        </div>
      )}

      {flow.kind === "change-confirm" && (
        <ConfirmWithCode
          title="First, enter a code from your current authenticator app (or a backup code if you no longer have it)."
          submitLabel="Continue"
          busy={startChange.pending}
          error={error}
          onCancel={reset}
          onSubmit={async (code) => {
            const res = await startChange.run({ code });
            if (res.ok) {
              setError(undefined);
              setFlow({ kind: "change-scan", setup: res.data });
            } else setError(res.error);
          }}
        />
      )}

      {flow.kind === "change-scan" && (
        <form
          className="space-y-4 rounded-xl border border-line bg-bg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (newCode.length !== 6) return;
            const res = await confirmChange.run({ code: newCode });
            if (res.ok) reset();
            else setError(res.error);
          }}
        >
          <p className="text-sm font-medium text-ink">Add this account to the authenticator app on your new phone.</p>
          <AuthenticatorSetupCard setup={flow.setup} />
          <div className="max-w-xs space-y-2">
            <p className="text-sm text-muted">Then enter the 6-digit code it shows:</p>
            <CodeInput mode="totp" value={newCode} onValue={setNewCode} disabled={confirmChange.pending} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" type="submit" loading={confirmChange.pending} disabled={newCode.length !== 6}>Confirm new phone</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => { void cancelChange.run({}); reset(); }}>Cancel</Button>
          </div>
          <p className="text-xs text-muted">Your current app keeps working until you confirm. Confirming signs you out on other devices; your backup codes stay the same.</p>
        </form>
      )}
    </div>
  );
}
