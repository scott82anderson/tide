import { Badge } from "@/components/ui/badge";
import { QUEUE_STATUS_LABEL, SEGMENT_LABEL, STAGE_LABEL, STAGE_TONE, TONE_CLASS } from "@/lib/gtm/labels";
import type { QueueStatus, Segment, Stage } from "@/lib/gtm/types";
import { cn } from "@/lib/utils";

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[STAGE_TONE[stage]], className)}>
      {STAGE_LABEL[stage]}
    </Badge>
  );
}

export function SegmentBadge({ segment }: { segment: Segment }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {SEGMENT_LABEL[segment]}
    </Badge>
  );
}

const STATUS_TONE: Record<QueueStatus, keyof typeof TONE_CLASS> = {
  pending: "ai",
  approved: "success",
  edited: "success",
  rejected: "destructive",
};

export function QueueStatusBadge({ status }: { status: QueueStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[STATUS_TONE[status]])}>
      {QUEUE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ConfidenceWord({ level }: { level: "high" | "medium" | "low" }) {
  const tone = level === "high" ? "success" : level === "medium" ? "warning" : "destructive";
  return (
    <Badge variant="outline" className={cn("capitalize", TONE_CLASS[tone])}>
      {level} confidence
    </Badge>
  );
}

export function ConsentBadge({ granted }: { granted: boolean }) {
  return (
    <Badge variant="outline" className={cn(granted ? TONE_CLASS.success : TONE_CLASS.warning)}>
      {granted ? "Consent on file" : "No data consent"}
    </Badge>
  );
}
