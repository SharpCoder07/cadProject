"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";

type Result<T> = { ok: true; data: T; message?: string; queued?: boolean } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Runs a server action, shows a toast with the outcome, and refreshes server
 * components on success. Returns field errors for forms to display.
 */
export function useServerAction<I, T>(fn: (input: I) => Promise<Result<T>>, opts: { success?: string | ((data: T) => string); refresh?: boolean; onSuccess?: (data: T) => void } = {}) {
  const { notify } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const run = useCallback(
    (input: I) =>
      new Promise<Result<T>>((resolve) => {
        start(async () => {
          let res: Result<T>;
          try {
            res = await fn(input);
          } catch {
            res = { ok: false, error: "The server couldn't be reached. Check your connection and try again." };
          }
          if (res.ok) {
            setFieldErrors({});
            const msg = res.message ?? (typeof opts.success === "function" ? opts.success(res.data) : opts.success);
            if (msg) notify("success", msg);
            opts.onSuccess?.(res.data);
            // Inside the website's edit panel: tell the website to show the change.
            if (window.parent !== window) window.parent.postMessage({ type: "cg-admin-saved" }, window.location.origin);
            if (opts.refresh !== false) router.refresh();
          } else {
            setFieldErrors(res.fieldErrors ?? {});
            notify("error", res.error);
          }
          resolve(res);
        });
      }),
    [fn, notify, opts, router],
  );
  return { run, pending, fieldErrors, setFieldErrors };
}

/**
 * Runs a per-item server action over many ids (bulk select), one after another, then shows one
 * summary toast ("Deleted 4 items", or what failed) and refreshes the page.
 */
export function useBulkAction() {
  const { notify } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    (ids: string[], fn: (id: string) => Promise<Result<unknown>>, done: string, onDone?: () => void) =>
      new Promise<number>((resolve) => {
        start(async () => {
          let ok = 0;
          let queued = 0;
          let firstError: string | null = null;
          for (const id of ids) {
            try {
              const res = await fn(id);
              if (res.ok && res.queued) queued++;
              else if (res.ok) ok++;
              else firstError ??= res.error;
            } catch {
              firstError ??= "The server couldn't be reached. Check your connection and try again.";
            }
          }
          if (ok) notify("success", `${done} ${ok} ${ok === 1 ? "item" : "items"}`);
          // Deletions this role can't make: each became a request to the Super Admin.
          if (queued) notify("success", `Sent ${queued} ${queued === 1 ? "deletion" : "deletions"} to the Super Admin for approval. Nothing is deleted until they approve.`);
          if (firstError) notify("error", ok + queued ? `${ids.length - ok - queued} couldn't be changed: ${firstError}` : firstError);
          router.refresh();
          if (window.parent !== window) window.parent.postMessage({ type: "cg-admin-saved" }, window.location.origin);
          onDone?.();
          resolve(ok);
        });
      }),
    [notify, router],
  );
  return { run, pending };
}
