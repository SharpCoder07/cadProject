"use client";

import { useEffect } from "react";
import { useT } from "@/components/site/texts";
import { reportClientError } from "@/components/error-reporter";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tx = useT();
  // Errors with a digest failed on the server and are already in Error logs; the rest broke in the browser.
  useEffect(() => { console.error(error); if (!error.digest) reportClientError(error); }, [error]);
  return (
    <div className="container py-20">
      <h1 className="text-3xl font-semibold">{tx("site.errorTitle")}</h1>
      <p className="mt-3 text-muted">{tx("site.errorText")}{error.digest && tx("site.errorRef", { ref: error.digest })}</p>
      <button type="button" onClick={reset} className="mt-6 h-10 rounded-control bg-primary px-4 text-sm font-medium text-primary-fg">
        {tx("site.tryAgain")}
      </button>
    </div>
  );
}
