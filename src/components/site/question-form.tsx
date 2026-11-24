"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Alert } from "@/components/ui/misc";
import { useT } from "@/components/site/texts";

type Me = { signedIn: boolean; canAsk: boolean };

/** "Ask a question" on a product page. Signed-in buyers only; the answer appears once our team replies. */
export function QuestionForm({ softwareSlug, productName }: { softwareSlug: string; productName: string }) {
  const tx = useT();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; error?: string }>({ status: "idle" });

  useEffect(() => {
    fetch("/api/questions", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => setMe(d ?? { signedIn: false, canAsk: false }))
      .catch(() => setMe({ signedIn: false, canAsk: false }));
  }, []);

  if (!me) return null;
  if (state.status === "done") {
    return <Alert tone="success" title={tx("question.thanksTitle")}>{tx("question.thanksText")}</Alert>;
  }
  if (!me.signedIn || !me.canAsk) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-bg p-4">
        <p className="flex items-center gap-2 text-sm text-ink">
          <MessageCircleQuestion className="h-5 w-5 text-primary" aria-hidden />
          {me.signedIn ? tx("question.notBuyer") : tx("question.prompt", { name: productName })}
        </p>
        {!me.signedIn && (
          <span className="flex gap-2">
            <Link href={`/login?next=${encodeURIComponent(`${pathname}#questions`)}`} className="inline-flex h-9 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary/90">{tx("question.signIn")}</Link>
            <Link href={`/signup?next=${encodeURIComponent(`${pathname}#questions`)}`} className="inline-flex h-9 items-center rounded-control border border-line px-4 text-sm font-semibold text-ink hover:border-primary hover:text-primary">{tx("question.signUp")}</Link>
          </span>
        )}
      </div>
    );
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const website = String(new FormData(e.currentTarget).get("website") ?? "");
    setState({ status: "sending" });
    const res = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ softwareSlug, question: text, website }) }).catch(() => null);
    if (res?.ok) return setState({ status: "done" });
    const data = (await res?.json().catch(() => null)) as { error?: string; fieldErrors?: Record<string, string[]> } | null;
    setState({ status: "error", error: data?.fieldErrors?.question?.[0] ?? data?.error ?? tx("question.failed") });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-bg p-4">
      <label htmlFor="q-text" className="text-sm font-bold text-ink">{tx("question.label", { name: productName })}</label>
      <textarea
        id="q-text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={600}
        placeholder={tx("question.placeholder")}
        className="mt-2 w-full rounded-control border border-line bg-surface p-3 text-sm outline-none focus:border-mint focus:ring-4 focus:ring-mint-soft"
      />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state.status === "error" && <p className="mt-1 text-xs text-danger">{state.error}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{tx("question.note")}</p>
        <button type="submit" disabled={state.status === "sending" || text.trim().length < 10} className="inline-flex h-10 items-center rounded-control bg-primary px-5 text-sm font-bold text-primary-fg hover:bg-primary/90 disabled:opacity-50">
          {state.status === "sending" ? tx("question.sending") : tx("question.submit")}
        </button>
      </div>
    </form>
  );
}
