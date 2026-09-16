import Link from "next/link";
import { ConfidenceWord, ConsentBadge, StageBadge } from "@/components/gtm/badges";
import { RunAgentButton } from "@/components/gtm/run-agent-button";
import { ScoreAllButton } from "@/components/gtm/score-all-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLATFORM_LABEL, SEGMENT_LABEL, TIER_LABEL, usd } from "@/lib/gtm/labels";
import { rollupAccounts } from "@/lib/gtm/metrics";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import type { Segment } from "@/lib/gtm/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SEGMENTS: Segment[] = ["install_base", "new_logo", "group"];

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ segment?: string }> }) {
  const { segment } = await searchParams;
  const active = SEGMENTS.includes(segment as Segment) ? (segment as Segment) : null;
  const gtm = getGtmClient();
  const [accounts, runs, queue, outbound] = await Promise.all([
    gtm.listAccounts(active ? { segment: active } : undefined),
    gtm.listRuns({ limit: 1000 }),
    gtm.listQueueItems(),
    gtm.listOutbound(),
  ]);
  const outboundBy = new Map<string, number>();
  for (const m of outbound) outboundBy.set(m.accountId, (outboundBy.get(m.accountId) ?? 0) + 1);
  const rows = rollupAccounts(accounts, runs, queue, outboundBy).sort((a, b) => (b.scout?.score ?? -1) - (a.scout?.score ?? -1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">The CRM record is the agents&apos; shared memory. Consent decides which data the Scout may use.</p>
        </div>
        <ScoreAllButton />
      </div>

      <nav className="flex flex-wrap gap-1 text-sm">
        <FilterLink href="/gtm/accounts" active={active === null}>
          All
        </FilterLink>
        {SEGMENTS.map((s) => (
          <FilterLink key={s} href={`/gtm/accounts?segment=${s}`} active={active === s}>
            {SEGMENT_LABEL[s]}
          </FilterLink>
        ))}
      </nav>

      <Card className="py-2">
        <CardContent className="px-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">A year</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Touches</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell>
                      <Link href={`/gtm/accounts/${r.account.id}`} className="font-medium hover:underline">
                        {r.account.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {SEGMENT_LABEL[r.account.segment]}
                        {r.account.groupName ? ` · ${r.account.groupName}` : ""} · {r.account.city}, {r.account.state}
                        {r.account.designPartner && <span className="ml-1 rounded bg-ai-soft px-1 text-[10px] text-foreground">design partner</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{PLATFORM_LABEL[r.account.platform]}</TableCell>
                    <TableCell>
                      <StageBadge stage={r.account.stage} />
                    </TableCell>
                    <TableCell>
                      <ConsentBadge granted={r.account.dataConsent} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{r.scout?.score ?? <span className="text-muted-foreground">–</span>}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {r.scout ? (
                        <span className="flex items-center justify-end gap-1">
                          {usd(r.scout.totalAnnualUsd)}
                          <ConfidenceWord level={r.scout.confidence} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">not scored</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.account.tier ? <Badge variant="outline">{TIER_LABEL[r.account.tier]}</Badge> : r.scout ? <span className="text-muted-foreground">rec. {TIER_LABEL[r.scout.fit.recommendedTier]}</span> : null}</TableCell>
                    <TableCell className="text-xs">{r.account.ownerName ?? "unassigned"}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{r.touchesSent}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{r.pendingReviews || ""}</TableCell>
                    <TableCell className="text-right">
                      <RunAgentButton agent="opportunity_scout" input={{ accountId: r.account.id }} label={r.scout ? "Re-score" : "Score"} size="sm" variant="ghost" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("rounded-md border px-2.5 py-1 transition-colors hover:bg-accent", active ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "border-border")}>
      {children}
    </Link>
  );
}
