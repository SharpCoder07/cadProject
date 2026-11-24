import { Badge } from "@/components/ui/misc";
import { errorTypeLabel } from "@/lib/error-types";

export const ErrorStatusBadge = ({ status, reopened }: { status: string; reopened?: boolean }) =>
  status === "RESOLVED" ? <Badge tone="success">Resolved</Badge> : <Badge tone="danger">{reopened ? "Pending · happened again" : "Pending"}</Badge>;

const TYPE_TONE: Record<string, "accent" | "warning" | "danger" | "primary" | "neutral"> = { UI: "primary", BACKEND: "accent", SERVER: "danger", DATABASE: "warning", NETWORK: "neutral" };
export const ErrorTypeBadge = ({ type }: { type: string }) => <Badge tone={TYPE_TONE[type] ?? "neutral"}>{errorTypeLabel(type)}</Badge>;
