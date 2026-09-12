import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import rawResults from "@/lib/eval/eval-results.json";
import type { EvalResults } from "@/lib/eval/run";
import { formatDateTime } from "@/lib/demo-date";
import { cn } from "@/lib/utils";

const data = rawResults as EvalResults;

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

function CodeChip({ code, tone }: { code: string; tone: "ok" | "missing" | "extra" }) {
  const cls = {
    ok: "border-success/40 bg-success-soft",
    missing: "border-destructive/40 bg-destructive/10 text-destructive line-through",
    extra: "border-warning/50 bg-warning-soft text-warning-foreground",
  }[tone];
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px]", cls)}>
      {code}
    </Badge>
  );
}

export default function EvalPage() {
  const { summary, results } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FlaskConical className="size-5" />
          Golden set evaluation
        </h1>
        <p className="text-sm text-muted-foreground">
          15 technician notes run through extraction, vessel match, operation match and pricing. Targets: vessel
          match at least 14 of 15, operation recall at least 0.85.
          {data.generatedAt ? ` Last run ${formatDateTime(data.generatedAt)} on ${data.model}.` : ""}
        </p>
      </div>

      {!summary ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No results yet. Run <code className="rounded bg-muted px-1 py-0.5">pnpm eval</code> with an
            ANTHROPIC_API_KEY, then reload this page.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Vessel match"
              value={`${summary.vesselCorrect}/${summary.cases}`}
              hint={`target ${summary.targets.vesselCorrect}/${summary.cases}`}
              ok={summary.vesselCorrect >= summary.targets.vesselCorrect}
            />
            <Stat
              label="Operation recall"
              value={summary.operationRecall.toFixed(2)}
              hint={`target ${summary.targets.operationRecall.toFixed(2)}`}
              ok={summary.operationRecall >= summary.targets.operationRecall}
            />
            <Stat label="Operation precision" value={summary.operationPrecision.toFixed(2)} hint="mean per case" />
            <Stat label="Separate estimate" value={pct(summary.separateAccuracy)} hint="quote-separately detection" />
            <Stat label="Mean latency" value={`${(summary.meanLatencyMs / 1000).toFixed(1)} s`} hint="steps 2 to 5, no narrative" />
          </div>

          <Card className="gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle>
                Cases: {summary.passed}/{summary.cases} passed
              </CardTitle>
              <CardDescription>
                A case passes when the vessel is right, every expected code is found (recall 1.0), precision is at least
                0.75 and the separate-quote flag matches.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Case</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Expected codes</TableHead>
                      <TableHead>Actual codes</TableHead>
                      <TableHead className="text-right">P / R</TableHead>
                      <TableHead>Separate</TableHead>
                      <TableHead className="text-right">Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.id} className={cn(!r.pass && "bg-destructive/5")}>
                        <TableCell>
                          {r.pass ? (
                            <CheckCircle2 className="size-4 text-success" aria-label="pass" />
                          ) : (
                            <XCircle className="size-4 text-destructive" aria-label="fail" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <div className="font-medium">{r.id}</div>
                                <div className="text-xs text-muted-foreground">{r.kind}</div>
                                {r.error && <div className="text-xs text-destructive">{r.error}</div>}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md text-xs">{r.transcript}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className={cn("text-sm", r.vesselCorrect ? "" : "text-destructive")}>
                            {r.actualVesselName ?? "none"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            expected {r.expectedVesselId ?? "none"}, {Math.round(r.vesselConfidence * 100)}% via {r.vesselMethod}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {r.expectedCodes.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                            {r.expectedCodes.map((c) => (
                              <CodeChip key={c} code={c} tone={r.missingCodes.includes(c) ? "missing" : "ok"} />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {r.actualCodes.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                            {r.actualCodes.map((c) => (
                              <CodeChip key={c} code={c} tone={r.extraCodes.includes(c) ? "extra" : "ok"} />
                            ))}
                          </div>
                          {r.unmapped > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">{r.unmapped} unmapped</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r.precision.toFixed(2)} / {r.recall.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.actualSeparate ? "yes" : "no"}
                          {!r.separateCorrect && <span className="text-destructive"> (expected {r.expectedSeparate ? "yes" : "no"})</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{(r.latencyMs / 1000).toFixed(1)} s</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, ok }: { label: string; value: string; hint: string; ok?: boolean }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-2xl", ok === false && "text-destructive", ok === true && "text-success")}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}
