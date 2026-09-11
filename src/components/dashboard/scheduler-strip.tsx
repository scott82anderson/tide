"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { acceptSuggestedSlot, rejectSuggestedSlot } from "@/app/actions";
import { AiMark } from "@/components/ai-mark";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DAY_MS, formatDateTime } from "@/lib/demo-date";
import { cn } from "@/lib/utils";

export interface SchedulerTechnician {
  id: string;
  name: string;
  skills: string[];
}

export interface SchedulerBlock {
  id: string;
  technicianId: string;
  label: string;
  /** ISO strings, UTC. */
  start: string;
  end: string;
  source: "staff" | "ai_suggested";
  workOrderNumber: string | null;
}

export interface SchedulerStripProps {
  /** Monday 00:00 UTC of the week to show, ISO string. */
  weekStart: string;
  technicians: SchedulerTechnician[];
  blocks: SchedulerBlock[];
}

/** The yard is in Stuart, FL: EDT in September, UTC-4. */
const TZ_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 18;
const DAY_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function place(block: SchedulerBlock, weekStartMs: number) {
  const startLocal = new Date(block.start).getTime() - TZ_OFFSET_MS;
  const endLocal = new Date(block.end).getTime() - TZ_OFFSET_MS;
  const day = Math.floor((startLocal - weekStartMs) / DAY_MS);
  const dayStart = weekStartMs + day * DAY_MS;
  const fromHour = (startLocal - dayStart) / 3_600_000;
  const toHour = (endLocal - dayStart) / 3_600_000;
  const left = Math.max(0, (fromHour - DAY_START_HOUR) / DAY_HOURS) * 100;
  const right = Math.min(1, (toHour - DAY_START_HOUR) / DAY_HOURS) * 100;
  return { day, left, width: Math.max(right - left, 4) };
}

export function SchedulerStrip({ weekStart, technicians, blocks }: SchedulerStripProps) {
  const weekStartMs = new Date(weekStart).getTime();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<void>, message: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(message);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update the schedule.");
      }
    });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[140px_repeat(5,1fr)] border-b text-xs text-muted-foreground">
          <div className="px-2 py-1.5">Technician</div>
          {DAYS.map((d, i) => {
            const date = new Date(weekStartMs + i * DAY_MS);
            return (
              <div key={d} className="border-l px-2 py-1.5">
                {d} {date.getUTCMonth() + 1}/{date.getUTCDate()}
              </div>
            );
          })}
        </div>
        {technicians.map((t) => {
          const mine = blocks.filter((b) => b.technicianId === t.id);
          return (
            <div key={t.id} className="grid grid-cols-[140px_repeat(5,1fr)] border-b last:border-b-0">
              <div className="px-2 py-2">
                <div className="truncate text-sm font-medium">{t.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{t.skills.join(", ")}</div>
              </div>
              {DAYS.map((_, dayIdx) => (
                <div key={dayIdx} className="relative h-14 border-l bg-[repeating-linear-gradient(90deg,transparent,transparent_calc(100%/11-1px),var(--border)_calc(100%/11-1px),var(--border)_calc(100%/11))]">
                  {mine
                    .map((b) => ({ b, p: place(b, weekStartMs) }))
                    .filter(({ p }) => p.day === dayIdx)
                    .map(({ b, p }) => (
                      <Block key={b.id} block={b} left={p.left} width={p.width} pending={pending} act={act} />
                    ))}
                </div>
              ))}
            </div>
          );
        })}
        <div className="px-2 pt-1.5 text-[11px] text-muted-foreground">
          Columns run {DAY_START_HOUR}:00 to {DAY_END_HOUR}:00 local. Teal blocks are AI Scheduling Assistant suggestions, accept or reject them.
        </div>
      </div>
    </div>
  );
}

function Block({
  block,
  left,
  width,
  pending,
  act,
}: {
  block: SchedulerBlock;
  left: number;
  width: number;
  pending: boolean;
  act: (fn: () => Promise<void>, message: string) => void;
}) {
  const suggested = block.source === "ai_suggested";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute top-1.5 bottom-1.5 flex items-center gap-1 overflow-hidden rounded-md border px-1.5 text-[11px] leading-tight",
            suggested
              ? "border-ai bg-ai-soft text-foreground"
              : "border-primary/20 bg-primary/85 text-primary-foreground",
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
        >
          {suggested && <AiMark className="shrink-0 p-0" />}
          <span className="truncate font-medium">{block.label}</span>
          {suggested && (
            <span className="ml-auto flex shrink-0 gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="size-5 text-success hover:bg-success-soft"
                disabled={pending}
                aria-label="Accept suggested slot"
                onClick={() => act(() => acceptSuggestedSlot(block.id), "Slot accepted and booked.")}
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-5 text-destructive hover:bg-destructive/10"
                disabled={pending}
                aria-label="Reject suggested slot"
                onClick={() => act(() => rejectSuggestedSlot(block.id), "Suggestion rejected. Work order stays unscheduled.")}
              >
                <X className="size-3.5" />
              </Button>
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="font-medium">{block.label}</div>
        <div>
          {formatDateTime(block.start)} to {formatDateTime(block.end)}
        </div>
        {suggested && <div className="text-ai-foreground/80">Suggested by the AI Scheduling Assistant</div>}
      </TooltipContent>
    </Tooltip>
  );
}
