import { describe, expect, it } from "vitest";
import { suggestSlot } from "./suggest-slot";
import { marcus } from "@/test/fake-client";
import type { ScheduleBlock, Technician, WorkOrderSummary } from "@/lib/dockmaster/types";

const wo: WorkOrderSummary = {
  id: "WO-2026-0001",
  number: "WO-2026-0001",
  vesselId: "ves_reel_therapy",
  status: "open",
  description: "Cooling service",
  openedAt: new Date("2026-09-14T13:00:00Z"),
  closedAt: null,
  technicianName: null,
  hoursBilled: 0,
  total: 0,
  operations: [
    { code: "ENG-IMP-01", description: "", category: "engine", hours: 1, maintenanceIntervalMonths: 24 },
    { code: "ENG-RWP-01", description: "", category: "engine", hours: 3.5, maintenanceIntervalMonths: null },
  ],
  parts: [],
};

const rigger: Technician = { ...marcus, id: "tech_rigger", name: "R", skills: ["rigging"] };

describe("suggestSlot", () => {
  it("picks the first open block for an engine-skilled technician after now", () => {
    // Marcus booked Mon all day and Tue morning (EDT = UTC-4).
    const blocks: ScheduleBlock[] = [
      block("2026-09-14T12:00:00Z", "2026-09-14T21:00:00Z"),
      block("2026-09-15T12:00:00Z", "2026-09-15T16:00:00Z"),
    ];
    const s = suggestSlot(wo, [marcus, rigger], blocks);
    expect(s?.technician.id).toBe("tech_marcus_reyes");
    expect(s?.hours).toBe(5);
    // Tue 12:00 local (16:00Z) is the first opening of at least 4 h; extends to end of day 17:00 local.
    expect(s?.start.toISOString()).toBe("2026-09-15T16:00:00.000Z");
    expect(s?.end.toISOString()).toBe("2026-09-15T21:00:00.000Z");
  });

  it("keeps the job with the diagnosing technician when they have a slot this week", () => {
    const tony: Technician = { ...marcus, id: "tech_tony", name: "Tony", skills: ["engine"] };
    // Tony is free all week; Marcus is booked Mon and Tue morning.
    const blocks: ScheduleBlock[] = [
      block("2026-09-14T12:00:00Z", "2026-09-14T21:00:00Z"),
      block("2026-09-15T12:00:00Z", "2026-09-15T16:00:00Z"),
    ];
    expect(suggestSlot(wo, [tony, marcus], blocks)?.technician.id).toBe("tech_tony");
    const kept = suggestSlot(wo, [tony, marcus], blocks, undefined, "tech_marcus_reyes");
    expect(kept?.technician.id).toBe("tech_marcus_reyes");
    expect(kept?.reason).toMatch(/diagnosed the job/);
  });

  it("returns null when no technician has the skills", () => {
    expect(suggestSlot(wo, [rigger], [])).toBeNull();
  });
});

function block(start: string, end: string): ScheduleBlock {
  return {
    id: start,
    technicianId: "tech_marcus_reyes",
    technicianName: "Marcus Reyes",
    workOrderId: null,
    workOrderNumber: null,
    label: "booked",
    start: new Date(start),
    end: new Date(end),
    source: "staff",
  };
}
