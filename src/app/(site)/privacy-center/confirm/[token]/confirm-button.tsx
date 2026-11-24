"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/site/texts";
import { confirmCaseAction } from "../../actions";

export function ConfirmCaseButton({ token }: { token: string }) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-success/30 bg-success/5 p-6">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
        <p className="mt-3 font-bold text-ink">{t("privacyCenter.confirmedTitle")}</p>
        <p className="mt-1 text-sm text-muted">{t("privacyCenter.confirmedText", { reference: done })}</p>
      </div>
    );
  }
  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button
        size="lg"
        loading={pending}
        onClick={async () => {
          setPending(true);
          const r = await confirmCaseAction({ token }).catch(() => ({ ok: false as const, error: t("privacyCenter.errNetwork") }));
          setPending(false);
          if (r.ok) setDone(r.data.referenceNo);
          else setError(r.error);
        }}
      >
        {t("privacyCenter.confirmButton")}
      </Button>
    </>
  );
}
