/**
 * Schedule blocks for the demo week, Mon 2026-09-14 to Fri 2026-09-18.
 * Times are America/New_York (EDT, UTC-4) converted to UTC by local().
 * Marcus Reyes is deliberately free Tue 13:00-17:00 and Wed 08:00-12:00 so the
 * scheduling assistant has an obvious slot to suggest.
 */

import { local } from "./helpers";
import type { WorkOrderRow } from "./work-orders";

export interface ScheduleBlockRow {
  technicianId: string;
  workOrderId: string | null;
  label: string;
  start: Date;
  end: Date;
  source: string;
}

const MON = "2026-09-14";
const TUE = "2026-09-15";
const WED = "2026-09-16";
const THU = "2026-09-17";
const FRI = "2026-09-18";

type Slot = [day: string, startHour: number, endHour: number];

interface TechPlan { technicianId: string; blocks: { slot: Slot; vesselId?: string; label: string }[] }

const plans: TechPlan[] = [
  {
    technicianId: "tech_marcus_reyes",
    blocks: [
      { slot: [MON, 8, 12], vesselId: "ves_high_cotton", label: "Starboard alternator" },
      { slot: [MON, 13, 17], vesselId: "ves_high_cotton", label: "Starboard alternator, sea trial" },
      { slot: [TUE, 8, 12], label: "Shop: engine bay inspections, transient dock" },
      { slot: [WED, 13, 17], vesselId: "ves_persistence", label: "Trim tab pump" },
      { slot: [THU, 8, 12], label: "Yard: sea trial support" },
      { slot: [THU, 13, 17], label: "Shop: inboard diagnostics, walk-in" },
      { slot: [FRI, 8, 12], label: "Shop: parts run and bench work" },
    ],
  },
  {
    technicianId: "tech_tony_delgado",
    blocks: [
      { slot: [MON, 8, 12], vesselId: "ves_northern_light", label: "Triple Verado 100 hr service" },
      { slot: [MON, 13, 17], vesselId: "ves_northern_light", label: "Triple Verado 100 hr service" },
      { slot: [TUE, 8, 12], vesselId: "ves_nautilus", label: "Bellows and gimbal bearing" },
      { slot: [TUE, 13, 17], vesselId: "ves_nautilus", label: "Bellows and gimbal bearing" },
      { slot: [WED, 8, 12], label: "Shop: outboard diagnostics" },
      { slot: [THU, 13, 17], label: "Yard: haul-out prep" },
      { slot: [FRI, 8, 12], label: "Shop: warranty paperwork" },
    ],
  },
  {
    technicianId: "tech_priya_nair",
    blocks: [
      { slot: [MON, 8, 12], vesselId: "ves_fika", label: "Forward head rebuild" },
      { slot: [MON, 13, 17], label: "Shop: charger bench tests" },
      { slot: [TUE, 13, 17], vesselId: "ves_blue_heron", label: "Bilge float switch" },
      { slot: [WED, 8, 12], label: "Dock: shore power inspections" },
      { slot: [THU, 8, 12], label: "Shop: electrical, walk-in" },
      { slot: [THU, 13, 17], label: "Shop: electrical, walk-in" },
      { slot: [FRI, 13, 17], label: "Yard: winter storage wiring checks" },
    ],
  },
  {
    technicianId: "tech_cal_whitfield",
    blocks: [
      { slot: [MON, 8, 12], vesselId: "ves_kingfisher", label: "Gelcoat repair, port bow" },
      { slot: [MON, 13, 17], vesselId: "ves_kingfisher", label: "Gelcoat repair, port bow" },
      { slot: [TUE, 8, 12], label: "Yard: haul and block, transient" },
      { slot: [WED, 8, 12], label: "Yard: pressure wash" },
      { slot: [WED, 13, 17], label: "Yard: bottom paint prep" },
      { slot: [THU, 8, 12], label: "Yard: bottom paint" },
    ],
  },
  {
    technicianId: "tech_jo_lindqvist",
    blocks: [
      { slot: [MON, 13, 17], vesselId: "ves_c_est_la_vie", label: "Furler service" },
      { slot: [TUE, 8, 12], vesselId: "ves_c_est_la_vie", label: "Main halyard" },
      { slot: [TUE, 13, 17], label: "Rigging: mast climb inspections" },
      { slot: [WED, 8, 12], label: "Canvas: enclosure measure and fit" },
      { slot: [THU, 8, 12], label: "Canvas: bimini install" },
      { slot: [THU, 13, 17], label: "Rigging: shop splicing" },
      { slot: [FRI, 8, 12], label: "Rigging: transient dock" },
    ],
  },
];

export function buildScheduleBlocks(workOrders: WorkOrderRow[]): ScheduleBlockRow[] {
  const openByVessel = new Map(
    workOrders.filter((w) => w.status !== "closed").map((w) => [w.vesselId, w]),
  );
  const rows: ScheduleBlockRow[] = [];
  for (const plan of plans) {
    for (const b of plan.blocks) {
      const wo = b.vesselId ? openByVessel.get(b.vesselId) : undefined;
      rows.push({
        technicianId: plan.technicianId,
        workOrderId: wo?.id ?? null,
        label: wo ? `${wo.number}: ${b.label}` : b.label,
        start: local(b.slot[0], b.slot[1]),
        end: local(b.slot[0], b.slot[2]),
        source: "staff",
      });
    }
  }
  return rows;
}
