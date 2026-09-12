"use server";

import { revalidatePath } from "next/cache";
import { computeTotals, MANAGER_APPROVAL_THRESHOLD } from "@/lib/ai/build-estimate";
import { DEMO_TODAY, addDays, demoWeekStart } from "@/lib/demo-date";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import type { EstimateLine } from "@/lib/dockmaster/types";
import { canSendToCustomer } from "@/lib/estimate-status";
import { suggestSlot } from "@/lib/scheduling/suggest-slot";
import { round2 } from "@/lib/utils";

export interface LineEdit {
  lineId: string;
  hours?: number | null;
  qty?: number;
  included?: boolean;
}

function recomputeLine(line: EstimateLine, edit: LineEdit): { hours?: number | null; qty?: number; included?: boolean; lineTotal: number } {
  const hours = edit.hours !== undefined ? edit.hours : line.hours;
  const qty = edit.qty !== undefined ? edit.qty : line.qty;
  const included = edit.included !== undefined ? edit.included : line.included;
  let lineTotal = line.lineTotal;
  if (line.kind === "operation") lineTotal = round2((hours ?? 0) * (line.rate ?? 0));
  if (line.kind === "part") lineTotal = round2(qty * (line.unitPrice ?? 0));
  return { hours, qty, included, lineTotal };
}

/** Manager edits hours, quantity or inclusion. Edited lines become staff-owned. */
export async function updateEstimateLines(estimateId: string, edits: LineEdit[]) {
  const client = getDockMasterClient();
  const [estimate, marina] = await Promise.all([client.getEstimate(estimateId), client.getMarina()]);
  if (!estimate) throw new Error("Estimate not found");

  const byId = new Map(estimate.lines.map((l) => [l.id, l]));
  const lineUpdates: NonNullable<Parameters<typeof client.updateEstimate>[1]["lines"]> = {};
  const nextLines = estimate.lines.map((l) => ({ ...l }));

  for (const edit of edits) {
    const line = byId.get(edit.lineId);
    if (!line) continue;
    const next = recomputeLine(line, edit);
    lineUpdates[edit.lineId] = { ...next, source: "staff" };
    const target = nextLines.find((l) => l.id === edit.lineId)!;
    Object.assign(target, next);
    // Part lines follow their operation line's inclusion.
    if (line.kind === "operation" && edit.included !== undefined) {
      for (const child of nextLines.filter((c) => c.parentLineId === line.id)) {
        child.included = edit.included;
        lineUpdates[child.id] = { included: edit.included, lineTotal: child.lineTotal, source: "staff" };
      }
    }
  }

  const totals = computeTotals(nextLines, marina);
  const updated = await client.updateEstimate(estimateId, {
    status: estimate.status === "draft_ai" ? "draft_reviewed" : undefined,
    totals,
    requiresManagerApproval: totals.total > MANAGER_APPROVAL_THRESHOLD,
    lines: lineUpdates,
  });
  await client.logActivity({
    actor: "staff",
    action: "estimate.edited",
    entityType: "estimate",
    entityId: estimateId,
    payload: { edits, total: totals.total },
  });
  revalidatePath(`/jobs/${estimateId}`);
  revalidatePath("/");
  return updated;
}

/** Manager approves the draft: every line becomes staff-owned and it can go to the customer. */
export async function approveDraft(estimateId: string) {
  const client = getDockMasterClient();
  const estimate = await client.getEstimate(estimateId);
  if (!estimate) throw new Error("Estimate not found");
  const lines: NonNullable<Parameters<typeof client.updateEstimate>[1]["lines"]> = {};
  for (const l of estimate.lines) lines[l.id] = { source: "staff", lineTotal: l.lineTotal };
  const updated = await client.updateEstimate(estimateId, {
    status: "awaiting_customer",
    approvedAt: DEMO_TODAY,
    lines,
  });
  await client.logActivity({
    actor: "staff",
    action: "estimate.approved_by_manager",
    entityType: "estimate",
    entityId: estimateId,
    payload: { total: estimate.totals.total, requiresManagerApproval: estimate.requiresManagerApproval },
  });
  revalidatePath(`/jobs/${estimateId}`);
  revalidatePath("/");
  return updated;
}

/** Sends the estimate to the owner's portal for eSign. Blocked while still an AI draft. */
export async function sendForESign(estimateId: string) {
  const client = getDockMasterClient();
  const estimate = await client.getEstimate(estimateId);
  if (!estimate) throw new Error("Estimate not found");
  if (!canSendToCustomer(estimate.status)) {
    throw new Error("Approve the draft before sending it to the customer.");
  }
  await client.updateEstimate(estimateId, { status: "awaiting_customer", sentAt: DEMO_TODAY });
  await client.logActivity({
    actor: "staff",
    action: "estimate.sent_for_esign",
    entityType: "estimate",
    entityId: estimateId,
    payload: { to: estimate.customer.email, portalUrl: `/portal/estimates/${estimateId}` },
  });
  revalidatePath(`/jobs/${estimateId}`);
  revalidatePath("/");
  return { portalUrl: `/portal/estimates/${estimateId}` };
}

