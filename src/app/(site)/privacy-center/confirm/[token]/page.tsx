import type { Metadata } from "next";
import { getT } from "@/server/texts";
import { ConfirmCaseButton } from "./confirm-button";

export const metadata: Metadata = { title: "Confirm your request", robots: { index: false, follow: false } };

/** The emailed confirmation link: a button (not a GET action), so email link scanners can't confirm for people. */
export default async function ConfirmCasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getT();
  return (
    <div className="container max-w-lg py-16 text-center">
      <h1 className="text-2xl font-extrabold text-ink">{t("privacyCenter.confirmTitle")}</h1>
      <p className="mt-2 text-muted">{t("privacyCenter.confirmText")}</p>
      <div className="mt-6"><ConfirmCaseButton token={token} /></div>
    </div>
  );
}
