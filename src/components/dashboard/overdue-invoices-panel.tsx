"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { markReminderSent } from "@/app/actions";
import { AiMark } from "@/components/ai-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatMoney } from "@/lib/utils";

export interface OverdueInvoiceRow {
  id: string;
  number: string;
  customerName: string;
  amount: number;
  daysOverdue: number;
  ageBucket: "friendly" | "firm" | "final";
  description: string;
}

interface ReminderResponse {
  invoiceId: string;
  invoiceNumber: string;
  customer: { name: string; email: string; phone: string };
  amount: number;
  daysOverdue: number;
  tone: "friendly" | "firm" | "final";
  message: { subject: string; body: string; sms: string };
  link: { url: string; token: string };
}

type DialogState =
  | { status: "idle" }
  | { status: "loading"; invoice: OverdueInvoiceRow }
  | { status: "done"; invoice: OverdueInvoiceRow; result: ReminderResponse }
  | { status: "error"; invoice: OverdueInvoiceRow; message: string };

const BUCKET_CLASS: Record<OverdueInvoiceRow["ageBucket"], string> = {
  friendly: "border-border bg-muted text-muted-foreground",
  firm: "border-warning/50 bg-warning-soft text-warning-foreground",
  final: "border-destructive/40 bg-destructive/10 text-destructive",
};

const BUCKET_LABEL: Record<OverdueInvoiceRow["ageBucket"], string> = {
  friendly: "Under 30 days",
  firm: "30 to 60 days",
  final: "Over 60 days",
};

export function OverdueInvoicesPanel({ invoices }: { invoices: OverdueInvoiceRow[] }) {
  const [dialog, setDialog] = useState<DialogState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function draft(invoice: OverdueInvoiceRow) {
    setDialog({ status: "loading", invoice });
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const body = (await res.json()) as ReminderResponse & { error?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? "Could not draft the reminder.");
      setDialog({ status: "done", invoice, result: body });
    } catch (err) {
      setDialog({ status: "error", invoice, message: err instanceof Error ? err.message : "Could not draft the reminder." });
    }
  }

  function send(result: ReminderResponse, channel: "email" | "sms") {
    startTransition(async () => {
      try {
        await markReminderSent(result.invoiceId, channel, result.link.url);
        toast.success(`Reminder logged as sent by ${channel} (prototype does not send)`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not log the send.");
      }
    });
  }

  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No overdue invoices.</p>;
  }

  return (
    <>
      <ul className="divide-y">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-start justify-between gap-2 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{inv.customerName}</span>
                <span className="text-xs text-muted-foreground">{inv.number}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">{formatMoney(inv.amount)}</span>
                <span className="text-muted-foreground">{inv.daysOverdue} days overdue</span>
                <Badge variant="outline" className={cn("font-normal", BUCKET_CLASS[inv.ageBucket])}>
                  {BUCKET_LABEL[inv.ageBucket]}
                </Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{inv.description}</div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => draft(inv)}>
              Send payment reminder
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={dialog.status !== "idle"} onOpenChange={(open) => !open && setDialog({ status: "idle" })}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {dialog.status !== "idle" && (
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AiMark />
                Payment reminder: {dialog.invoice.number}
              </DialogTitle>
              <DialogDescription>
                {dialog.invoice.customerName}, {formatMoney(dialog.invoice.amount)}, {dialog.invoice.daysOverdue} days
                past due. Review before sending.
              </DialogDescription>
            </DialogHeader>
          )}

          {dialog.status === "loading" && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Writing reminder and creating ValPay link
            </div>
          )}

          {dialog.status === "error" && (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {dialog.message}
              </div>
              <Button variant="outline" onClick={() => draft(dialog.invoice)}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          )}

          {dialog.status === "done" && (
            <ReminderResult result={dialog.result} pending={pending} onSend={send} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReminderResult({
  result,
  pending,
  onSend,
}: {
  result: ReminderResponse;
  pending: boolean;
  onSend: (result: ReminderResponse, channel: "email" | "sms") => void;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  }
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Tone</span>
        <Badge variant="outline" className={cn("capitalize", BUCKET_CLASS[result.tone])}>
          {result.tone}
        </Badge>
      </div>

      <section className="space-y-1.5">
        <div className="flex items-center gap-2 font-medium">
          Email <AiMark />
        </div>
        <div className="rounded-md border bg-muted/50 p-3">
          <div className="mb-2 font-medium">{result.message.subject}</div>
          <p className="whitespace-pre-wrap">{result.message.body}</p>
        </div>
        <Button size="sm" disabled={pending} onClick={() => onSend(result, "email")}>
          Send email to {result.customer.email}
        </Button>
      </section>

      <section className="space-y-1.5">
        <div className="flex items-center gap-2 font-medium">
          SMS <AiMark />
          <span className="ml-auto text-xs text-muted-foreground">{result.message.sms.length} / 300</span>
        </div>
        <p className="rounded-md border bg-muted/50 p-3 whitespace-pre-wrap">{result.message.sms}</p>
        <Button size="sm" disabled={pending} onClick={() => onSend(result, "sms")}>
          Send SMS to {result.customer.phone}
        </Button>
      </section>

      <section className="space-y-1.5">
        <div className="font-medium">ValPay link (simulated)</div>
        <div className="flex gap-2">
          <Input readOnly value={result.link.url} className="font-mono text-xs" />
          <Button size="icon" variant="outline" onClick={copy} aria-label="Copy payment link">
            <Copy className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
