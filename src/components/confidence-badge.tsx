import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { confidenceLevel } from "@/lib/ai/build-estimate";
import { cn } from "@/lib/utils";

const STYLES = {
  high: "border-success/40 bg-success-soft text-foreground",
  medium: "border-warning/50 bg-warning-soft text-warning-foreground",
  low: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

export function ConfidenceBadge({
  value,
  reason,
  className,
}: {
  value: number | null | undefined;
  reason?: string | null;
  className?: string;
}) {
  const level = confidenceLevel(value);
  const badge = (
    <Badge variant="outline" className={cn("gap-1 font-medium capitalize", STYLES[level], className)}>
      {level}
      {value != null && <span className="font-normal opacity-70">{Math.round(value * 100)}%</span>}
    </Badge>
  );
  if (!reason) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs">{reason}</TooltipContent>
    </Tooltip>
  );
}
