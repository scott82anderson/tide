import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Inbox, Send, Sparkles, Target } from "lucide-react";
import { ConfidenceWord, ConsentBadge, StageBadge } from "@/components/gtm/badges";
import { RunAgentButton } from "@/components/gtm/run-agent-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/demo-date";
import { AGENTS } from "@/lib/gtm/agents/registry";
import { KIND_LABEL, SEGMENT_LABEL, usd } from "@/lib/gtm/labels";
import { rollupAccounts } from "@/lib/gtm/metrics";
import { getGtmClient } from "@/lib/gtm/prisma-client";

export const dynamic = "force-dynamic";

const PHASES = [
  { phase: "0 Design partners", window: "Now to Oct 2026", goal: "12 accounts on beta, golden sets from real notes", targets: "Vessel match 95%+, op recall 85%+, 3 case studies", state: "active" },
  { phase: "1 Base launch", window: "Oct 2026 to Mar 2027", goal: "Convert the base ahead of spring commissioning", targets: "120 paying locations, +40% Web migration lift, ValPay attach +15 pts", state: "next" },
  { phase: "2 New logos", window: "Apr to Sep 2027", goal: "Displace at service-heavy yards", targets: "60 new logos, 25% from the free tool", state: "later" },
  { phase: "3 Groups and partners", window: "Q4 2027", goal: "3 multi-site groups, 2 OEM deals", targets: "Group ARR 20%+ of Service Writer ARR", state: "later" },
  { phase: "4 Beyond ecosystem", window: "2028", goal: "Standalone on other DMS APIs", targets: "First 50 non-DockMaster shops", state: "later" },
];

