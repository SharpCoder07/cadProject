"use client";

import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useServerAction } from "./use-action";
import { revokeAllSessionsAction, revokeSessionAction } from "@/app/admin/users/actions";

export function SessionsList({ userId, sessions, allowRevokeAll }: { userId: string; sessions: { id: string; createdAt: string; lastSeenAt: string; ipAddress: string | null; userAgent: string | null }[]; allowRevokeAll: boolean }) {
  const revoke = useServerAction(revokeSessionAction);
  const revokeAll = useServerAction(revokeAllSessionsAction);
  return (
    <div>
      <ul className="divide-y divide-line">
        {sessions.length === 0 && <li className="px-4 py-3 text-sm text-muted">No active sessions.</li>}
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{s.userAgent ?? "Unknown device"}</span>
              <span className="text-xs text-muted">{s.ipAddress ?? "—"} · signed in {formatDateTime(s.createdAt)} · last active {formatDateTime(s.lastSeenAt)}</span>
            </span>
            <Button size="sm" variant="secondary" loading={revoke.pending} onClick={() => void revoke.run({ id: s.id, userId })}>Sign out</Button>
          </li>
        ))}
      </ul>
      {allowRevokeAll && sessions.length > 0 && <div className="flex justify-end border-t border-line px-5 py-3"><Button size="sm" variant="danger" loading={revokeAll.pending} onClick={() => void revokeAll.run({ userId })}>Sign out of all devices</Button></div>}
    </div>
  );
}
