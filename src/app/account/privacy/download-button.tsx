"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/admin/use-action";
import { exportMyDataAction } from "../actions";

/** Downloads the person's data as a JSON file. */
export function DownloadMyData() {
  const run = useServerAction(exportMyDataAction, {
    refresh: false,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
  });
  return <Button variant="secondary" loading={run.pending} onClick={() => void run.run({})}><Download className="h-4 w-4" aria-hidden />Download my data</Button>;
}
