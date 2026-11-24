import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import type { Principal } from "@/server/rbac/policy";
import { pendingAcceptances } from "@/server/services/compliance/legal";
import { makeT } from "@/lib/site-texts";
import { LegalAcceptButton } from "./legal-accept-button";

/** Shown in the account area and partner portals when a document in force asks them to accept it again. */
export async function LegalUpdateNotice({ user, texts }: { user: Principal; texts?: Record<string, string> }) {
  const pending = await pendingAcceptances(user).catch(() => []);
  if (!pending.length) return null;
  const t = makeT(texts);
  return (
    <div role="region" aria-label={t("legal.updateTitle")} className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" aria-hidden /></span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-ink">{t("legal.updateTitle")}</p>
        <p className="text-muted">{t("legal.updateText")}</p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {pending.map((p) => (
            <li key={p.versionId}>
              <Link href={`/${p.slug}`} target="_blank" className="font-semibold text-primary hover:underline">{t("legal.read")}: {p.title} (v{p.version})</Link>
              {p.summary && <span className="block text-xs text-muted">{p.summary}</span>}
            </li>
          ))}
        </ul>
      </div>
      <LegalAcceptButton versionIds={pending.map((p) => p.versionId)} label={t("legal.accept")} />
    </div>
  );
}
