/**
 * Work order history. Explicit records drive the demo (Reel Therapy's impeller
 * job, the overdue-for-service vessels, the overdue invoices); a deterministic
 * generator fills in the rest of a plausible 2022-2026 history.
 *
 * Interval-bearing operation codes are never assigned by the random generator,
 * so the "due for service" picture is fully controlled by the explicit and
 * recent-maintenance sections below.
 */

import { d, rng, round2 } from "./helpers";
import { marina } from "./technicians";
import { operationCodes, intervalCodes, type OpCodeSeed } from "./operation-codes";
import { parts } from "./parts";
import { vessels, type VesselSeed } from "./customers-vessels";

export interface WorkOrderRow {
  id: string;
  number: string;
  vesselId: string;
  technicianId: string | null;
  status: string;
  description: string;
  openedAt: Date;
  closedAt: Date | null;
  hoursStandard: number;
  hoursBilled: number;
  total: number;
}
export interface WorkOrderOpRow { workOrderId: string; operationCodeId: string; hours: number }
export interface WorkOrderPartRow { workOrderId: string; partId: string; qty: number }

const opByCode = new Map(operationCodes.map((o) => [o.code, o]));
const partByNumber = new Map(parts.map((p) => [p.partNumber, p]));
const vesselById = new Map(vessels.map((v) => [v.id, v]));

const techs = ["tech_marcus_reyes", "tech_tony_delgado", "tech_priya_nair", "tech_cal_whitfield", "tech_jo_lindqvist"];
const techForCategory: Record<string, string[]> = {
  engine: ["tech_marcus_reyes", "tech_tony_delgado", "tech_jo_lindqvist"],
  drive: ["tech_marcus_reyes", "tech_tony_delgado"],
  electrical: ["tech_priya_nair", "tech_tony_delgado"],
  plumbing: ["tech_priya_nair", "tech_marcus_reyes"],
  hull: ["tech_cal_whitfield"],
  canvas: ["tech_jo_lindqvist"],
  rigging: ["tech_jo_lindqvist"],
  haul: ["tech_cal_whitfield"],
  detailing: ["tech_cal_whitfield"],
  winterisation: ["tech_marcus_reyes", "tech_tony_delgado"],
  commissioning: ["tech_marcus_reyes", "tech_tony_delgado"],
  hydraulics: ["tech_marcus_reyes"],
};

/** Vessels whose interval history is hand-set so they show up as due for service. */
export const controlledVessels = new Set([
  "ves_reel_therapy",
  "ves_serendipity",
  "ves_lady_luck",
  "ves_second_wind",
  "ves_tenacity",
  "ves_irish_wake",
  "ves_wanderlust",
]);

interface Spec {
  id?: string;
  vesselId: string;
  closedAt?: string; // YYYY-MM-DD; omit for open orders
  openedAt?: string;
  ops: string[];
  description: string;
  status?: string;
  technicianId?: string | null;
  total?: number; // force a total (used for invoice matching)
  hoursFactor?: number;
}

