import { Badge } from "@/components/ui/badge";
import type { EstimateStatus } from "@/lib/dockmaster/types";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/estimate-status";
import { cn } from "@/lib/utils";

export type Tone = "ai" | "neutral" | "warning" | "success" | "destructive";

export const TONE_CLASS: Record<Tone, string> = {
  ai: "border-ai/40 bg-ai-soft text-foreground",
  neutral: "border-border bg-muted text-foreground",
  warning: "border-warning/50 bg-warning-soft text-warning-foreground",
  success: "border-success/40 bg-success-soft text-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: EstimateStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[STATUS_TONE[status]], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
