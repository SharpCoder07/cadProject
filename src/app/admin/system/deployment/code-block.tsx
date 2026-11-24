"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Command or config snippet with a copy button. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 overflow-hidden rounded-control border border-line bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label ?? "Terminal"}</span>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted hover:bg-ink/5 hover:text-ink"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink"><code>{code}</code></pre>
    </div>
  );
}
