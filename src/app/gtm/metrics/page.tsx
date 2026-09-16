import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/demo-date";
import { usd } from "@/lib/gtm/labels";
import { computeWeeklyMetrics, type Metric } from "@/lib/gtm/metrics";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmt(m: Metric): string {
  switch (m.unit) {
    case "usd":
      return usd(m.value);
    case "pct":
      return `${m.value}%`;
    case "days":
      return `${m.value} d`;
    case "months":
      return `${m.value} mo`;
    case "seconds":
      return `${m.value} s`;
    default:
      return m.value.toLocaleString("en-US");
  }
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.key} className="rounded-md border p-3">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            {m.label}
            {m.assumption && (
              <Badge variant="outline" className="ml-auto text-[10px] font-normal">
                assumption
              </Badge>
            )}
          </div>
          <div className="text-2xl font-semibold tabular-nums">{fmt(m)}</div>
          <div className="text-[11px] text-muted-foreground">
            {m.hint}
            {m.target != null ? ` · target ${m.target}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function MetricsPage() {
  const m = await computeWeeklyMetrics(getGtmClient());
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 className="size-5" /> Weekly metrics
        </h1>
        <p className="text-sm text-muted-foreground">What the agents report every week, computed from the CRM record and telemetry as of {formatDate(m.asOf)}.</p>
      </div>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Funnel</CardTitle>
          <CardDescription>Accounts scored, sequences approved and sent, sandbox sessions, calls booked, proposals, closed.</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <MetricGrid metrics={m.funnel} />
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Agent quality</CardTitle>
          <CardDescription>Human edit rate on drafts by agent. An agent whose edit rate stops falling gets retired or retrained.</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Blocked / failed</TableHead>
                <TableHead className="text-right">Reviewed</TableHead>
                <TableHead className="text-right">Approved / edited / rejected</TableHead>
                <TableHead className="text-right">Edit rate</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.agentQuality.map((a) => (
                <TableRow key={a.agent} className={cn(a.runs === 0 && "text-muted-foreground")}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-xs">{a.modelTier}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{a.runs}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {a.blocked} / {a.failed}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{a.reviewed}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {a.approved} / {a.edited} / {a.rejected}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{a.edited ? `${Math.round(a.editRate * 100)}%` : "–"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{a.runs ? `${(a.meanLatencyMs / 1000).toFixed(1)} s` : "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Product value</CardTitle>
          <CardDescription>Draft-to-approval time, estimate approval rate, billed versus standard hours, unbilled work recovered, DSO.</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <MetricGrid metrics={m.productValue} />
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Business</CardTitle>
          <CardDescription>Service Writer ARR, attach rate to Web, ValPay uplift, NRR, CAC payback (target under 9 months).</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <MetricGrid metrics={m.business} />
        </CardContent>
      </Card>
    </div>
  );
}
