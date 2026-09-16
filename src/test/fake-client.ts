/**
 * In-memory DockMasterClient subset for pipeline tests. Only the methods the
 * pipeline reads are implemented; writes record into arrays for assertions.
 */

import type { DockMasterClient } from "@/lib/dockmaster/client";
import { rankVesselCandidates } from "@/lib/dockmaster/match-rules";
import type {
  ActivityInput,
  Customer,
  Estimate,
  EstimateInput,
  Marina,
  OperationCode,
  Part,
  PartsKit,
  Technician,
  Vessel,
  WorkOrderSummary,
} from "@/lib/dockmaster/types";

export const marina: Marina = {
  id: "marina",
  name: "Harbourline Marine & Yacht Yard",
  city: "Stuart",
  state: "FL",
  laborRate: 165,
  shopSuppliesPct: 5,
  taxPct: 7,
};

const patterson: Customer = {
  id: "cus_patterson_dana",
  name: "Dana Patterson",
  email: "dana@example.com",
  phone: "772-555-0101",
  portalEnabled: true,
  arBalance: 0,
};
const brooks: Customer = {
  id: "cus_brooks_sam",
  name: "Sam Brooks",
  email: "sam@example.com",
  phone: "772-555-0102",
  portalEnabled: true,
  arBalance: 0,
};

export const vessels: Vessel[] = [
  {
    id: "ves_reel_therapy",
    name: "Reel Therapy",
    make: "Sea Ray",
    model: "400 Sundancer",
    year: 2019,
    lengthFt: 40,
    hin: "SERP23814471",
    engineMake: "MerCruiser",
    engineModel: "8.2 MAG ECT",
    engineCount: 2,
    engineHours: 640,
    location: "Slip C-12",
    customerId: patterson.id,
    customer: patterson,
  },
  {
    id: "ves_second_wind",
    name: "Second Wind",
    make: "Sea Ray",
    model: "320 Sundancer",
    year: 2017,
    lengthFt: 32,
    hin: "SERV8812F717",
    engineMake: "MerCruiser",
    engineModel: "6.2 MPI",
    engineCount: 2,
    engineHours: 800,
    location: "Slip D-04",
    customerId: brooks.id,
    customer: brooks,
  },
  {
    id: "ves_salty_dog",
    name: "Salty Dog",
    make: "Grady-White",
    model: "Canyon 271",
    year: 2020,
    lengthFt: 27,
    hin: "NTLB2201H920",
    engineMake: "Yamaha",
    engineModel: "F300",
    engineCount: 2,
    engineHours: 410,
    location: "Rack B-07",
    customerId: brooks.id,
    customer: brooks,
  },
];

export const operationCodes: OperationCode[] = [
  op("ENG-IMP-01", "Replace raw water pump impeller", "engine", 1.0, ["impeller", "chewed up", "missing vanes", "raw water", "running hot", "overheat"], 24, true),
  op("ENG-RWP-01", "Replace raw water pump assembly", "engine", 2.5, ["raw water pump", "pump", "weeping", "seal leak", "seawater pump"], null, true),
  op("ENG-CLF-01", "Flush closed cooling system", "engine", 1.0, ["flush", "cooling system", "coolant", "antifreeze"], 24, true),
  op("ENG-HEX-01", "Inspect and clean heat exchanger", "engine", 1.5, ["heat exchanger", "vane debris", "check heat exchanger", "clogged"], null, false),
  op("HYD-TAB-01", "Replace trim tab actuator", "hydraulics", 1.5, ["trim tab", "actuator", "leaking", "hydraulic"], null, true),
  op("ENG-OIL-01", "Engine oil and filter change", "engine", 1.0, ["oil change", "oil", "filter"], 12, true),
  op("DRV-LU-02", "Replace lower unit assembly", "drive", 4.0, ["lower unit", "toast", "gearcase"], null, false),
];

function op(
  code: string,
  description: string,
  category: string,
  standardHours: number,
  keywords: string[],
  interval: number | null,
  kit: boolean,
): OperationCode {
  return {
    id: code,
    code,
    description,
    category,
    standardHours,
    laborRate: null,
    keywords,
    maintenanceIntervalMonths: interval,
    kitId: kit ? `kit_${code}` : null,
  };
}

function part(partNumber: string, description: string, cost: number, sellPrice: number, onHand: number, reorderPoint = 1): Part {
  return { id: partNumber, partNumber, description, vendor: "Mercury", cost, sellPrice, onHand, reorderPoint, binLocation: "A-01-1", fitsEngineMakes: ["MerCruiser"] };
}

