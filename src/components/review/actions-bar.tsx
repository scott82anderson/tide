"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2, ExternalLink, Loader2, Send, Wrench } from "lucide-react";
import { toast } from "sonner";
import { approveDraft, convertEstimateToWorkOrder, sendForESign } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EstimateStatus } from "@/lib/dockmaster/types";
import { canSendToCustomer } from "@/lib/estimate-status";
import { formatDateTime } from "@/lib/demo-date";

export function ActionsBar({
  estimateId,
  status,
  workOrderNumber,
  requiresManagerApproval,
}: {
  estimateId: string;
  status: EstimateStatus;
  workOrderNumber: string | null;
  requiresManagerApproval: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusy(null);
      }
    });
  }

  const canApprove = status === "draft_ai" || status === "draft_reviewed";
  const canSend = canSendToCustomer(status) && status !== "draft_ai";
  const canConvert = status === "approved";
  const converted = status === "converted";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!canApprove || pending}
          onClick={() =>
            run("approve", async () => {
              await approveDraft(estimateId);
              toast.success(
                requiresManagerApproval
                  ? "Approved with manager sign-off: awaiting customer"
                  : "Approved: awaiting customer",
              );
            })
          }
        >
          {busy === "approve" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Approve draft
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant={canSend ? "default" : "outline"}
                disabled={!canSend || pending}
                onClick={() =>
                  run("send", async () => {
                    const { portalUrl } = await sendForESign(estimateId);
                    toast.success("Sent for eSign. Opening the owner's view.");
                    window.open(portalUrl, "_blank");
                  })
                }
              >
                {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />}
                Send for eSign
              </Button>
            </span>
          </TooltipTrigger>
          {!canSend && (
            <TooltipContent>
              {status === "draft_ai"
                ? "Approve the draft first"
                : converted
                  ? "Already converted to a work order"
                  : status === "approved"
                    ? "Customer has already signed"
                    : "Not available in this status"}
            </TooltipContent>
          )}
        </Tooltip>

        <Button
          variant="outline"
          disabled={!canConvert || pending}
          onClick={() =>
            run("convert", async () => {
              const { workOrder, suggestion: s } = await convertEstimateToWorkOrder(estimateId);
              const slot = s ? `Suggested: ${s.technician}, ${formatDateTime(s.start)}` : "No open slot found this week";
              setSuggestion(slot);
              toast.success(`Work order ${workOrder.number} created. ${slot}`);
            })
          }
        >
          {busy === "convert" ? <Loader2 className="animate-spin" /> : <Wrench />}
          Convert to work order
        </Button>

        {(status === "awaiting_customer") && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/portal/estimates/${estimateId}`} target="_blank">
              <ExternalLink /> Owner view
            </Link>
          </Button>
        )}

        {converted && workOrderNumber && (
          <span className="ml-auto flex items-center gap-2 text-sm">
            <span className="rounded bg-success-soft px-2 py-1 font-medium">Work order {workOrderNumber}</span>
            <Button asChild variant="link" size="sm" className="px-1">
              <Link href="/#scheduler">
                <CalendarCheck /> View on scheduler
              </Link>
            </Button>
          </span>
        )}
      </div>
      {suggestion && <p className="text-xs text-ai">{suggestion}</p>}
      <p className="text-xs text-muted-foreground">Nothing is sent to the customer without a staff action.</p>
    </div>
  );
}
