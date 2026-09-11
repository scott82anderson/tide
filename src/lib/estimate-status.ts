import type { EstimateStatus } from "@/lib/dockmaster/types";

export const STATUS_LABEL: Record<EstimateStatus, string> = {
  draft_ai: "AI draft: awaiting review",
  draft_reviewed: "Draft: reviewed",
  awaiting_customer: "Estimate: awaiting customer",
  approved: "Approved by customer",
  declined: "Declined by customer",
  converted: "Work order",
};

export const STATUS_TONE: Record<EstimateStatus, "ai" | "neutral" | "warning" | "success" | "destructive"> = {
  draft_ai: "ai",
  draft_reviewed: "neutral",
  awaiting_customer: "warning",
  approved: "success",
  declined: "destructive",
  converted: "success",
};

/** Hard rule: nothing goes to a customer while the estimate is an unreviewed AI draft. */
export function canSendToCustomer(status: EstimateStatus): boolean {
  return status === "awaiting_customer" || status === "draft_reviewed";
}
