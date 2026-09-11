import Link from "next/link";
import { AiMark } from "@/components/ai-mark";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/demo-date";
import type { Estimate } from "@/lib/dockmaster/types";
import { formatMoney } from "@/lib/utils";

const ORIGIN_LABEL: Record<Estimate["origin"], string> = {
  tech_note: "Tech note",
  outreach: "Outreach",
  manual: "Manual",
};

export function EstimatesTable({
  estimates,
  showOrigin = false,
  emptyText,
}: {
  estimates: Estimate[];
  showOrigin?: boolean;
  emptyText: React.ReactNode;
}) {
  if (estimates.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Estimate</TableHead>
          <TableHead>Vessel</TableHead>
          <TableHead>Title</TableHead>
          {showOrigin && <TableHead>Origin</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Vessel match</TableHead>
          <TableHead>Created</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {estimates.map((e) => {
          const aiOwned = e.lines.some((l) => l.source === "ai");
          return (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">
                <span className="flex items-center gap-1">
                  {e.number}
                  {aiOwned && <AiMark />}
                </span>
              </TableCell>
              <TableCell>
                <div className="font-medium">{e.vessel.name}</div>
                <div className="text-xs text-muted-foreground">
                  {e.vessel.year} {e.vessel.make} {e.vessel.model}
                </div>
              </TableCell>
              <TableCell className="max-w-[260px] truncate">{e.title}</TableCell>
              {showOrigin && <TableCell className="text-xs">{ORIGIN_LABEL[e.origin]}</TableCell>}
              <TableCell>
                <StatusBadge status={e.status} />
                {e.workOrderNumber && (
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{e.workOrderNumber}</div>
                )}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(e.totals.total)}</TableCell>
              <TableCell>
                <ConfidenceBadge value={e.vesselMatchConfidence} reason={e.vesselMatchReasons.join("; ")} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/jobs/${e.id}`}>Review</Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
