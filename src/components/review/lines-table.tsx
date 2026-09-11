"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateEstimateLines, type LineEdit } from "@/app/actions";
import { AiMark } from "@/components/ai-mark";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONFIDENCE_MEDIUM } from "@/lib/ai/build-estimate";
import { cn, formatMoney, round2 } from "@/lib/utils";

export interface LineView {
  id: string;
  kind: "operation" | "part" | "misc";
  parentLineId: string | null;
  description: string;
  qty: number;
  hours: number | null;
  standardHours: number | null;
  technicianHours: number | null;
  hoursFlag: string | null;
  rate: number | null;
  unitPrice: number | null;
  lineTotal: number;
  included: boolean;
  confidence: number | null;
  source: "ai" | "staff";
  rationale: string | null;
  sourceNote: string | null;
  stockWarning: string | null;
  needsManagerReview: boolean;
}

interface LocalLine extends LineView {
  dirty: boolean;
}

function recompute(line: LocalLine): number {
  if (line.kind === "operation") return round2((line.hours ?? 0) * (line.rate ?? 0));
  if (line.kind === "part") return round2(line.qty * (line.unitPrice ?? 0));
  return line.lineTotal;
}

export function computeTotalsClient(
  lines: LineView[],
  marina: { shopSuppliesPct: number; taxPct: number },
) {
  const inc = lines.filter((l) => l.included);
  const subtotalLabor = round2(inc.filter((l) => l.kind !== "part").reduce((s, l) => s + l.lineTotal, 0));
  const subtotalParts = round2(inc.filter((l) => l.kind === "part").reduce((s, l) => s + l.lineTotal, 0));
  const shopSupplies = round2(subtotalLabor * (marina.shopSuppliesPct / 100));
  const tax = round2((subtotalParts + shopSupplies) * (marina.taxPct / 100));
  const total = round2(subtotalLabor + subtotalParts + shopSupplies + tax);
  return { subtotalLabor, subtotalParts, shopSupplies, tax, total };
}

