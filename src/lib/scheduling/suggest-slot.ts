/**
 * Simulated AI Scheduling Assistant hand-off. DockMaster already has one; this
 * feature only asks it for a suggestion. Here we approximate its answer: the
 * next open block, in the demo week, for a technician whose skills cover the
 * work order's operation categories. Staff accept or reject.
 */

import { DEMO_TODAY, addDays, demoWeekStart } from "@/lib/demo-date";
import type { ScheduleBlock, Technician, WorkOrderSummary } from "@/lib/dockmaster/types";

export interface SlotSuggestion {
  technician: Technician;
  start: Date;
  end: Date;
  hours: number;
  reason: string;
}

const CATEGORY_SKILL: Record<string, string> = {
  engine: "engine",
  drive: "engine",
  winterisation: "engine",
  commissioning: "engine",
  electrical: "electrical",
  plumbing: "plumbing",
  hull: "fiberglass",
  detailing: "detailing",
  canvas: "canvas",
  rigging: "rigging",
  haul: "haul",
  hydraulics: "hydraulics",
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** Demo yard is in Stuart, FL: EDT in September, UTC-4. */
const TZ_OFFSET_HOURS = 4;

function requiredSkills(wo: WorkOrderSummary): string[] {
  const skills = new Set<string>();
  for (const op of wo.operations) {
    const s = CATEGORY_SKILL[op.category];
    if (s) skills.add(s);
  }
  return Array.from(skills);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function suggestSlot(
  workOrder: WorkOrderSummary,
  technicians: Technician[],
  blocks: ScheduleBlock[],
  now: Date = DEMO_TODAY,
  /** Continuity: the technician who diagnosed the job gets it if they have a slot this week. */
  preferredTechnicianId: string | null = null,
): SlotSuggestion | null {
  const needed = requiredSkills(workOrder);
  const hours = Math.max(1, Math.ceil(workOrder.operations.reduce((s, o) => s + o.hours, 0)));
  const skilled = technicians.filter(
    (t) => t.role !== "service_manager" && needed.every((s) => t.skills.includes(s)),
  );
  if (skilled.length === 0) return null;

  const preferred = skilled.find((t) => t.id === preferredTechnicianId);
  if (preferred) {
    const own = findSlot(workOrder, [preferred], blocks, now, hours, needed);
    if (own) return { ...own, reason: `${own.reason}; kept with ${preferred.name}, who diagnosed the job` };
  }
  return findSlot(workOrder, skilled, blocks, now, hours, needed);
}

function findSlot(
  workOrder: WorkOrderSummary,
  candidates: Technician[],
  blocks: ScheduleBlock[],
  now: Date,
  hours: number,
  needed: string[],
): SlotSuggestion | null {

  // A job longer than a half day still needs a start slot. Look for a
  // contiguous opening of at least MIN_BLOCK hours (spanning the lunch break),
  // then extend the block to the job length or the end of the day.
  const MIN_BLOCK = 4;
  const need = Math.min(hours, MIN_BLOCK);
  const weekStart = demoWeekStart();
  let best: SlotSuggestion | null = null;

  for (const tech of candidates) {
    const techBlocks = blocks.filter((b) => b.technicianId === tech.id);
    for (let d = 0; d < 10; d++) {
      const day = addDays(weekStart, d);
      const windows = tech.availability[WEEKDAYS[day.getUTCDay()]] ?? [];
      if (windows.length === 0) continue;
      const fromH = Math.min(...windows.map((w) => w[0]));
      const toH = Math.max(...windows.map((w) => w[1]));
      for (let h = fromH; h + need <= toH; h++) {
        const start = new Date(day);
        start.setUTCHours(h + TZ_OFFSET_HOURS, 0, 0, 0);
        const probeEnd = new Date(start.getTime() + need * 3600 * 1000);
        if (start < now) continue;
        if (techBlocks.some((b) => overlaps(start, probeEnd, b.start, b.end))) continue;

        // Extend to the job length, capped by the day and the next booking.
        const dayEnd = new Date(day);
        dayEnd.setUTCHours(toH + TZ_OFFSET_HOURS, 0, 0, 0);
        let end = new Date(Math.min(start.getTime() + hours * 3600 * 1000, dayEnd.getTime()));
        for (const b of techBlocks) {
          if (b.start >= probeEnd && b.start < end) end = b.start;
        }
        if (!best || start < best.start) {
          best = {
            technician: tech,
            start,
            end,
            hours,
            reason: `Next open block for a technician with ${needed.join(", ") || "general"} skills (${hours} h job)`,
          };
        }
        break;
      }
    }
  }
  return best;
}