// ---------------------------------------------------------------- explicit
const explicit: Spec[] = [
  // The demo anchor: 26 months before 2026-09-14, no later impeller job.
  { id: "WO-2024-0311", vesselId: "ves_reel_therapy", closedAt: "2024-07-16", ops: ["ENG-IMP-01", "ENG-OIL-01"], description: "Both engines: raw water impellers and annual oil service", technicianId: "tech_marcus_reyes" },
  { vesselId: "ves_reel_therapy", closedAt: "2026-03-10", ops: ["ENG-OIL-01", "ENG-FUL-01"], description: "Spring oil and fuel filter service, both engines", technicianId: "tech_marcus_reyes" },
  { vesselId: "ves_reel_therapy", closedAt: "2025-04-22", ops: ["HUL-BTM-01", "HUL-ZNC-01"], description: "Haul, bottom paint and anodes", technicianId: "tech_cal_whitfield" },
  { vesselId: "ves_reel_therapy", closedAt: "2023-05-08", ops: ["DRV-BEL-01"], description: "Bravo Three bellows and gimbal bearings, both drives", technicianId: "tech_tony_delgado" },

  // Due-for-service vessels (past interval).
  { vesselId: "ves_serendipity", closedAt: "2025-05-20", ops: ["HUL-BTM-01", "HUL-ZNC-01"], description: "Bottom paint and anodes" },
  { vesselId: "ves_serendipity", closedAt: "2026-04-14", ops: ["ENG-OIL-01"], description: "Oil and filter, both engines" },
  { vesselId: "ves_lady_luck", closedAt: "2024-05-10", ops: ["ENG-IMP-01", "ENG-CLF-01"], description: "Impellers and coolant flush, both mains" },
  { vesselId: "ves_lady_luck", closedAt: "2026-02-19", ops: ["ENG-OIL-01", "ENG-FUL-01"], description: "Oil, filters and fuel filters, both mains" },
  { vesselId: "ves_second_wind", closedAt: "2024-10-28", ops: ["WNT-ENG-01", "WNT-FW-01"], description: "Winterise engine and water systems for owner's trip north" },
  { vesselId: "ves_second_wind", closedAt: "2026-05-06", ops: ["ENG-OIL-01"], description: "Oil and filter" },
  { vesselId: "ves_tenacity", closedAt: "2025-06-02", ops: ["ENG-OIL-01", "ENG-FUL-01"], description: "Oil, filters and fuel filters, both mains" },
  { vesselId: "ves_irish_wake", closedAt: "2025-04-15", ops: ["ENG-ANO-01", "ENG-OIL-01"], description: "Engine anodes and oil service, both D4s" },
  { vesselId: "ves_irish_wake", closedAt: "2026-03-03", ops: ["ENG-OIL-01"], description: "Oil and filter, both D4s" },
  { vesselId: "ves_wanderlust", closedAt: "2025-03-12", ops: ["HUL-BTM-01"], description: "Bottom paint" },
  { vesselId: "ves_wanderlust", closedAt: "2026-01-20", ops: ["ENG-OIL-01", "RIG-STD-01"], description: "Oil change and rig inspection" },

  // Closed work orders behind the six overdue invoices (totals forced to match).
  { vesselId: "ves_la_sirena", closedAt: "2026-05-14", ops: ["ENG-EXH-01"], description: "Port exhaust manifold and riser replacement", total: 3860.0, technicianId: "tech_tony_delgado" },
  { vesselId: "ves_tenacity", closedAt: "2026-06-09", ops: ["ENG-RWP-01", "ENG-HEX-01"], description: "Starboard sea water pump and heat exchanger service", total: 6900.0, technicianId: "tech_marcus_reyes" },
  { vesselId: "ves_reel_estate", closedAt: "2026-06-28", ops: ["HYD-TAB-01", "HYD-STR-02"], description: "Port trim tab actuator, bleed steering", total: 1240.5, technicianId: "tech_marcus_reyes" },
  { vesselId: "ves_irish_wake", closedAt: "2026-07-07", ops: ["ENG-FUL-01", "ENG-BLT-01"], description: "Fuel filters and serpentine belts, both engines", total: 2150.75, technicianId: "tech_tony_delgado" },
  { vesselId: "ves_daydream", closedAt: "2026-07-23", ops: ["ELE-BLG-02"], description: "Bilge pump and float switch", total: 685.0, technicianId: "tech_priya_nair" },
  { vesselId: "ves_wanderlust", closedAt: "2026-08-05", ops: ["ELE-NAV-01"], description: "Replace bow and stern navigation lights", total: 480.0, technicianId: "tech_priya_nair" },

  // Closed, invoiced, not yet due.
  { vesselId: "ves_carpe_diem", closedAt: "2026-08-20", ops: ["ENG-OB1-01"], description: "100 hour service, both F300s", total: 1980.0, technicianId: "tech_tony_delgado" },
  { vesselId: "ves_seas_the_day", closedAt: "2026-08-27", ops: ["ENG-OIL-01", "ENG-ANO-01"], description: "Annual oil service and engine anodes", total: 2640.0, technicianId: "tech_marcus_reyes" },
  { vesselId: "ves_fika", closedAt: "2026-09-04", ops: ["PLB-FWP-01"], description: "Replace fresh water pump", total: 760.0, technicianId: "tech_priya_nair" },
];

/** Work orders that are open during the demo week. */
export const openSpecs: Spec[] = [
  { vesselId: "ves_high_cotton", openedAt: "2026-09-10", ops: ["ENG-ALT-01"], description: "Starboard alternator not charging underway", status: "in_progress", technicianId: "tech_marcus_reyes" },
  { vesselId: "ves_northern_light", openedAt: "2026-09-08", ops: ["ENG-OB1-01"], description: "Triple Verado 100 hour service", status: "scheduled", technicianId: "tech_tony_delgado" },
  { vesselId: "ves_fika", openedAt: "2026-09-09", ops: ["PLB-HED-01"], description: "Forward head rebuild", status: "scheduled", technicianId: "tech_priya_nair" },
  { vesselId: "ves_kingfisher", openedAt: "2026-09-07", ops: ["HUL-GEL-01"], description: "Gelcoat repair, port bow dock rash", status: "in_progress", technicianId: "tech_cal_whitfield" },
  { vesselId: "ves_c_est_la_vie", openedAt: "2026-09-09", ops: ["RIG-FRL-01", "RIG-HAL-01"], description: "Furler service and main halyard", status: "scheduled", technicianId: "tech_jo_lindqvist" },
  { vesselId: "ves_blue_heron", openedAt: "2026-09-11", ops: ["ELE-BLG-01"], description: "Bilge pump not coming on automatically", status: "open", technicianId: null },
  { vesselId: "ves_persistence", openedAt: "2026-09-12", ops: ["HYD-TAB-02"], description: "Trim tab pump hums, tabs not responding", status: "open", technicianId: null },
  { vesselId: "ves_nautilus", openedAt: "2026-08-28", ops: ["DRV-BEL-01"], description: "Bellows cracked, water in bilge after runs", status: "scheduled", technicianId: "tech_tony_delgado" },
];