export function LinesTable({
  estimateId,
  lines: initial,
  marina,
  editable,
}: {
  estimateId: string;
  lines: LineView[];
  marina: { shopSuppliesPct: number; taxPct: number };
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<LocalLine[]>(() => initial.map((l) => ({ ...l, dirty: false })));

  const groups = useMemo(() => {
    const tops = lines.filter((l) => !l.parentLineId);
    return tops.map((top) => ({ top, parts: lines.filter((p) => p.parentLineId === top.id) }));
  }, [lines]);

  const totals = useMemo(() => computeTotalsClient(lines, marina), [lines, marina]);
  const dirty = lines.some((l) => l.dirty);

  function patch(id: string, changes: Partial<LineView>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const next = { ...l, ...changes, dirty: true };
          next.lineTotal = recompute(next);
          return next;
        }
        // part lines follow their operation line's inclusion
        if (changes.included !== undefined && l.parentLineId === id) {
          return { ...l, included: changes.included };
        }
        return l;
      }),
    );
  }

  function save() {
    const edits: LineEdit[] = lines
      .filter((l) => l.dirty)
      .map((l) => ({ lineId: l.id, hours: l.hours, qty: l.qty, included: l.included }));
    startTransition(async () => {
      try {
        await updateEstimateLines(estimateId, edits);
        setLines((prev) => prev.map((l) => ({ ...l, dirty: false, source: l.dirty ? "staff" : l.source })));
        toast.success("Changes saved. Edited lines are now staff-owned.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save changes");
      }
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="gap-3 py-4">
        <CardHeader className="flex flex-row items-center justify-between px-4">
          <CardTitle className="text-base">Lines</CardTitle>
          {editable && (
            <Button size="sm" disabled={!dirty || pending} onClick={save}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">Incl.</th>
                  <th className="min-w-[260px] px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Confidence</th>
                  <th className="px-3 py-2 text-right">Hours / Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(({ top, parts }) => (
                  <GroupRows
                    key={top.id}
                    top={top}
                    parts={parts}
                    editable={editable && !pending}
                    onPatch={patch}
                  />
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No lines on this estimate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit gap-3 py-4 xl:sticky xl:top-20">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Totals</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <dl className="space-y-1.5 text-sm">
            <Row label="Labour" value={totals.subtotalLabor} />
            <Row label="Parts" value={totals.subtotalParts} />
            <Row label={`Shop supplies (${marina.shopSuppliesPct}%)`} value={totals.shopSupplies} />
            <Row label={`Tax (${marina.taxPct}%)`} value={totals.tax} />
            <div className="my-2 border-t" />
            <Row label="Total" value={totals.total} strong />
          </dl>
          {dirty && (
            <p className="mt-3 text-xs text-warning-foreground">Unsaved changes. Totals above are a live preview.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", strong && "text-base font-semibold")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

function GroupRows({
  top,
  parts,
  editable,
  onPatch,
}: {
  top: LocalLine;
  parts: LocalLine[];
  editable: boolean;
  onPatch: (id: string, changes: Partial<LineView>) => void;
}) {
  return (
    <>
      <LineRow line={top} editable={editable} onPatch={onPatch} />
      {parts.map((p) => (
        <LineRow key={p.id} line={p} editable={editable && top.included} onPatch={onPatch} nested />
      ))}
    </>
  );
}

function LineRow({
  line,
  editable,
  onPatch,
  nested,
}: {
  line: LocalLine;
  editable: boolean;
  onPatch: (id: string, changes: Partial<LineView>) => void;
  nested?: boolean;
}) {
  const low = (line.confidence ?? 0) < CONFIDENCE_MEDIUM;
  const muted = !line.included || low;
  const [pn, ...rest] = line.kind === "part" ? line.description.split(" ") : [];
  const hoursDiffer =
    line.kind === "operation" && line.standardHours != null && line.hours != null && line.hours !== line.standardHours;

  return (
    <tr
      className={cn(
        "border-b align-top transition-colors last:border-0",
        nested ? "bg-muted/20" : "bg-card",
        muted && "text-muted-foreground",
        line.dirty && "bg-warning-soft/40",
      )}
    >
      <td className="px-3 py-2">
        <Checkbox
          checked={line.included}
          disabled={!editable}
          onCheckedChange={(v) => onPatch(line.id, { included: v === true })}
          aria-label="Include line"
        />
      </td>
      <td className={cn("px-3 py-2", nested && "pl-8")}>
        {line.kind === "part" ? (
          <div>
            <span className="font-mono text-xs">{pn}</span> <span>{rest.join(" ")}</span>
            {line.sourceNote && <div className="text-xs text-muted-foreground">{line.sourceNote}</div>}
          </div>
        ) : (
          <div>
            <div className={cn("font-medium", muted && "font-normal")}>{line.description}</div>
            {line.sourceNote && <div className="text-xs text-muted-foreground">{line.sourceNote}</div>}
            {line.hoursFlag && (
              <div className="mt-1 flex items-center gap-1 text-xs text-warning-foreground">
                <AlertTriangle className="size-3" /> {line.hoursFlag}
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        {line.kind !== "part" && <ConfidenceBadge value={line.confidence} reason={line.rationale} />}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {line.kind === "operation" && (
          <div className="flex flex-col items-end gap-0.5">
            <Input
              type="number"
              step={0.5}
              min={0}
              value={line.hours ?? 0}
              disabled={!editable}
              onChange={(e) => onPatch(line.id, { hours: Number(e.target.value) })}
              className="h-8 w-20 text-right"
              aria-label="Hours"
            />
            <span className="text-[11px] text-muted-foreground">
              {hoursDiffer ? `std ${line.standardHours} h` : "h"}
              {line.technicianHours != null && ` · tech ${line.technicianHours} h`}
            </span>
          </div>
        )}
        {line.kind === "part" && (
          <Input
            type="number"
            step={1}
            min={0}
            value={line.qty}
            disabled={!editable}
            onChange={(e) => onPatch(line.id, { qty: Number(e.target.value) })}
            className="ml-auto h-8 w-20 text-right"
            aria-label="Quantity"
          />
        )}
        {line.kind === "misc" && <span className="text-xs">n/a</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {line.kind === "operation" && line.rate != null && `${formatMoney(line.rate)}/h`}
        {line.kind === "part" && line.unitPrice != null && formatMoney(line.unitPrice)}
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(line.lineTotal)}</td>
      <td className="px-3 py-2">
        {line.source === "ai" ? (
          <Badge variant="outline" className="gap-1 border-ai/40 bg-ai-soft text-foreground">
            <AiMark className="p-0" />
            AI
          </Badge>
        ) : (
          <Badge variant="outline">Staff</Badge>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {line.stockWarning && (
            <Badge variant="outline" className="border-warning/50 bg-warning-soft text-warning-foreground">
              {line.stockWarning}
            </Badge>
          )}
          {line.needsManagerReview && (
            <Badge variant="outline" className="border-warning/50 bg-warning-soft text-warning-foreground">
              Needs manager review
            </Badge>
          )}
          {low && line.kind !== "part" && (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              Low confidence, unchecked
            </Badge>
          )}
        </div>
      </td>
    </tr>
  );
}
