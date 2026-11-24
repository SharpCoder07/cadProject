"use client";

import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/admin/use-action";
import { acceptLegalUpdatesAction } from "@/app/legal-actions";

export function LegalAcceptButton({ versionIds, label }: { versionIds: string[]; label: string }) {
  const run = useServerAction(acceptLegalUpdatesAction);
  return <Button size="sm" loading={run.pending} onClick={() => void run.run({ versionIds })}>{label}</Button>;
}