/** Converts an approved estimate and asks the scheduling assistant for a slot. */
export async function convertEstimateToWorkOrder(estimateId: string) {
  const client = getDockMasterClient();
  const estimate = await client.getEstimate(estimateId);
  const workOrder = await client.convertToWorkOrder(estimateId);
  await client.logActivity({
    actor: "staff",
    action: "estimate.converted",
    entityType: "estimate",
    entityId: estimateId,
    payload: { workOrderNumber: workOrder.number },
  });

  // Hand-off to the (simulated) AI Scheduling Assistant.
  const weekStart = demoWeekStart();
  const [technicians, blocks] = await Promise.all([
    client.listTechnicians(),
    client.listScheduleBlocks({ start: weekStart, end: addDays(weekStart, 14) }),
  ]);
  const suggestion = suggestSlot(workOrder, technicians, blocks, undefined, estimate?.technicianId ?? null);
  if (suggestion) {
    const block = await client.createScheduleBlock({
      technicianId: suggestion.technician.id,
      workOrderId: workOrder.id,
      label: `${workOrder.number} ${workOrder.description}`,
      start: suggestion.start,
      end: suggestion.end,
      source: "ai_suggested",
    });
    await client.logActivity({
      actor: "ai",
      action: "schedule.suggested",
      entityType: "work_order",
      entityId: workOrder.id,
      payload: { technician: suggestion.technician.name, start: suggestion.start, end: suggestion.end, reason: suggestion.reason, blockId: block.id },
    });
  }
  revalidatePath(`/jobs/${estimateId}`);
  revalidatePath("/");
  return { workOrder, suggestion: suggestion ? { technician: suggestion.technician.name, start: suggestion.start, end: suggestion.end, reason: suggestion.reason } : null };
}

/** Boat owner signs in the portal. Approval converts straight to a work order. */
export async function portalSignEstimate(estimateId: string, signedByName: string) {
  const client = getDockMasterClient();
  const estimate = await client.getEstimate(estimateId);
  if (!estimate) throw new Error("Estimate not found");
  if (estimate.status !== "awaiting_customer") throw new Error("This estimate is not awaiting signature.");
  await client.updateEstimate(estimateId, {
    status: "approved",
    signedByName: signedByName.trim(),
    signedAt: DEMO_TODAY,
  });
  await client.logActivity({
    actor: "customer",
    action: "estimate.signed",
    entityType: "estimate",
    entityId: estimateId,
    payload: { signedByName: signedByName.trim(), total: estimate.totals.total },
  });
  const converted = await convertEstimateToWorkOrder(estimateId);
  revalidatePath(`/portal/estimates/${estimateId}`);
  return converted;
}

export async function portalDeclineEstimate(estimateId: string, reason: string) {
  const client = getDockMasterClient();
  await client.updateEstimate(estimateId, { status: "declined", declinedReason: reason.trim() || "No reason given" });
  await client.logActivity({
    actor: "customer",
    action: "estimate.declined",
    entityType: "estimate",
    entityId: estimateId,
    payload: { reason },
  });
  revalidatePath(`/portal/estimates/${estimateId}`);
  revalidatePath(`/jobs/${estimateId}`);
  revalidatePath("/");
}

/** Manager confirms the vessel from the shortlist when the match was low confidence. */
export async function confirmVessel(estimateId: string, vesselId: string) {
  const client = getDockMasterClient();
  const vessel = await client.getVessel(vesselId);
  if (!vessel) throw new Error("Vessel not found");
  await client.updateEstimate(estimateId, {
    vesselId: vessel.id,
    customerId: vessel.customerId,
    vesselMatchConfidence: 1,
    vesselMatchReasons: ["Confirmed by service manager"],
  });
  await client.logActivity({
    actor: "staff",
    action: "estimate.vessel_confirmed",
    entityType: "estimate",
    entityId: estimateId,
    payload: { vesselId, vessel: vessel.name },
  });
  revalidatePath(`/jobs/${estimateId}`);
}

export async function acceptSuggestedSlot(blockId: string) {
  const client = getDockMasterClient();
  const block = await client.updateScheduleBlock(blockId, { source: "staff" });
  await client.logActivity({
    actor: "staff",
    action: "schedule.accepted",
    entityType: "work_order",
    entityId: block.workOrderId ?? blockId,
    payload: { technician: block.technicianName, start: block.start },
  });
  revalidatePath("/");
}

export async function rejectSuggestedSlot(blockId: string) {
  const client = getDockMasterClient();
  await client.deleteScheduleBlock(blockId);
  await client.logActivity({
    actor: "staff",
    action: "schedule.rejected",
    entityType: "schedule_block",
    entityId: blockId,
    payload: {},
  });
  revalidatePath("/");
}

/** Staff clicks send on a reviewed reminder. The prototype logs instead of emailing. */
export async function markReminderSent(invoiceId: string, channel: "email" | "sms", link: string) {
  const client = getDockMasterClient();
  await client.logActivity({
    actor: "staff",
    action: "reminder.sent",
    entityType: "invoice",
    entityId: invoiceId,
    payload: { channel, link },
  });
  revalidatePath("/");
}

/** Staff sends the proactive outreach message (logged, not emailed). */
export async function markOutreachSent(estimateId: string, channel: "email" | "sms") {
  const client = getDockMasterClient();
  await client.updateEstimate(estimateId, { status: "awaiting_customer", sentAt: DEMO_TODAY });
  await client.logActivity({
    actor: "staff",
    action: "outreach.sent",
    entityType: "estimate",
    entityId: estimateId,
    payload: { channel },
  });
  revalidatePath("/");
}