export default async function GtmConsole() {
  const gtm = getGtmClient();
  const [counts, accounts, runs, queue, outbound] = await Promise.all([
    gtm.getCounts(),
    gtm.listAccounts(),
    gtm.listRuns({ limit: 500 }),
    gtm.listQueueItems(),
    gtm.listOutbound(),
  ]);
  const outboundBy = new Map<string, number>();
  for (const m of outbound) outboundBy.set(m.accountId, (outboundBy.get(m.accountId) ?? 0) + 1);
  const rollups = rollupAccounts(accounts, runs, queue, outboundBy)
    .filter((r) => r.scout)
    .sort((a, b) => b.scout!.score - a.scout!.score)
    .slice(0, 8);
  const pending = queue.filter((q) => q.status === "pending").slice(0, 6);
  const designPartners = accounts.filter((a) => a.designPartner).length;
  const runsByAgent = new Map<string, number>();
  for (const r of runs) runsByAgent.set(r.agent, (runsByAgent.get(r.agent) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Go-to-market console</h1>
          <p className="text-sm text-muted-foreground">
            Sell every marina its own money. Agents mine, model, draft and follow up; people own relationships, approvals and sends.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/try" target="_blank">
              <Sparkles className="size-4 text-ai" /> Free tool: /try
            </Link>
          </Button>
          <Button asChild>
            <Link href="/gtm/queue">
              <Inbox className="size-4" /> Review queue ({counts.pendingReviews})
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Target className="size-4" />} label="Accounts scored" value={counts.scored} hint={`of ${counts.accounts} in the CRM, ${counts.consented} with data consent`} href="/gtm/accounts" />
        <StatCard icon={<Send className="size-4" />} label="Sequences sent" value={counts.sequencesSent} hint={`${outbound.length} touches, every one clicked by a person`} href="/gtm/metrics" />
        <StatCard icon={<Sparkles className="size-4 text-ai" />} label="Sandbox sessions" value={counts.sandboxSessions} hint="Try-It runs on the free tool" href="/gtm/metrics" />
        <StatCard icon={<CheckCircle2 className="size-4 text-success" />} label="Calls, proposals, closed" value={counts.callsBooked} hint={`${counts.proposals} proposals, ${counts.closedWon} closed`} href="/gtm/accounts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className="space-y-6">
          <Card className="gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4" /> Ranked target list
              </CardTitle>
              <CardDescription>Opportunity Scout score and revenue left on the dock. Every dollar links back to the query that produced it.</CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">A year</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rollups.map((r) => (
                    <TableRow key={r.account.id}>
                      <TableCell>
                        <Link href={`/gtm/accounts/${r.account.id}`} className="font-medium hover:underline">
                          {r.account.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {SEGMENT_LABEL[r.account.segment]} · {r.account.city}, {r.account.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={r.account.stage} />
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.scout!.score}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{usd(r.scout!.totalAnnualUsd)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <ConfidenceWord level={r.scout!.confidence} />
                          {!r.account.dataConsent && <ConsentBadge granted={false} />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/gtm/accounts/${r.account.id}`}>
                            Open <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-3 pt-2 text-xs">
                <Link href="/gtm/accounts" className="text-primary underline-offset-2 hover:underline">
                  All {counts.accounts} accounts
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle>How a sale runs</CardTitle>
              <CardDescription>Install-base account, week by week. Each step is an agent whose output a named person approves.</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <ol className="grid gap-2 text-sm md:grid-cols-2">
                {[
                  ["Opportunity Scout", "scores the account from its own DockMaster data", "/gtm/accounts/acc_bayhaven"],
                  ["Account Researcher", "finds the new service manager and the slow-quote reviews", "/gtm/accounts/acc_bayhaven"],
                  ["Sequencer", "drafts three touches with the numbers; the CSM edits two lines and sends", "/gtm/queue"],
                  ["Try-It Concierge", "the prospect pastes a real note, sees a draft, books a call", "/try"],
                  ["Objection Coach", "surfaces the voice-to-text objection with the accuracy answer", "/gtm/desk"],
                  ["Deal Desk", "builds the proposal that night, within discount policy", "/gtm/accounts/acc_lakeshore"],
                  ["Onboarding Agent", "cleans the codes before day one", "/gtm/accounts/acc_pelican_point"],
                  ["Adoption Agent", "watches the edit rate fall and flags the Revenue Suite upsell", "/gtm/accounts/acc_northstar"],
                ].map(([agent, what, href], i) => (
                  <li key={agent} className="flex items-start gap-2 rounded-md border p-2">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{i + 1}</span>
                    <span>
                      <Link href={href} className="font-medium hover:underline">
                        {agent}
                      </Link>{" "}
                      <span className="text-muted-foreground">{what}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-4" /> Awaiting a human
              </CardTitle>
              <CardDescription>Latest drafts on the review queue.</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">Queue is clear.</p>
              ) : (
                <ul className="divide-y">
                  {pending.map((q) => (
                    <li key={q.id} className="py-2 text-sm">
                      <Link href={`/gtm/queue/${q.id}`} className="font-medium hover:underline">
                        {q.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {KIND_LABEL[q.kind]} · for the {q.approverRole} · {formatDate(q.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle>Phases</CardTitle>
              <CardDescription>Targets are assumptions to be sized against Valsoft data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-5 text-sm">
              {PHASES.map((p) => (
                <div key={p.phase} className={p.state === "active" ? "rounded-md border border-ai/40 bg-ai-soft p-2" : "rounded-md border p-2 text-muted-foreground"}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.phase}</span>
                    <span className="text-xs">{p.window}</span>
                    {p.state === "active" && (
                      <Badge variant="outline" className="ml-auto">
                        {designPartners}/12 partners
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs">{p.goal}</div>
                  <div className="text-[11px]">{p.targets}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle>Agent roster</CardTitle>
              <CardDescription>Fourteen workers, one shared memory: the CRM record.</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <ul className="space-y-1 text-sm">
                {AGENTS.map((a) => (
                  <li key={a.key} className="flex items-center gap-2">
                    <span>{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.owner}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{runsByAgent.get(a.key) ?? 0} runs</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <RunAgentButton agent="voice_of_customer" input={{}} label="Run Voice of Customer" goToQueue />
                <RunAgentButton agent="conference_concierge" input={{}} label="Plan the conference" goToQueue />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, hint, href }: { icon: React.ReactNode; label: string; value: number; hint: string; href: string }) {
  return (
    <Link href={href} className="block rounded-xl transition-shadow hover:shadow-md">
      <Card className="h-full gap-2 py-4">
        <CardHeader className="px-4">
          <CardDescription className="flex items-center gap-2">
            {icon}
            {label}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="text-3xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
