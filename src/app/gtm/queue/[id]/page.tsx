import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { QueueStatusBadge } from "@/components/gtm/badges";
import { JsonView, OutputView, SequenceView } from "@/components/gtm/output-views";
import { QueueReview, SendTouchButton } from "@/components/gtm/queue-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/demo-date";
import { effectiveOutput } from "@/lib/gtm/agents/crm-reads";
import { AGENT_BY_KEY } from "@/lib/gtm/agents/registry";
import type { SequenceOutput } from "@/lib/gtm/agents/sequencer";
import { KIND_LABEL } from "@/lib/gtm/labels";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import { approversFor } from "@/lib/gtm/team";

export const dynamic = "force-dynamic";

export default async function QueueItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gtm = getGtmClient();
  const item = await gtm.getQueueItem(id);
  if (!item) notFound();
  const agent = AGENT_BY_KEY[item.agent];
  const source = (item.sourceData ?? {}) as { notes?: string[]; steps?: { step: string; latencyMs: number; model?: string }[] } & Record<string, unknown>;
  const notes = source.notes ?? [];
  const steps = source.steps ?? [];
  const { notes: _n, steps: _s, ...rest } = source;
  void _n;
  void _s;
  const approvers = approversFor(item.approverRole);
  const output = effectiveOutput<unknown>(item);
  const sendable = item.status === "approved" || item.status === "edited";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 px-2">
            <Link href="/gtm/queue">
              <ArrowLeft className="size-4" /> Queue
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            <QueueStatusBadge status={item.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {KIND_LABEL[item.kind]} drafted by {agent.name} ({agent.modelTier === "none" ? "deterministic" : `${agent.modelTier} model`}) for the {item.approverRole}
            {item.accountId && (
              <>
                {" "}
                · account{" "}
                <Link href={`/gtm/accounts/${item.accountId}`} className="underline-offset-2 hover:underline">
                  {item.accountName}
                </Link>
              </>
            )}{" "}
            · {formatDateTime(item.createdAt)}
          </p>
          {item.reviewerName && (
            <p className="text-sm">
              {item.status === "rejected" ? "Rejected" : "Approved"} by {item.reviewerName}
              {item.reviewedAt ? ` on ${formatDateTime(item.reviewedAt)}` : ""}
              {item.editRatio != null ? `, edit ratio ${item.editRatio}` : ""}
              {item.reviewNote ? `: ${item.reviewNote}` : ""}
            </p>
          )}
        </div>
      </div>

      {notes.length > 0 && (
        <div className="space-y-1 rounded-md border border-warning/50 bg-warning-soft p-3 text-sm text-warning-foreground">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" /> Guardrail notes for the reviewer
          </div>
          <ul className="list-disc space-y-0.5 pl-6">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">The draft</CardTitle>
          {item.status === "edited" && <CardDescription>Showing the reviewer&apos;s edited version.</CardDescription>}
        </CardHeader>
        <CardContent className="px-4">
          {item.kind === "sequence" ? (
            <SequenceView
              seq={output as SequenceOutput}
              sentTouches={item.sentTouches}
              actions={(i) => (
                <SendTouchButton itemId={item.id} touchIndex={i} channel={(output as SequenceOutput).touches[i].channel} approvers={approvers} sent={item.sentTouches.includes(i)} enabled={sendable} />
              )}
            />
          ) : (
            <OutputView kind={item.kind} output={output} />
          )}
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Decision</CardTitle>
          <CardDescription>
            {item.kind === "sequence"
              ? "Approve, then send each touch by name. The send buttons stay disabled until you do."
              : "Approve as is, edit and approve (the edit is measured), or reject with a note."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <QueueReview itemId={item.id} status={item.status} approverRole={item.approverRole} approvers={approvers} outputJson={JSON.stringify(item.output, null, 2)} />
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">What the agent saw</CardTitle>
          <CardDescription>Source data and model steps, for the audit trail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {steps.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {steps.map((s, i) => (
                <Badge key={i} variant="outline" className="font-normal">
                  {s.step} {s.model ? `· ${s.model}` : ""} · {s.latencyMs} ms
                </Badge>
              ))}
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium">Source data</summary>
            <div className="pt-2">
              <JsonView value={rest} />
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-medium">Raw output</summary>
            <div className="pt-2">
              <JsonView value={item.output} />
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
