"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Search box for a FilterBar: updates the list as you type (via the FilterBar), with a × to clear
 * it (Esc works too). Clearing re-applies the filters straight away.
 */
export function SearchField({ name = "q", defaultValue, placeholder }: { name?: string; defaultValue?: string; placeholder: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const input = useRef<HTMLInputElement>(null);
  // Changed from outside (Reset link, back button): show it.
  useEffect(() => setValue(defaultValue ?? ""), [defaultValue]);

  const clear = () => {
    setValue("");
    const el = input.current;
    if (!el) return;
    el.value = "";
    el.form?.requestSubmit();
    el.focus();
  };

  return (
    <label className="relative min-w-[12rem] flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={input}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            clear();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft"
      />
      {value && (
        <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear search">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </label>
  );
}