export const kits: Record<string, PartsKit> = {
  "ENG-IMP-01": { id: "kit_ENG-IMP-01", name: "MerCruiser impeller kit", operationCode: "ENG-IMP-01", items: [{ part: part("47-8M0104229", "Impeller repair kit", 38, 62, 4), qty: 1 }] },
  "ENG-RWP-01": { id: "kit_ENG-RWP-01", name: "MerCruiser sea water pump", operationCode: "ENG-RWP-01", items: [{ part: part("8M0139545", "Sea water pump assembly", 310, 465, 0), qty: 1 }] },
  "ENG-CLF-01": { id: "kit_ENG-CLF-01", name: "Cooling flush", operationCode: "ENG-CLF-01", items: [{ part: part("92-813696K01", "Extended life antifreeze, gallon", 19, 29.5, 12), qty: 2 }] },
  "HYD-TAB-01": { id: "kit_HYD-TAB-01", name: "Bennett actuator", operationCode: "HYD-TAB-01", items: [{ part: part("A1101", "Bennett trim tab actuator", 142, 219, 2), qty: 1 }] },
  "ENG-OIL-01": { id: "kit_ENG-OIL-01", name: "Oil change", operationCode: "ENG-OIL-01", items: [{ part: part("35-866340Q03", "Oil filter", 11, 18, 10), qty: 1 }] },
};

export const marcus: Technician = {
  id: "tech_marcus_reyes",
  name: "Marcus Reyes",
  role: "lead_tech",
  skills: ["engine", "hydraulics", "plumbing"],
  hourlyCost: 42,
  availability: { mon: [[8, 12], [13, 17]], tue: [[8, 12], [13, 17]], wed: [[8, 12], [13, 17]], thu: [[8, 12], [13, 17]], fri: [[8, 12], [13, 17]] },
};

export const reelTherapyHistory: WorkOrderSummary[] = [
  {
    id: "WO-2024-0311",
    number: "WO-2024-0311",
    vesselId: "ves_reel_therapy",
    status: "closed",
    description: "Impeller and oil service",
    openedAt: new Date("2024-07-10T12:00:00Z"),
    closedAt: new Date("2024-07-16T12:00:00Z"),
    technicianName: "Marcus Reyes",
    hoursStandard: 2.0,
    hoursBilled: 2.2,
    total: 612.4,
    operations: [
      { code: "ENG-IMP-01", description: "Replace raw water pump impeller", category: "engine", hours: 1.2, maintenanceIntervalMonths: 24 },
      { code: "ENG-OIL-01", description: "Engine oil and filter change", category: "engine", hours: 1.0, maintenanceIntervalMonths: 12 },
    ],
    parts: [{ partNumber: "47-8M0104229", description: "Impeller repair kit", qty: 2 }],
  },
];

export class FakeDockMasterClient {
  public created: EstimateInput[] = [];
  public activity: ActivityInput[] = [];
  private nextId = 1;

  async getMarina() {
    return marina;
  }
  async listVessels() {
    return vessels;
  }
  async getVessel(id: string) {
    return vessels.find((v) => v.id === id) ?? null;
  }
  async findVesselByHint(hint: Parameters<typeof rankVesselCandidates>[1]) {
    return rankVesselCandidates(vessels, hint);
  }
  async getVesselHistory(vesselId: string) {
    return vesselId === "ves_reel_therapy" ? reelTherapyHistory : [];
  }
  async listOperationCodes() {
    return operationCodes;
  }
  async getPartsKit(code: string) {
    return kits[code] ?? null;
  }
  async getTechnician(id: string) {
    return id === marcus.id ? marcus : null;
  }
  async createEstimate(input: EstimateInput): Promise<Estimate> {
    this.created.push(input);
    const id = `est_${this.nextId++}`;
    const vessel = vessels.find((v) => v.id === input.vesselId)!;
    return {
      id,
      number: `EST-2026-0${141 + this.nextId}`,
      status: input.status,
      title: input.title,
      vesselId: vessel.id,
      vessel,
      customerId: vessel.customerId,
      customer: vessel.customer,
      technicianId: input.technicianId ?? null,
      technicianName: null,
      techNoteId: input.techNoteId ?? null,
      origin: input.origin ?? "tech_note",
      quoteSeparately: input.quoteSeparately ?? false,
      parentEstimateId: input.parentEstimateId ?? null,
      totals: input.totals,
      requiresManagerApproval: input.requiresManagerApproval,
      vesselMatchConfidence: input.vesselMatchConfidence ?? null,
      vesselMatchReasons: input.vesselMatchReasons ?? [],
      historyFlags: input.historyFlags ?? [],
      reasoning: input.reasoning ?? { steps: [], notes: [] },
      customerSummary: input.customerSummary ?? null,
      internalSummary: input.internalSummary ?? null,
      photoPaths: input.photoPaths ?? [],
      sentAt: null,
      approvedAt: null,
      signedByName: null,
      signedAt: null,
      declinedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: input.lines.map((l, i) => ({
        ...l,
        id: `${id}_l${i}`,
        estimateId: id,
        parentLineId: null,
        qty: l.qty ?? 1,
        included: l.included ?? true,
        source: l.source ?? "ai",
        needsManagerReview: l.needsManagerReview ?? false,
        sortOrder: l.sortOrder ?? i,
      })),
      workOrderNumber: null,
      workOrderId: null,
    };
  }
  async logActivity(input: ActivityInput) {
    this.activity.push(input);
    return { ...input, id: `act_${this.activity.length}`, payload: input.payload ?? {}, createdAt: new Date() };
  }

  asClient(): DockMasterClient {
    return this as unknown as DockMasterClient;
  }
}
