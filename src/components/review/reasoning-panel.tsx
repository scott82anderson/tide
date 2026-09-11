"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ReasoningTrace } from "@/lib/dockmaster/types";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<string, string> = {
  extract_findings: "Read the note",
  match_vessel: "Match vessel",
  match_operations: "Match operation codes",
  build_estimate: "Price from catalogue",
  write_narrative: "Write owner wording",
  due_for_service: "Due for service check",
};

interface FindingLite {
  system?: string;
  symptom?: string;
  observation?: string;
  severity?: string;
  technicianRecommendation?: string;
  estimatedHours?: number | null;
  engine?: string;
  quoteSeparately?: boolean;
}

export function ReasoningPanel({ trace }: { trace: ReasoningTrace }) {
  const [open, setOpen] = useState(false);
  const extract = trace.steps.find((s) => s.step === "extract_findings");
  const findings: FindingLite[] =
    extract && typeof extract.output === "object" && extract.output !== null
      ? ((extract.output as { findings?: FindingLite[] }).findings ?? [])
      : [];
  const hints =
    extract && typeof extract.output === "object" && extract.output !== null
      ? (extract.output as { vesselHints?: Record<string, string | null> }).vesselHints
      : undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between text-left">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-ai" />
                AI reasoning
                <span className="text-xs font-normal text-muted-foreground">
                  {trace.steps.length} steps, {trace.steps.reduce((s, x) => s + x.latencyMs, 0)} ms
                </span>
              </CardTitle>
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-5 px-4">
            {findings.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-medium">What was extracted</h4>
                {hints && (
                  <div className="flex flex-wrap gap-1 text-xs">
                    {Object.entries(hints)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <Badge key={k} variant="outline">
                          {k}: {v}
                        </Badge>
                      ))}
                  </div>
                )}
                <ol className="space-y-1.5 text-sm">
                  {findings.map((f, i) => (
                    <li key={i} className="rounded-md border bg-muted/30 p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="capitalize">
                          {f.system}
                        </Badge>
                        {f.severity && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize",
                              f.severity === "high" && "border-destructive/40 text-destructive",
                              f.severity === "medium" && "border-warning/50 text-warning-foreground",
                            )}
                          >
                            {f.severity}
                          </Badge>
                        )}
                        {f.engine && f.engine !== "unspecified" && f.engine !== "single" && (
                          <Badge variant="outline" className="capitalize">
                            {f.engine} engine
                          </Badge>
                        )}
                        {f.quoteSeparately && (
                          <Badge variant="outline" className="border-ai/40 bg-ai-soft">
                            quote separately
                          </Badge>
                        )}
                        {f.estimatedHours != null && (
                          <span className="text-xs text-muted-foreground">tech est. {f.estimatedHours} h</span>
                        )}
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">{f.technicianRecommendation}</span>
                        <span className="text-muted-foreground"> because {f.observation ?? f.symptom}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {trace.notes.length > 0 && (
              <section className="space-y-1">
                <h4 className="text-sm font-medium">Notes</h4>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-warning-foreground">
                  {trace.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-3">
              <h4 className="text-sm font-medium">Step by step</h4>
              {trace.steps.map((s, i) => (
                <details key={i} className="rounded-md border">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">{STEP_LABEL[s.step] ?? s.step}</span>
                    {s.model && <Badge variant="outline">{s.model}</Badge>}
                    <span className="text-xs text-muted-foreground">{s.latencyMs} ms</span>
                  </summary>
                  <div className="grid gap-2 border-t p-3 md:grid-cols-2">
                    <JsonBlock label="Input" value={s.input} />
                    <JsonBlock label="Output" value={s.output} />
                  </div>
                </details>
              ))}
            </section>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-[11px] leading-snug">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
