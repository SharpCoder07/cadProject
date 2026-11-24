"use client";

import { useEffect } from "react";
import { REJECTED_SEEN_COOKIE } from "../rejected-seen";

/**
 * Remembers (in this browser) that the user has looked at their rejected requests, so the
 * "rejected recently" notice on the overview only shows for rejections that came in after that.
 */
export function MarkRejectedSeen({ userId }: { userId: string }) {
  useEffect(() => {
    document.cookie = `${REJECTED_SEEN_COOKIE}=${encodeURIComponent(`${userId}.${Date.now()}`)}; path=/; max-age=31536000; samesite=lax`;
  }, [userId]);
  return null;
}
