"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/admin/use-action";
import { duplicateSoftwareAction } from "../actions";

export function DuplicateButton({ id }: { id: string }) {
  const router = useRouter();
  const { run, pending } = useServerAction(duplicateSoftwareAction, { onSuccess: (d) => router.push(`/admin/software/${d.id}`) });
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => void run({ id })}>
      <Copy className="h-4 w-4" aria-hidden /> Duplicate
    </Button>
  );
}
