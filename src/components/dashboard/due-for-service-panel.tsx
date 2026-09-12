"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Mail, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { markOutreachSent } from "@/app/actions";
import { AiMark } from "@/components/ai-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/demo-date";
import { formatMoney } from "@/lib/utils";

export interface DueOperation {
  code: string;
  description: string;
  monthsOverdue: number;
  intervalMonths: number;
  lastWorkOrderNumber: string | null;
  /** ISO string or null. */
  lastDoneAt: string | null;
}

export interface DueVessel {
  vesselId: string;
  name: string;
  detail: string;
  owner: string;
  operations: DueOperation[];
}

interface OutreachResponse {
  estimateId: string;
  estimateNumber: string;
  total: number;
  requiresManagerApproval: boolean;
  customerSummary: string | null;
  message: { sms: string; emailSubject: string; emailBody: string };
  customer: { name: string; email: string; phone: string };
}

type DialogState =
  | { status: "idle" }
  | { status: "loading"; vessel: DueVessel; code: string; stage: string }
  | { status: "done"; vessel: DueVessel; code: string; result: OutreachResponse }
  | { status: "error"; vessel: DueVessel; code: string; message: string };

export function DueForServicePanel({ vessels }: { vessels: DueVessel[] }) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<DialogState>({ status: "idle" });
  // Closing the dialog mid-request must not let the late response re-open it.
  const requestId = useRef(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function draft(vessel: DueVessel, code: string) {
    const id = ++requestId.current;
    const stale = () => id !== requestId.current;
    setDialog({ status: "loading", vessel, code, stage: "Pricing from operation code and kit" });
    const timer = setTimeout(
      () => setDialog((d) => (d.status === "loading" ? { ...d, stage: "Writing message" } : d)),
      2500,
    );
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vesselId: vessel.vesselId, code }),
      });
      const body = (await res.json()) as OutreachResponse & { error?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? "Could not draft outreach.");
      if (stale()) return;
      setDialog({ status: "done", vessel, code, result: body });
      router.refresh();
    } catch (err) {
      if (stale()) return;
      setDialog({ status: "error", vessel, code, message: err instanceof Error ? err.message : "Could not draft outreach." });
    } finally {
      clearTimeout(timer);
    }
  }

  function send(estimateId: string, channel: "email" | "sms") {
    startTransition(async () => {
      try {
        await markOutreachSent(estimateId, channel);
        toast.success("Logged as sent (prototype does not send)");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not log the send.");
      }
    });
  }

  if (vessels.length === 0) {
    return <p className="text-sm text-muted-foreground">No vessels are past a service interval.</p>;
  }

  return (
    <>
      <ul className="divide-y">
        {vessels.map((v) => {
          const selected = choice[v.vesselId] ?? v.operations[0].code;
          return (
            <li key={v.vesselId} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{v.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {v.detail} · {v.owner}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => draft(v, selected)}>
                  Draft outreach
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {v.operations.map((op) => (
                  <Badge key={op.code} variant="outline" className="border-warning/50 bg-warning-soft text-warning-foreground font-normal">
                    {op.description}: {op.monthsOverdue} mo overdue
                    {op.lastWorkOrderNumber && op.lastDoneAt && (
                      <span className="opacity-70">
                        {" "}
                        (last {op.lastWorkOrderNumber}, {formatDate(op.lastDoneAt)})
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
              {v.operations.length > 1 && (
                <Select value={selected} onValueChange={(val) => setChoice((c) => ({ ...c, [v.vesselId]: val }))}>
                  <SelectTrigger size="sm" className="h-7 w-full text-xs">
                    <SelectValue placeholder="Operation to quote" />
                  </SelectTrigger>
                  <SelectContent>
                    {v.operations.map((op) => (
                      <SelectItem key={op.code} value={op.code} className="text-xs">
                        {op.code}: {op.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={dialog.status !== "idle"} onOpenChange={(open) => {
          if (open) return;
          requestId.current++;
          setDialog({ status: "idle" });
        }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {dialog.status !== "idle" && (
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AiMark />
                Outreach for {dialog.vessel.name}
              </DialogTitle>
              <DialogDescription>
                {dialog.vessel.operations.find((o) => o.code === dialog.code)?.description ?? dialog.code} for{" "}
                {dialog.vessel.owner}. Nothing is sent until you click send.
              </DialogDescription>
            </DialogHeader>
          )}

          {dialog.status === "loading" && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {dialog.stage}
            </div>
          )}

          {dialog.status === "error" && (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {dialog.message}
              </div>
              <Button variant="outline" onClick={() => draft(dialog.vessel, dialog.code)}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          )}

          {dialog.status === "done" && (
            <OutreachResult result={dialog.result} pending={pending} onSend={send} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OutreachResult({
  result,
  pending,
  onSend,
}: {
  result: OutreachResponse;
  pending: boolean;
  onSend: (estimateId: string, channel: "email" | "sms") => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{result.estimateNumber}</Badge>
        <span className="font-medium">{formatMoney(result.total)}</span>
        <Link href={`/jobs/${result.estimateId}`} className="ml-auto text-primary underline-offset-2 hover:underline">
          Review estimate
        </Link>
      </div>
      {result.requiresManagerApproval && (
        <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning-soft p-2 text-warning-foreground">
          <AlertTriangle className="size-4 shrink-0" />
          Estimate is over $5,000 and requires manager approval before sending.
        </div>
      )}
      {result.customerSummary && <p className="text-muted-foreground">{result.customerSummary}</p>}

      <section className="space-y-1.5">
        <div className="flex items-center gap-2 font-medium">
          <MessageSquare className="size-4" /> SMS <AiMark />
          <span className="ml-auto text-xs text-muted-foreground">{result.message.sms.length} / 300</span>
        </div>
        <p className="rounded-md border bg-muted/50 p-3 whitespace-pre-wrap">{result.message.sms}</p>
        <Button size="sm" disabled={pending} onClick={() => onSend(result.estimateId, "sms")}>
          Send SMS to {result.customer.phone}
        </Button>
      </section>

      <section className="space-y-1.5">
        <div className="flex items-center gap-2 font-medium">
          <Mail className="size-4" /> Email <AiMark />
        </div>
        <div className="rounded-md border bg-muted/50 p-3">
          <div className="mb-2 font-medium">{result.message.emailSubject}</div>
          <p className="whitespace-pre-wrap">{result.message.emailBody}</p>
        </div>
        <Button size="sm" disabled={pending} onClick={() => onSend(result.estimateId, "email")}>
          Send email to {result.customer.email}
        </Button>
      </section>
      <DialogFooter className="text-xs text-muted-foreground sm:justify-start">
        Sending is logged only. The production build hands these to DockMaster messaging.
      </DialogFooter>
    </div>
  );
}
