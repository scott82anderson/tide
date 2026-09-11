import Link from "next/link";
import { AiMark } from "@/components/ai-mark";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/demo-date";
import type { Actor } from "@/lib/dockmaster/types";
import { cn } from "@/lib/utils";

export interface ActivityFeedEntry {
  id: string;
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  /** ISO string so the component can be used from client components too. */
  createdAt: string;
  payload?: Record<string, unknown>;
}

const ACTOR_CLASS: Record<Actor, string> = {
  ai: "border-ai/40 bg-ai-soft text-foreground",
  staff: "border-primary/30 bg-primary text-primary-foreground",
  customer: "border-border bg-muted text-muted-foreground",
};

const ACTOR_LABEL: Record<Actor, string> = { ai: "Service Writer", staff: "Staff", customer: "Customer" };

/** "estimate.sent_for_esign" -> "Estimate sent for eSign" */
export function humaniseAction(action: string): string {
  const words = action
    .split(".")
    .flatMap((p) => p.split("_"))
    .filter(Boolean)
    .map((w) => (w === "esign" ? "eSign" : w === "ai" ? "AI" : w));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function summary(entry: ActivityFeedEntry): string | null {
  const p = entry.payload ?? {};
  if (typeof p.workOrderNumber === "string") return p.workOrderNumber;
  if (typeof p.technician === "string") return `${p.technician}`;
  if (typeof p.title === "string") return p.title;
  if (typeof p.channel === "string") return `via ${p.channel}`;
  if (typeof p.signedByName === "string") return `signed by ${p.signedByName}`;
  if (typeof p.tone === "string") return `${p.tone} tone`;
  if (typeof p.vessel === "string") return p.vessel;
  return null;
}

export function ActivityFeed({ entries, className }: { entries: ActivityFeedEntry[]; className?: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <ol className={cn("divide-y", className)}>
      {entries.map((e) => {
        const detail = summary(e);
        const isEstimate = e.entityType === "estimate";
        return (
          <li key={e.id} className="flex items-start gap-3 py-2.5 text-sm">
            <Badge variant="outline" className={cn("mt-0.5 shrink-0 gap-1", ACTOR_CLASS[e.actor])}>
              {e.actor === "ai" && <AiMark className="p-0 text-inherit" />}
              {ACTOR_LABEL[e.actor]}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{humaniseAction(e.action)}</span>
                {detail && <span className="truncate text-muted-foreground">{detail}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {isEstimate ? (
                  <Link href={`/jobs/${e.entityId}`} className="underline-offset-2 hover:underline">
                    estimate
                  </Link>
                ) : (
                  e.entityType.replace(/_/g, " ")
                )}
                <span aria-hidden> · </span>
                {formatDateTime(e.createdAt)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
