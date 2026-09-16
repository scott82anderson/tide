import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, FileText, History, Radio, Users } from "lucide-react";
import { AccountAgentsPanel } from "@/components/gtm/account-agents-panel";
import { ConsentBadge, QueueStatusBadge, SegmentBadge, StageBadge } from "@/components/gtm/badges";
import { ConsentToggle, StageSelect } from "@/components/gtm/consent-toggle";
import { ResearchView } from "@/components/gtm/output-views";
import { ScoutReportView } from "@/components/gtm/scout-report-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isAiConfigured } from "@/lib/ai/anthropic";
import { formatDate, formatDateTime } from "@/lib/demo-date";
import { latestResearch, latestScout } from "@/lib/gtm/agents/crm-reads";
import { scoutAccount, type ScoutReport } from "@/lib/gtm/agents/opportunity-scout";
import { agentName } from "@/lib/gtm/agents/registry";
import { KIND_LABEL, PLATFORM_LABEL, TIER_LABEL, usd } from "@/lib/gtm/labels";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import type { QueueKind } from "@/lib/gtm/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gtm = getGtmClient();
  const account = await gtm.getAccount(id);
  if (!account) notFound();

  const [scout, research, runs, queue, signals, codes, weeks, outbound] = await Promise.all([
    latestScout(gtm, id),
    latestResearch(gtm, id),
    gtm.listRuns({ accountId: id, limit: 40 }),
    gtm.listQueueItems({ accountId: id }),
    gtm.listSignals(id),
    gtm.listAccountCodes(id),
    gtm.listAccountWeeks(id),
    gtm.listOutbound({ accountId: id }),
  ]);

  // Group league table: the Scout across every site the group has on DockMaster.
  let league: { id: string; name: string; report: ScoutReport }[] = [];
  if (account.groupName) {
    const sites = (await gtm.listAccounts()).filter((a) => a.groupName === account.groupName);
    const dockmaster = getDockMasterClient();
    league = await Promise.all(sites.map(async (a) => ({ id: a.id, name: a.name, report: await scoutAccount({ dockmaster }, a) })));
    league.sort((a, b) => b.report.totalAnnualUsd - a.report.totalAnnualUsd);
  }

  const latestByKind = new Map<QueueKind, (typeof queue)[number]>();
  for (const q of queue) if (!latestByKind.has(q.kind)) latestByKind.set(q.kind, q);
  const by = account.ownerName ?? "Priya Desai";
  const contextLines = account.contextFile.split("\n").filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
            <StageBadge stage={account.stage} />
            <SegmentBadge segment={account.segment} />
            {account.designPartner && <Badge variant="outline" className="border-ai/40 bg-ai-soft">design partner</Badge>}
            {account.tier && <Badge variant="outline">{TIER_LABEL[account.tier]}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {account.city}, {account.state} · {PLATFORM_LABEL[account.platform]}
            {account.products.length > 0 && <> · {account.products.join(", ")}</>} · {account.technicianCount} technicians
            {account.groupName && <> · {account.groupName}</>} · owner {account.ownerName ?? "unassigned"}
            {account.ownerRole ? ` (${account.ownerRole})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ConsentToggle accountId={account.id} granted={account.dataConsent} by={by} />
          <StageSelect accountId={account.id} stage={account.stage} by={by} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="space-y-5">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="size-4 text-ai" /> Revenue Left on the Dock
                {scout && (
                  <span className="ml-auto flex items-center gap-2 text-xs font-normal text-muted-foreground">
                    <QueueStatusBadge status={scout.item.status} />
                    <Link href={`/gtm/queue/${scout.item.id}`} className="underline-offset-2 hover:underline">
                      review
                    </Link>
                  </span>
                )}
              </CardTitle>
              {!scout && <CardDescription>Not scored yet. Run the Opportunity Scout.</CardDescription>}
            </CardHeader>
            {scout && (
              <CardContent className="px-4">
                <ScoutReportView report={scout.report} />
              </CardContent>
            )}
          </Card>

          {league.length > 0 && (
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-base">{account.groupName}: cross-site league table</CardTitle>
                <CardDescription>Standardisation plus recovered revenue per site, sold top-down through the operating partner.</CardDescription>
              </CardHeader>
              <CardContent className="px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">A year</TableHead>
                      <TableHead className="text-right">Unbilled hours</TableHead>
                      <TableHead className="text-right">AR over 45 days</TableHead>
                      <TableHead>Platform</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {league.map((s) => (
                      <TableRow key={s.id} className={cn(s.id === account.id && "bg-muted/40")}>
                        <TableCell>
                          <Link href={`/gtm/accounts/${s.id}`} className="font-medium hover:underline">
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{s.report.score}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{usd(s.report.totalAnnualUsd)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{s.report.figures.find((f) => f.key === "unbilledHours")?.value ?? 0}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{usd(s.report.figures.find((f) => f.key === "arOver45")?.value ?? 0)}</TableCell>
                        <TableCell className="text-xs">{s.report.fit.onWebMobile ? "Web + Mobile" : "migration needed"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> Research
                {research && (
                  <span className="ml-auto flex items-center gap-2 text-xs font-normal text-muted-foreground">
                    <QueueStatusBadge status={research.item.status} />
                    <Link href={`/gtm/queue/${research.item.id}`} className="underline-offset-2 hover:underline">
                      review
                    </Link>
                  </span>
                )}
              </CardTitle>
              {!research && <CardDescription>{signals.length} public signals on file, not yet classified. Run the Account Researcher.</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4 px-4">
              {research && <ResearchView research={research.research} />}
              {signals.length > 0 && (
                <details className="rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Raw signals ({signals.length})</summary>
                  <ul className="divide-y border-t text-sm">
                    {signals.map((s) => (
                      <li key={s.id} className="space-y-0.5 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{s.id}</span>
                          <Badge variant="outline" className="capitalize">
                            {s.source.replace("_", " ")}
                          </Badge>
                          <span>{formatDate(s.observedAt)}</span>
                        </div>
                        <div className="font-medium">{s.title}</div>
                        <p className="text-xs">{s.body}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          {(weeks.length > 0 || codes.length > 0) && (
            <div className="grid gap-5 md:grid-cols-2">
              {weeks.length > 0 && (
                <Card className="gap-3 py-4">
                  <CardHeader className="px-4">
                    <CardTitle className="text-base">Product telemetry</CardTitle>
                    <CardDescription>Weekly, from the product events warehouse.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Week</TableHead>
                          <TableHead className="text-right">Drafts</TableHead>
                          <TableHead className="text-right">Edit</TableHead>
                          <TableHead className="text-right">Approval</TableHead>
                          <TableHead className="text-right">AR days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeks.map((w) => (
                          <TableRow key={w.id}>
                            <TableCell className="text-xs">{formatDate(w.weekStart)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{w.draftsStarted}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{Math.round(w.editRate * 100)}%</TableCell>
                            <TableCell className="text-right font-mono text-xs">{Math.round(w.approvalRate * 100)}%</TableCell>
                            <TableCell className="text-right font-mono text-xs">{w.arDays}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {codes.length > 0 && (
                <Card className="gap-3 py-4">
                  <CardHeader className="px-4">
                    <CardTitle className="text-base">Exported operation codes ({codes.length})</CardTitle>
                    <CardDescription>As pulled from the account&apos;s system. Merges apply only after CSM approval.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4">
                    <ul className="max-h-72 space-y-0.5 overflow-auto text-xs">
                      {codes.map((c) => (
                        <li key={c.id} className={cn("flex items-center gap-2", c.mergedInto && "text-muted-foreground line-through")}>
                          <span className="w-20 font-mono">{c.code}</span>
                          <span className="flex-1 truncate">{c.description}</span>
                          <span className="font-mono">{c.usageCount}</span>
                          {c.mergedInto && <span className="no-underline">into {c.mergedInto}</span>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-4 text-ai" /> Run an agent
              </CardTitle>
              <CardDescription>Each output lands on the review queue for its named owner.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <AccountAgentsPanel
                accountId={account.id}
                recommendedTier={scout?.report.fit.recommendedTier ?? null}
                hasScout={Boolean(scout)}
                hasCodes={codes.length > 0}
                hasTelemetry={weeks.length >= 2}
                aiConfigured={isAiConfigured()}
              />
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Drafts on the queue</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {[...latestByKind.values()].map((q) => (
                    <li key={q.id} className="flex flex-wrap items-center gap-2 py-2">
                      <Link href={`/gtm/queue/${q.id}`} className="font-medium hover:underline">
                        {KIND_LABEL[q.kind]}
                      </Link>
                      <QueueStatusBadge status={q.status} />
                      <span className="ml-auto text-xs text-muted-foreground">{formatDate(q.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {outbound.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {outbound.length} touch(es) sent, each by a named person: {[...new Set(outbound.map((m) => m.approvedBy))].join(", ")}.
                  {outbound.some((m) => m.status === "replied") && " Prospect replied."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" /> Context file
              </CardTitle>
              <CardDescription>The per-account memory every agent reads before acting and writes back to.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <div className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {contextLines.map((l, i) => (
                  <div key={i} className={cn(l.startsWith("#") && "font-semibold")}>
                    {l}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <ConsentBadge granted={account.dataConsent} />
                {account.consentGrantedAt && <span className="text-xs text-muted-foreground">since {formatDate(account.consentGrantedAt)}</span>}
                {account.contacts.map((c) => (
                  <Badge key={c.name} variant="outline" className="font-normal">
                    {c.name}, {c.title}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" /> Agent runs
              </CardTitle>
              <CardDescription>Every action with inputs, outputs and latency.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {runs.map((r) => (
                    <li key={r.id} className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{agentName(r.agent)}</span>
                        <Badge
                          variant="outline"
                          className={cn(r.status === "succeeded" && "border-success/40 bg-success-soft", r.status === "blocked" && "border-warning/50 bg-warning-soft text-warning-foreground", r.status === "failed" && "border-destructive/40 bg-destructive/10 text-destructive")}
                        >
                          {r.status}
                        </Badge>
                        {r.model && <span className="font-mono text-[11px] text-muted-foreground">{r.model}</span>}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {(r.latencyMs / 1000).toFixed(1)}s · {formatDateTime(r.createdAt)}
                        </span>
                      </div>
                      {r.error && <div className="text-xs text-warning-foreground">{r.error}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
