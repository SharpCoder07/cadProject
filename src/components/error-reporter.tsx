"use client";

import { useEffect } from "react";

/**
 * Sends browser errors to Logs › Error logs (/api/errors): UI errors (crashes, script errors) and network errors
 * (requests to our own server that never got an answer). Mounted once in the root layout. Noise from browser
 * extensions and harmless browser warnings is left out, each error is sent once per page load, and at most 10 per
 * page. Reports made while offline wait until the connection is back.
 */

type ClientType = "UI" | "NETWORK";
interface Report { type: ClientType; message: string; details?: string | null; source?: string | null; digest?: string | null }

const QUEUE_KEY = "cg_error_queue";
const sent = new Set<string>();
let budget = 10;

const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Non-Error promise rejection captured/i, /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR/, /AbortError|The user aborted a request|signal is aborted/i, /chrome-extension:|moz-extension:|safari-extension:/i];

function post(r: Report) {
  const body = JSON.stringify(r);
  try {
    void fetchOriginal("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => queue(r));
  } catch {
    queue(r);
  }
}
function queue(r: Report) {
  try {
    const list = JSON.parse(sessionStorage.getItem(QUEUE_KEY) ?? "[]") as Report[];
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify([...list, r].slice(-10)));
  } catch { /* storage unavailable */ }
}
function flush() {
  try {
    const list = JSON.parse(sessionStorage.getItem(QUEUE_KEY) ?? "[]") as Report[];
    sessionStorage.removeItem(QUEUE_KEY);
    list.forEach(post);
  } catch { /* storage unavailable */ }
}

/** Report an error from a component (error boundaries, failed requests). Safe to call anywhere in the browser. */
export function reportClientError(error: unknown, opts: { type?: ClientType; source?: string; digest?: string | null } = {}) {
  if (typeof window === "undefined") return;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : (() => { try { return JSON.stringify(error); } catch { return String(error); } })());
  const message = `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message || "Unknown error"}`.slice(0, 1000);
  if (IGNORE.some((re) => re.test(message) || re.test(err.stack ?? ""))) return;
  const source = opts.source ?? window.location.pathname + window.location.search;
  const key = `${opts.type ?? "UI"}|${message}|${source}`;
  if (sent.has(key) || budget <= 0) return;
  sent.add(key);
  budget--;
  const report: Report = { type: opts.type ?? "UI", message, details: err.stack?.slice(0, 8000) ?? null, source, digest: opts.digest ?? (err as { digest?: string }).digest ?? null };
  if (!navigator.onLine) queue(report);
  else post(report);
}

let fetchOriginal: typeof fetch = (...a) => fetch(...a);

export function ErrorReporter() {
  useEffect(() => {
    fetchOriginal = window.fetch.bind(window);
    const onError = (e: ErrorEvent) => {
      if (e.filename && !e.filename.startsWith(window.location.origin)) return; // other sites' and extensions' scripts
      reportClientError(e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    // Requests to our own server that fail without an answer (offline, timeout, blocked) are network errors.
    const original = window.fetch;
    const patched: typeof fetch = async (input, init) => {
      try {
        return await original.call(window, input, init);
      } catch (e) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
        const aborted = (e as { name?: string })?.name === "AbortError" || init?.signal?.aborted;
        if (sameOrigin && !aborted && !url.includes("/api/errors")) {
          const path = url.startsWith("/") ? url : url.slice(window.location.origin.length);
          reportClientError(new Error(`Request failed: ${init?.method ?? "GET"} ${path.split("?")[0]} — ${(e as Error)?.message ?? "no response"}${navigator.onLine ? "" : " (browser offline)"}`), { type: "NETWORK" });
        }
        throw e;
      }
    };
    window.fetch = patched;
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("online", flush);
    if (navigator.onLine) flush();
    return () => {
      if (window.fetch === patched) window.fetch = original;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("online", flush);
    };
  }, []);
  return null;
}
