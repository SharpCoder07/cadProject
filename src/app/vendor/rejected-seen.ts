/** Cookie that records when the signed-in user last opened their rejected approval requests. */
export const REJECTED_SEEN_COOKIE = "cg_rejected_seen";

/** When this user last saw their rejected requests (from the cookie), or null. */
export function rejectedSeenAt(value: string | undefined, userId: string): Date | null {
  if (!value) return null;
  const [id, ts] = decodeURIComponent(value).split(".");
  const n = Number(ts);
  return id === userId && Number.isFinite(n) && n > 0 ? new Date(n) : null;
}
