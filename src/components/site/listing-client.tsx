"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/texts";

/** GET form that navigates on every checkbox/radio change (works without JS as a normal form). */
export function AutoSubmitForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const navigate = () => {
    const form = ref.current;
    if (!form) return;
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (typeof v === "string" && v !== "") sp.append(k, v);
    start(() => router.push(`${action}${sp.size ? `?${sp.toString()}` : ""}`, { scroll: false }));
  };
  return (
    <form
      ref={ref}
      action={action}
      method="get"
      className={cn(className, pending && "opacity-60")}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.type === "checkbox" || t.type === "radio") navigate();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        navigate();
      }}
    >
      {children}
    </form>
  );
}

export function SortSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const tx = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{tx("site.sortBy")}</span>
      <select
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams(params.toString());
          sp.set("sort", e.target.value);
          sp.delete("page");
          router.push(`${pathname}?${sp.toString()}`, { scroll: false });
        }}
        className="h-9 rounded-control border border-line bg-surface px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
