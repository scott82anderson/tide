import Link from "next/link";
import { Inbox } from "lucide-react";
import { QueueStatusBadge } from "@/components/gtm/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/demo-date";
import { agentName } from "@/lib/gtm/agents/registry";
import { KIND_LABEL, QUEUE_STATUS_LABEL } from "@/lib/gtm/labels";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import type { QueueStatus } from "@/lib/gtm/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES: QueueStatus[] = ["pending", "approved", "edited", "rejected"];

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const active: QueueStatus | "all" = STATUSES.includes(status as QueueStatus) ? (status as QueueStatus) : status === "all" ? "all" : "pending";
  const items = await getGtmClient().listQueueItems(active === "all" ? undefined : { status: [active] });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Inbox className="size-5" /> Review queue
        </h1>
        <p className="text-sm text-muted-foreground">Every agent output waits here for a named human. Each item shows the source data the agent saw.</p>
      </div>

      <nav className="flex flex-wrap gap-1 text-sm">
        {STATUSES.map((s) => (
          <Link key={s} href={`/gtm/queue?status=${s}`} className={cn("rounded-md border px-2.5 py-1 transition-colors hover:bg-accent", active === s ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "border-border")}>
            {QUEUE_STATUS_LABEL[s]}
          </Link>
        ))}
        <Link href="/gtm/queue?status=all" className={cn("rounded-md border px-2.5 py-1 transition-colors hover:bg-accent", active === "all" ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "border-border")}>
          All
        </Link>
      </nav>

      <Card className="py-2">
        <CardContent className="px-2">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nothing with status &ldquo;{active === "all" ? "any" : QUEUE_STATUS_LABEL[active]}&rdquo;.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Draft</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Approver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/gtm/queue/${q.id}`} className="font-medium hover:underline">
                        {q.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{KIND_LABEL[q.kind]}</div>
                    </TableCell>
                    <TableCell className="text-xs">{agentName(q.agent)}</TableCell>
                    <TableCell className="text-xs">
                      {q.accountId ? (
                        <Link href={`/gtm/accounts/${q.accountId}`} className="hover:underline">
                          {q.accountName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">all accounts</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {q.approverRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <QueueStatusBadge status={q.status} />
                      {q.reviewerName && <div className="text-[11px] text-muted-foreground">{q.reviewerName}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(q.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
