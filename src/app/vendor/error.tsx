"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/error-reporter";

/** A screen of the vendor area crashed. Recorded in Logs › Error logs (server errors already are, by their digest). */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); if (!error.digest) reportClientError(error); }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">This screen couldn&apos;t be shown</h1>
      <p className="mt-2 text-sm text-muted">The error has been recorded in Logs › Error logs.{error.digest && <> Reference: <code>{error.digest}</code></>}</p>
      <button type="button" onClick={reset} className="mt-5 h-9 rounded-control bg-primary px-4 text-sm font-medium text-primary-fg">Try again</button>
    </div>
  );
}
