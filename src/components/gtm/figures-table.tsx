import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SourceQuery } from "@/lib/gtm/types";
import { usd } from "@/lib/gtm/labels";

export function formatFigure(f: SourceQuery): string {
  switch (f.unit) {
    case "usd":
      return usd(f.value);
    case "pct":
      return `${f.value}%`;
    case "hours":
      return `${f.value.toLocaleString("en-US")} h`;
    case "days":
      return `${f.value} days`;
    default:
      return f.value.toLocaleString("en-US");
  }
}

/** Truth in numbers: every figure with the query that produced it. */
export function FiguresTable({ figures, compact = false }: { figures: SourceQuery[]; compact?: boolean }) {
  if (figures.length === 0) return <p className="text-sm text-muted-foreground">No figures.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Figure</TableHead>
            <TableHead className="text-right">Value</TableHead>
            {!compact && <TableHead>Query that produced it</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {figures.map((f) => (
            <TableRow key={f.key}>
              <TableCell className="align-top">
                <div>{f.label}</div>
                {f.assumption && <div className="text-[11px] text-warning-foreground">{f.assumption}</div>}
              </TableCell>
              <TableCell className="text-right align-top font-mono text-xs tabular-nums">{formatFigure(f)}</TableCell>
              {!compact && <TableCell className="max-w-[420px] align-top font-mono text-[11px] leading-snug text-muted-foreground">{f.query}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
