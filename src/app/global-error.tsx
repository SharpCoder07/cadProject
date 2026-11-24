"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/error-reporter";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Errors with a digest failed on the server and are already in Error logs.
  useEffect(() => { if (!error.digest) reportClientError(error); }, [error]);
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", color: "#172033" }}>
        <h1>The site is temporarily unavailable</h1>
        <p>Please try again in a minute.</p>
        <button type="button" onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
