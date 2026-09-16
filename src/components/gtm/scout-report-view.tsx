import { Database, Globe, Radio } from "lucide-react";
import { ConfidenceWord } from "@/components/gtm/badges";
import { FiguresTable } from "@/components/gtm/figures-table";
import { Badge } from "@/components/ui/badge";
import type { ScoutReport } from "@/lib/gtm/agents/opportunity-scout";
import { TIER_LABEL, usd } from "@/lib/gtm/labels";
import { cn } from "@/lib/utils";

const SOURCE: Record<ScoutReport["dataSource"], { label: string; icon: typeof Database }> = {
  dockmaster_api_live: { label: "Live through the DockMaster API", icon: Radio },
  warehouse_extract: { label: "Warehouse extract, trailing 12 months", icon: Database },
  public_signals: { label: "Public signals only", icon: Globe },
};

export function ScoutReportView({ report, showFigures = true }: { report: ScoutReport; showFigures?: boolean }) {
  const src = SOURCE[report.dataSource];
  const Icon = src.icon;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-3xl font-semibold tabular-nums">{usd(report.totalAnnualUsd)}</span>
        <span className="text-muted-foreground">a year left on the dock</span>
        <ConfidenceWord level={report.confidence} />
        <Badge variant="outline" className="gap-1 font-normal">
          <Icon className="size-3" /> {src.label}
        </Badge>
        <Badge variant="outline" className="font-normal">
          score {report.score}/100
        </Badge>
      </div>
      <blockquote className="rounded-md border border-ai/30 bg-ai-soft/60 px-4 py-3 leading-relaxed">{report.pitchSentence}</blockquote>
      <p className="text-xs text-muted-foreground">{report.confidenceReason}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {report.opportunities.map((o) => (
          <div key={o.key} className="rounded-md border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{o.label}</span>
              <span className={cn("font-mono tabular-nums", o.annualUsd === 0 && "text-muted-foreground")}>{usd(o.annualUsd)}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">{o.formula}</div>
            <div className="mt-1 text-[11px] text-warning-foreground">{o.assumption}</div>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Fit</span>
          <Badge variant="outline">{TIER_LABEL[report.fit.recommendedTier]}</Badge>
          {report.fit.migrationNeeded && (
            <Badge variant="outline" className="border-warning/50 bg-warning-soft text-warning-foreground">
              Web + Mobile migration needed
            </Badge>
          )}
        </div>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {report.fit.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {showFigures && (
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-2 font-medium">Every figure and the query behind it ({report.figures.length})</summary>
          <div className="border-t p-2">
            <FiguresTable figures={report.figures} />
          </div>
        </details>
      )}
    </div>
  );
}