// ------------------------------------------------------------- generation
const r = rng(20260914);

function randomDate(fromIso: string, toIso: string): Date {
  const from = d(fromIso).getTime();
  const to = d(toIso).getTime();
  const t = from + r.next() * (to - from);
  const date = new Date(t);
  date.setUTCHours(14, 0, 0, 0);
  return date;
}

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Recent, within-interval maintenance so most vessels are NOT overdue. */
function recentMaintenance(): Spec[] {
  const specs: Spec[] = [];
  for (const v of vessels) {
    if (controlledVessels.has(v.id)) continue;
    if (v.propulsion === "sail") {
      specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2025-11-01", "2026-08-15")), ops: ["ENG-OIL-01", "ENG-ANO-01"], description: "Annual engine service and pencil zincs" });
      if (r.chance(0.6)) specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2026-01-05", "2026-07-20")), ops: ["RIG-STD-01"], description: "Annual standing rigging inspection" });
      if (r.chance(0.5)) specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2026-01-05", "2026-06-30")), ops: ["HUL-BTM-01", "HUL-ZNC-01"], description: "Haul, bottom paint and anodes" });
    } else if (v.propulsion === "outboard") {
      specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2025-11-01", "2026-08-15")), ops: r.chance(0.5) ? ["ENG-OB1-01"] : ["ENG-OB1-01", "DRV-GL-01"], description: "100 hour outboard service" });
      if (r.chance(0.45)) specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2026-01-05", "2026-06-30")), ops: ["HUL-BTM-01"], description: "Bottom paint" });
    } else {
      specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2025-11-01", "2026-08-15")), ops: r.chance(0.6) ? ["ENG-OIL-01", "ENG-ANO-01"] : ["ENG-OIL-01", "ENG-FUL-01"], description: "Annual engine service" });
      if (r.chance(0.65)) specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2025-03-01", "2026-06-30")), ops: ["ENG-IMP-01"], description: "Raw water impellers" });
      if (r.chance(0.5)) specs.push({ vesselId: v.id, closedAt: isoOf(randomDate("2026-01-05", "2026-06-30")), ops: ["HUL-BTM-01", "HUL-ZNC-01"], description: "Haul, bottom paint and anodes" });
    }
  }
  return specs;
}

const nonInterval = operationCodes.filter((o) => !intervalCodes.includes(o.code));
const commonPool = nonInterval.filter((o) => ["electrical", "plumbing", "canvas", "detailing", "haul", "commissioning"].includes(o.category) || ["HUL-GEL-01", "HUL-SRV-01", "ENG-DIA-01", "ENG-BLT-01", "ENG-TST-01", "ENG-HOS-01"].includes(o.code)).map((o) => o.code);
const poolBy: Record<VesselSeed["propulsion"], string[]> = {
  outboard: ["DRV-LU-01", "DRV-PRP-01", "DRV-PRP-02", "DRV-TRM-01", "HYD-TAB-01", "HYD-STR-02", "HYD-STR-01"],
  sterndrive: ["DRV-UJ-01", "ENG-EXH-01", "ENG-STR-01", "ENG-ALT-01", "ENG-HEX-01", "ENG-RWP-01", "HYD-TAB-01"],
  inboard: ["ENG-HEX-01", "ENG-RWP-01", "HUL-STF-01", "ENG-STR-01", "ENG-ALT-01", "ENG-INJ-01", "ENG-MNT-01"],
  sail: ["RIG-FST-01", "RIG-HAL-01", "RIG-SHR-01", "RIG-FRL-01", "RIG-MST-01", "HUL-STF-01", "ENG-HEX-01"],
};

