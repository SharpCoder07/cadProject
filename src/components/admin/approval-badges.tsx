import type { ApprovalAction, ApprovalEntity, ApprovalStatus } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/misc";

const ACTION: Record<ApprovalAction, { label: string; tone: BadgeTone }> = {
  CREATE: { label: "Publish new", tone: "success" },
  UPDATE: { label: "Edit", tone: "primary" },
  PUBLISH: { label: "Re-publish", tone: "success" },
  UNPUBLISH: { label: "Unpublish", tone: "warning" },
  DELETE: { label: "Delete", tone: "danger" },
  PASSWORD: { label: "Password", tone: "warning" },
};
const STATUS: Record<ApprovalStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", tone: "accent" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Withdrawn", tone: "neutral" },
};
/** Plain label for a request type, e.g. "Edit · Product". */
export const actionLabel = (action: ApprovalAction) => ACTION[action].label;

export const ENTITY_NAME: Record<ApprovalEntity, string> = { SOFTWARE: "Product", VENDOR_PROFILE: "Company profile", REVIEW_REPLY: "Review reply", VENDOR_USER: "Team member", OFFER: "Offer", RESELLER_PRODUCT: "Authorised product" };

export const ActionBadge = ({ action }: { action: ApprovalAction }) => <Badge tone={ACTION[action].tone}>{ACTION[action].label}</Badge>;
export const RequestStatusBadge = ({ status }: { status: ApprovalStatus }) => <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
