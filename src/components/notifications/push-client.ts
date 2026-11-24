"use client";

/** Browser side of push notifications: service worker registration and this browser's subscription. */
export type PushState = "unsupported" | "denied" | "off" | "on";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;

/** iPhone/iPad only allow push for a site added to the Home Screen. */
export const needsHomeScreen = () =>
  typeof window !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent) && !("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) && !window.matchMedia("(display-mode: standalone)").matches;

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

const toBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function send(method: "POST" | "DELETE", body: unknown) {
  const res = await fetch("/api/push", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't update notifications.");
}

/** Asks for permission (must run from a click) and saves this browser on the server. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const keyRes = await fetch("/api/push", { cache: "no-store" });
  if (!keyRes.ok) throw new Error("Couldn't reach the server. Try again.");
  const { publicKey } = (await keyRes.json()) as { publicKey: string };
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older server key no longer works: replace it.
  if (sub) {
    const current = sub.options.applicationServerKey;
    const same = current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === publicKey;
    if (!same) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) });
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await send("POST", { endpoint: json.endpoint, keys: json.keys, test: true });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await send("DELETE", { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "off";
}

/** Re-sends this browser's subscription after sign-in (another person may have used it before). */
export async function refreshPush() {
  if ((await pushState()) !== "on") return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await send("POST", { endpoint: json.endpoint, keys: json.keys }).catch(() => undefined);
}