function randomHistory(count: number): Spec[] {
  const specs: Spec[] = [];
  for (let i = 0; i < count; i++) {
    const v = r.pick(vessels);
    const nOps = r.int(1, 3);
    const ops = new Set<string>();
    while (ops.size < nOps) {
      ops.add(r.chance(0.55) ? r.pick(commonPool) : r.pick(poolBy[v.propulsion]));
    }
    const list = [...ops];
    const primary = opByCode.get(list[0])!;
    specs.push({
      vesselId: v.id,
      closedAt: isoOf(randomDate("2022-01-05", "2026-08-20")),
      ops: list,
      description: list.length === 1 ? primary.description : `${primary.description} plus ${list.length - 1} other item${list.length > 2 ? "s" : ""}`,
    });
  }
  return specs;
}

// ----------------------------------------------------------------- build
function kitPartsFor(op: OpCodeSeed, v: VesselSeed): { partNumber: string; qty: number }[] {
  if (!op.kit) return [];
  const mult = op.category === "engine" ? v.engineCount : 1;
  return Object.entries(op.kit)
    .filter(([pn]) => {
      const p = partByNumber.get(pn);
      if (!p) return false;
      return p.fitsEngineMakes.length === 0 || p.fitsEngineMakes.includes(v.engineMake);
    })
    .map(([pn, qty]) => ({ partNumber: pn, qty: qty * mult }));
}

export function buildWorkOrders() {
  const specs: Spec[] = [
    ...explicit,
    ...recentMaintenance(),
    ...randomHistory(72),
    ...openSpecs,
  ];

  const workOrders: WorkOrderRow[] = [];
  const operations: WorkOrderOpRow[] = [];
  const woParts: WorkOrderPartRow[] = [];

  // Number per year in chronological order with a plausible step, keeping the
  // forced WO-2024-0311 unique.
  const counters: Record<string, number> = {};
  const used = new Set(specs.filter((s) => s.id).map((s) => s.id!));

  const dated = specs.map((s) => {
    const opened = s.openedAt ? d(s.openedAt) : new Date(d(s.closedAt!).getTime() - r.int(2, 12) * 86400000);
    return { spec: s, opened };
  });
  dated.sort((a, b) => a.opened.getTime() - b.opened.getTime());

  for (const { spec, opened } of dated) {
    const v = vesselById.get(spec.vesselId)!;
    const year = String(opened.getUTCFullYear());
    let id = spec.id;
    if (!id) {
      do {
        counters[year] = (counters[year] ?? 0) + r.int(5, 9);
        id = `WO-${year}-${String(counters[year]).padStart(4, "0")}`;
      } while (used.has(id));
      used.add(id);
    }

    let hoursStandard = 0;
    let hoursBilled = 0;
    let labor = 0;
    let partsTotal = 0;
    const primaryCat = opByCode.get(spec.ops[0])!.category;

    for (const code of spec.ops) {
      const op = opByCode.get(code);
      if (!op) throw new Error(`Unknown op code in seed: ${code}`);
      const mult = op.category === "engine" ? v.engineCount : 1;
      const std = op.standardHours * mult;
      const billed = Math.round((std * (spec.hoursFactor ?? 0.85 + r.next() * 0.5)) * 4) / 4;
      hoursStandard += std;
      hoursBilled += billed;
      labor += billed * (op.laborRate ?? marina.laborRate);
      operations.push({ workOrderId: id, operationCodeId: code, hours: billed });
      if (r.chance(0.85) || spec.total) {
        for (const kp of kitPartsFor(op, v)) {
          woParts.push({ workOrderId: id, partId: kp.partNumber, qty: kp.qty });
          partsTotal += kp.qty * partByNumber.get(kp.partNumber)!.sellPrice;
        }
      }
    }

    const isOpen = !spec.closedAt;
    const total = spec.total ?? (isOpen ? 0 : round2((labor + partsTotal) * (1 + marina.shopSuppliesPct / 100) * (1 + marina.taxPct / 100)));

    workOrders.push({
      id,
      number: id,
      vesselId: v.id,
      technicianId: spec.technicianId === undefined ? r.pick(techForCategory[primaryCat] ?? techs) : spec.technicianId,
      status: spec.status ?? "closed",
      description: spec.description,
      openedAt: opened,
      closedAt: isOpen ? null : d(spec.closedAt!),
      hoursStandard: round2(hoursStandard),
      hoursBilled: isOpen ? 0 : round2(hoursBilled),
      total,
    });
  }

  return { workOrders, operations, woParts };
}

/** Lookup used by invoices.ts to find the work order behind an explicit invoice. */
export function findWorkOrder(workOrders: WorkOrderRow[], vesselId: string, closedAtIso: string): WorkOrderRow {
  const wo = workOrders.find((w) => w.vesselId === vesselId && w.closedAt && w.closedAt.toISOString().startsWith(closedAtIso));
  if (!wo) throw new Error(`No work order for ${vesselId} closed ${closedAtIso}`);
  return wo;
}
