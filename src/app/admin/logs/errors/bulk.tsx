"use client";

import { BulkActionBar } from "@/components/admin/bulk-actions";
import { setErrorStatusAction } from "./actions";

export function ErrorBulk() {
  return (
    <BulkActionBar
      noun="error"
      items={[
        { label: "Mark resolved", action: setErrorStatusAction, extra: { status: "RESOLVED" }, done: "Marked resolved" },
        { label: "Mark pending", action: setErrorStatusAction, extra: { status: "PENDING" }, done: "Marked pending" },
      ]}
    />
  );
}
