/**
 * Prisma-backed DockMasterClient. Stands in for the DockMaster Web 2.0 API using
 * the seeded local database. See client.ts for the production mapping.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { DEMO_TODAY, addDays, daysBetween, demoNow } from "@/lib/demo-date";
import { parseJson, round2 } from "@/lib/utils";
import { predictDueForService } from "@/lib/due-for-service";
import { rankVesselCandidates } from "./match-rules";
import type { DockMasterClient } from "./client";
import type {
  ActivityEntry,
  ActivityInput,
  Customer,
  DashboardCounts,
  DueForServiceItem,
  Estimate,
  EstimateInput,
  EstimateLine,
  EstimateStatus,
  EstimateUpdate,
  Invoice,
  Marina,
  OperationCode,
  OverdueInvoice,
  Part,
  PartsKit,
  PaymentLink,
  ScheduleBlock,
  ScheduleBlockInput,
  TechNote,
  TechNoteInput,
  Technician,
  Vessel,
  VesselHint,
  VesselMatchCandidate,
  WorkOrderSummary,
} from "./types";

const vesselInclude = { customer: true } satisfies Prisma.VesselInclude;
type VesselRow = Prisma.VesselGetPayload<{ include: typeof vesselInclude }>;

const workOrderInclude = {
  technician: true,
  operations: { include: { operationCode: true } },
  parts: { include: { part: true } },
} satisfies Prisma.WorkOrderInclude;
type WorkOrderRow = Prisma.WorkOrderGetPayload<{ include: typeof workOrderInclude }>;

const estimateInclude = {
  vessel: { include: vesselInclude },
  customer: true,
  technician: true,
  workOrder: true,
  lines: {
    include: { operationCode: true, part: true },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.EstimateInclude;
type EstimateRow = Prisma.EstimateGetPayload<{ include: typeof estimateInclude }>;

const invoiceInclude = { customer: true, workOrder: true } satisfies Prisma.InvoiceInclude;
type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

// ---------- mappers ----------

function toCustomer(c: Prisma.CustomerGetPayload<object>): Customer {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    portalEnabled: c.portalEnabled,
    arBalance: c.arBalance,
  };
}

function toVessel(v: VesselRow): Vessel {
  return {
    id: v.id,
    name: v.name,
    make: v.make,
    model: v.model,
    year: v.year,
    lengthFt: v.lengthFt,
    hin: v.hin,
    engineMake: v.engineMake,
    engineModel: v.engineModel,
    engineCount: v.engineCount,
    engineHours: v.engineHours,
    location: v.location,
    customerId: v.customerId,
    customer: toCustomer(v.customer),
  };
}

function toTechnician(t: Prisma.TechnicianGetPayload<object>): Technician {
  return {
    id: t.id,
    name: t.name,
    role: t.role as Technician["role"],
    skills: parseJson<string[]>(t.skills, []),
    hourlyCost: t.hourlyCost,
    availability: parseJson<Record<string, [number, number][]>>(t.availability, {}),
  };
}

function toOperationCode(o: Prisma.OperationCodeGetPayload<object>): OperationCode {
  return {
    id: o.id,
    code: o.code,
    description: o.description,
    category: o.category,
    standardHours: o.standardHours,
    laborRate: o.laborRate,
    keywords: parseJson<string[]>(o.keywords, []),
    maintenanceIntervalMonths: o.maintenanceIntervalMonths,
    kitId: o.kitId,
  };
}

function toPart(p: Prisma.PartGetPayload<object>): Part {
  return {
    id: p.id,
    partNumber: p.partNumber,
    description: p.description,
    vendor: p.vendor,
    cost: p.cost,
    sellPrice: p.sellPrice,
    onHand: p.onHand,
    reorderPoint: p.reorderPoint,
    binLocation: p.binLocation,
    fitsEngineMakes: parseJson<string[]>(p.fitsEngineMakes, []),
  };
}

function toWorkOrderSummary(w: WorkOrderRow): WorkOrderSummary {
  return {
    id: w.id,
    number: w.number,
    vesselId: w.vesselId,
    status: w.status,
    description: w.description,
    openedAt: w.openedAt,
    closedAt: w.closedAt,
    technicianName: w.technician?.name ?? null,
    hoursBilled: w.hoursBilled,
    total: w.total,
    operations: w.operations.map((op) => ({
      code: op.operationCode.code,
      description: op.operationCode.description,
      category: op.operationCode.category,
      hours: op.hours,
      maintenanceIntervalMonths: op.operationCode.maintenanceIntervalMonths,
    })),
    parts: w.parts.map((p) => ({
      partNumber: p.part.partNumber,
      description: p.part.description,
      qty: p.qty,
    })),
  };
}

function toEstimateLine(l: EstimateRow["lines"][number]): EstimateLine {
  return {
    id: l.id,
    estimateId: l.estimateId,
    kind: l.kind as EstimateLine["kind"],
    operationCodeId: l.operationCodeId,
    partId: l.partId,
    parentLineId: l.parentLineId,
    description: l.description,
    customerDescription: l.customerDescription,
    qty: l.qty,
    hours: l.hours,
    standardHours: l.standardHours,
    technicianHours: l.technicianHours,
    hoursFlag: l.hoursFlag,
    rate: l.rate,
    unitCost: l.unitCost,
    unitPrice: l.unitPrice,
    lineTotal: l.lineTotal,
    included: l.included,
    confidence: l.confidence,
    source: l.source as EstimateLine["source"],
    rationale: l.rationale,
    sourceNote: l.sourceNote,
    stockWarning: l.stockWarning,
    needsManagerReview: l.needsManagerReview,
    sortOrder: l.sortOrder,
    operationCode: l.operationCode ? toOperationCode(l.operationCode) : null,
    part: l.part ? toPart(l.part) : null,
  };
}

function toEstimate(e: EstimateRow): Estimate {
  return {
    id: e.id,
    number: e.number,
    status: e.status as EstimateStatus,
    title: e.title,
    vesselId: e.vesselId,
    vessel: toVessel(e.vessel),
    customerId: e.customerId,
    customer: toCustomer(e.customer),
    technicianId: e.technicianId,
    technicianName: e.technician?.name ?? null,
    techNoteId: e.techNoteId,
    origin: e.origin as Estimate["origin"],
    quoteSeparately: e.quoteSeparately,
    parentEstimateId: e.parentEstimateId,
    totals: {
      subtotalLabor: e.subtotalLabor,
      subtotalParts: e.subtotalParts,
      shopSupplies: e.shopSupplies,
      tax: e.tax,
      total: e.total,
    },
    requiresManagerApproval: e.requiresManagerApproval,
    vesselMatchConfidence: e.vesselMatchConfidence,
    vesselMatchReasons: parseJson<string[]>(e.vesselMatchReasons, []),
    historyFlags: parseJson(e.historyFlags, []),
    reasoning: parseJson(e.reasoning, { steps: [], notes: [] }),
    customerSummary: e.customerSummary,
    internalSummary: e.internalSummary,
    photoPaths: parseJson<string[]>(e.photoPaths, []),
    sentAt: e.sentAt,
    approvedAt: e.approvedAt,
    signedByName: e.signedByName,
    signedAt: e.signedAt,
    declinedReason: e.declinedReason,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    lines: e.lines.map(toEstimateLine),
    workOrderNumber: e.workOrder?.number ?? null,
    workOrderId: e.workOrder?.id ?? null,
  };
}

function toInvoice(i: InvoiceRow): Invoice {
  return {
    id: i.id,
    number: i.number,
    customerId: i.customerId,
    customer: toCustomer(i.customer),
    workOrderId: i.workOrderId,
    workOrderNumber: i.workOrder?.number ?? null,
    amount: i.amount,
    issuedAt: i.issuedAt,
    dueAt: i.dueAt,
    paidAt: i.paidAt,
    description: i.description,
  };
}

function toActivity(a: Prisma.ActivityLogGetPayload<object>): ActivityEntry {
  return {
    id: a.id,
    actor: a.actor as ActivityEntry["actor"],
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    payload: parseJson<Record<string, unknown>>(a.payload, {}),
    createdAt: a.createdAt,
  };
}

function toTechNote(
  n: Prisma.TechNoteGetPayload<{ include: { technician: true } }>,
): TechNote {
  return {
    id: n.id,
    transcript: n.transcript,
    audioPath: n.audioPath,
    photoPaths: parseJson<string[]>(n.photoPaths, []),
    technicianId: n.technicianId,
    technicianName: n.technician.name,
    vesselId: n.vesselId,
    createdAt: n.createdAt,
  };
}

function toScheduleBlock(
  b: Prisma.ScheduleBlockGetPayload<{ include: { technician: true; workOrder: true } }>,
): ScheduleBlock {
  return {
    id: b.id,
    technicianId: b.technicianId,
    technicianName: b.technician.name,
    workOrderId: b.workOrderId,
    workOrderNumber: b.workOrder?.number ?? null,
    label: b.label,
    start: b.start,
    end: b.end,
    source: b.source as ScheduleBlock["source"],
  };
}

function ageBucket(days: number): OverdueInvoice["ageBucket"] {
  if (days < 30) return "friendly";
  if (days <= 60) return "firm";
  return "final";
}

// ---------- client ----------

export class PrismaDockMasterClient implements DockMasterClient {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async getMarina(): Promise<Marina> {
    const m = await this.db.marina.findFirstOrThrow();
    return m;
  }

  async listTechnicians(): Promise<Technician[]> {
    const rows = await this.db.technician.findMany({ orderBy: { name: "asc" } });
    return rows.map(toTechnician);
  }

  async getTechnician(id: string): Promise<Technician | null> {
    const t = await this.db.technician.findUnique({ where: { id } });
    return t ? toTechnician(t) : null;
  }

  async listVessels(): Promise<Vessel[]> {
    const rows = await this.db.vessel.findMany({
      include: vesselInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(toVessel);
  }

  async getVessel(id: string): Promise<Vessel | null> {
    const v = await this.db.vessel.findUnique({ where: { id }, include: vesselInclude });
    return v ? toVessel(v) : null;
  }

  async findVesselByHint(hint: VesselHint): Promise<VesselMatchCandidate[]> {
    // A single-yard prototype can rank client-side. The real API would filter
    // server-side on hin_suffix / slip / owner and return the same shape.
    const vessels = await this.listVessels();
    return rankVesselCandidates(vessels, hint);
  }

  async getVesselHistory(vesselId: string): Promise<WorkOrderSummary[]> {
    const rows = await this.db.workOrder.findMany({
      where: { vesselId },
      include: workOrderInclude,
      orderBy: { openedAt: "desc" },
    });
    return rows.map(toWorkOrderSummary);
  }

  async listOperationCodes(): Promise<OperationCode[]> {
    const rows = await this.db.operationCode.findMany({ orderBy: { code: "asc" } });
    return rows.map(toOperationCode);
  }

  async getOperationCode(code: string): Promise<OperationCode | null> {
    const o = await this.db.operationCode.findUnique({ where: { code } });
    return o ? toOperationCode(o) : null;
  }

  async getPartsKit(operationCode: string): Promise<PartsKit | null> {
    const op = await this.db.operationCode.findUnique({
      where: { code: operationCode },
      include: { kit: { include: { items: { include: { part: true } } } } },
    });
    if (!op?.kit) return null;
    return {
      id: op.kit.id,
      name: op.kit.name,
      operationCode: op.code,
      items: op.kit.items.map((i) => ({ part: toPart(i.part), qty: i.qty })),
    };
  }

  async getPartStock(partNumbers: string[]): Promise<Part[]> {
    if (partNumbers.length === 0) return [];
    const rows = await this.db.part.findMany({
      where: { partNumber: { in: partNumbers } },
    });
    return rows.map(toPart);
  }

  async createTechNote(input: TechNoteInput): Promise<TechNote> {
    const n = await this.db.techNote.create({
      data: {
        transcript: input.transcript,
        audioPath: input.audioPath ?? null,
        photoPaths: JSON.stringify(input.photoPaths ?? []),
        technicianId: input.technicianId,
        vesselId: input.vesselId ?? null,
        createdAt: DEMO_TODAY,
      },
      include: { technician: true },
    });
    return toTechNote(n);
  }

  async getTechNote(id: string): Promise<TechNote | null> {
    const n = await this.db.techNote.findUnique({
      where: { id },
      include: { technician: true },
    });
    return n ? toTechNote(n) : null;
  }

  private async nextNumber(prefix: "EST" | "WO", start: number): Promise<string> {
    const year = DEMO_TODAY.getUTCFullYear();
    const count =
      prefix === "EST"
        ? await this.db.estimate.count()
        : await this.db.workOrder.count({ where: { number: { startsWith: `WO-${year}` } } });
    return `${prefix}-${year}-${String(start + count).padStart(4, "0")}`;
  }

  async createEstimate(input: EstimateInput): Promise<Estimate> {
    const number = await this.nextNumber("EST", 142);
    const id = await this.db.$transaction(async (tx) => {
      const est = await tx.estimate.create({
        data: {
          number,
          status: input.status,
          title: input.title,
          vesselId: input.vesselId,
          customerId: input.customerId,
          technicianId: input.technicianId ?? null,
          techNoteId: input.techNoteId ?? null,
          origin: input.origin ?? "tech_note",
          quoteSeparately: input.quoteSeparately ?? false,
          parentEstimateId: input.parentEstimateId ?? null,
          subtotalLabor: input.totals.subtotalLabor,
          subtotalParts: input.totals.subtotalParts,
          shopSupplies: input.totals.shopSupplies,
          tax: input.totals.tax,
          total: input.totals.total,
          requiresManagerApproval: input.requiresManagerApproval,
          vesselMatchConfidence: input.vesselMatchConfidence ?? null,
          vesselMatchReasons: JSON.stringify(input.vesselMatchReasons ?? []),
          historyFlags: JSON.stringify(input.historyFlags ?? []),
          reasoning: JSON.stringify(input.reasoning ?? { steps: [], notes: [] }),
          customerSummary: input.customerSummary ?? null,
          internalSummary: input.internalSummary ?? null,
          photoPaths: JSON.stringify(input.photoPaths ?? []),
          createdAt: DEMO_TODAY,
          updatedAt: DEMO_TODAY,
        },
      });

      // Two passes so part lines can reference their operation line's id.
      const idByKey = new Map<string, string>();
      const ordered = [...input.lines].map((l, i) => ({ ...l, sortOrder: l.sortOrder ?? i }));
      for (const line of ordered.filter((l) => !l.parentLineKey)) {
        const created = await tx.estimateLine.create({
          data: lineData(est.id, line, null),
        });
        if (line.key) idByKey.set(line.key, created.id);
      }
      for (const line of ordered.filter((l) => l.parentLineKey)) {
        const parentId = idByKey.get(line.parentLineKey as string) ?? null;
        await tx.estimateLine.create({ data: lineData(est.id, line, parentId) });
      }
      return est.id;
    });
    return (await this.getEstimate(id)) as Estimate;
  }

  async getEstimate(id: string): Promise<Estimate | null> {
    const e = await this.db.estimate.findUnique({ where: { id }, include: estimateInclude });
    return e ? toEstimate(e) : null;
  }

  async listEstimates(filter?: { status?: EstimateStatus[] }): Promise<Estimate[]> {
    const rows = await this.db.estimate.findMany({
      where: filter?.status ? { status: { in: filter.status } } : undefined,
      include: estimateInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toEstimate);
  }

  async updateEstimate(id: string, update: EstimateUpdate): Promise<Estimate> {
    await this.db.$transaction(async (tx) => {
      const data: Prisma.EstimateUpdateInput = { updatedAt: DEMO_TODAY };
      if (update.status) data.status = update.status;
      if (update.totals) {
        data.subtotalLabor = update.totals.subtotalLabor;
        data.subtotalParts = update.totals.subtotalParts;
        data.shopSupplies = update.totals.shopSupplies;
        data.tax = update.totals.tax;
        data.total = update.totals.total;
      }
      if (update.requiresManagerApproval !== undefined)
        data.requiresManagerApproval = update.requiresManagerApproval;
      if (update.vesselId) data.vessel = { connect: { id: update.vesselId } };
      if (update.customerId) data.customer = { connect: { id: update.customerId } };
      if (update.vesselMatchConfidence !== undefined)
        data.vesselMatchConfidence = update.vesselMatchConfidence;
      if (update.vesselMatchReasons) data.vesselMatchReasons = JSON.stringify(update.vesselMatchReasons);
      if (update.customerSummary !== undefined) data.customerSummary = update.customerSummary;
      if (update.internalSummary !== undefined) data.internalSummary = update.internalSummary;
      if (update.sentAt !== undefined) data.sentAt = update.sentAt;
      if (update.approvedAt !== undefined) data.approvedAt = update.approvedAt;
      if (update.signedByName !== undefined) data.signedByName = update.signedByName;
      if (update.signedAt !== undefined) data.signedAt = update.signedAt;
      if (update.declinedReason !== undefined) data.declinedReason = update.declinedReason;
      await tx.estimate.update({ where: { id }, data });

      for (const [lineId, edit] of Object.entries(update.lines ?? {})) {
        await tx.estimateLine.update({
          where: { id: lineId },
          data: {
            hours: edit.hours,
            qty: edit.qty,
            included: edit.included,
            lineTotal: edit.lineTotal,
            source: edit.source ?? "staff",
          },
        });
      }
    });
    return (await this.getEstimate(id)) as Estimate;
  }

  async convertToWorkOrder(estimateId: string): Promise<WorkOrderSummary> {
    const est = await this.db.estimate.findUniqueOrThrow({
      where: { id: estimateId },
      include: estimateInclude,
    });
    if (est.workOrder) {
      const existing = await this.db.workOrder.findUniqueOrThrow({
        where: { id: est.workOrder.id },
        include: workOrderInclude,
      });
      return toWorkOrderSummary(existing);
    }
    const number = await this.nextNumber("WO", 1);
    const included = est.lines.filter((l) => l.included);
    const ops = included.filter((l) => l.kind === "operation" && l.operationCodeId);
    const parts = included.filter((l) => l.kind === "part" && l.partId);
    const hoursStandard = ops.reduce((s, l) => s + (l.standardHours ?? 0), 0);

    const wo = await this.db.workOrder.create({
      data: {
        number,
        vesselId: est.vesselId,
        technicianId: null,
        status: "open",
        description: est.title,
        openedAt: DEMO_TODAY,
        hoursStandard,
        hoursBilled: 0,
        total: est.total,
        estimateId: est.id,
        operations: {
          create: ops.map((l) => ({
            operationCodeId: l.operationCodeId as string,
            hours: l.hours ?? l.standardHours ?? 0,
          })),
        },
        parts: {
          create: parts.map((l) => ({ partId: l.partId as string, qty: l.qty })),
        },
      },
      include: workOrderInclude,
    });
    await this.db.estimate.update({
      where: { id: est.id },
      data: { status: "converted", updatedAt: DEMO_TODAY },
    });
    return toWorkOrderSummary(wo);
  }

  async listWorkOrders(filter?: { status?: string[] }): Promise<WorkOrderSummary[]> {
    const rows = await this.db.workOrder.findMany({
      where: filter?.status ? { status: { in: filter.status } } : undefined,
      include: workOrderInclude,
      orderBy: { openedAt: "desc" },
    });
    return rows.map(toWorkOrderSummary);
  }

  async listVesselsDueForService(): Promise<DueForServiceItem[]> {
    const [vessels, ops, workOrders] = await Promise.all([
      this.listVessels(),
      this.listOperationCodes(),
      this.db.workOrder.findMany({ where: { status: "closed" }, include: workOrderInclude }),
    ]);
    const byVessel = new Map<string, WorkOrderSummary[]>();
    for (const wo of workOrders) {
      const list = byVessel.get(wo.vesselId) ?? [];
      list.push(toWorkOrderSummary(wo));
      byVessel.set(wo.vesselId, list);
    }
    return predictDueForService(vessels, byVessel, ops);
  }

  async listOverdueInvoices(): Promise<OverdueInvoice[]> {
    const rows = await this.db.invoice.findMany({
      where: { paidAt: null, dueAt: { lt: DEMO_TODAY } },
      include: invoiceInclude,
      orderBy: { dueAt: "asc" },
    });
    return rows.map((r) => {
      const inv = toInvoice(r);
      const daysOverdue = daysBetween(inv.dueAt);
      return { ...inv, daysOverdue, ageBucket: ageBucket(daysOverdue) };
    });
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const r = await this.db.invoice.findUnique({ where: { id }, include: invoiceInclude });
    return r ? toInvoice(r) : null;
  }

  async createPaymentLink(invoiceId: string): Promise<PaymentLink> {
    const inv = await this.db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    // Simulated ValPay link. The real client would POST to ValPay and get a
    // hosted checkout URL that expires with the invoice.
    const token = `${inv.number.toLowerCase().replace(/[^a-z0-9]/g, "")}${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    return {
      url: `https://pay.example/valpay/${token}`,
      token,
      invoiceId,
      amount: inv.amount,
    };
  }

  async listScheduleBlocks(range: { start: Date; end: Date }): Promise<ScheduleBlock[]> {
    const rows = await this.db.scheduleBlock.findMany({
      where: { start: { gte: range.start }, end: { lte: addDays(range.end, 1) } },
      include: { technician: true, workOrder: true },
      orderBy: { start: "asc" },
    });
    return rows.map(toScheduleBlock);
  }

  async createScheduleBlock(input: ScheduleBlockInput): Promise<ScheduleBlock> {
    const b = await this.db.scheduleBlock.create({
      data: {
        technicianId: input.technicianId,
        workOrderId: input.workOrderId ?? null,
        label: input.label,
        start: input.start,
        end: input.end,
        source: input.source,
      },
      include: { technician: true, workOrder: true },
    });
    if (input.workOrderId) {
      await this.db.workOrder.update({
        where: { id: input.workOrderId },
        data: { status: "scheduled", technicianId: input.technicianId },
      });
    }
    return toScheduleBlock(b);
  }

  async updateScheduleBlock(
    id: string,
    update: { source: "staff" | "ai_suggested" },
  ): Promise<ScheduleBlock> {
    const b = await this.db.scheduleBlock.update({
      where: { id },
      data: { source: update.source },
      include: { technician: true, workOrder: true },
    });
    return toScheduleBlock(b);
  }

  async deleteScheduleBlock(id: string): Promise<void> {
    const b = await this.db.scheduleBlock.findUnique({ where: { id } });
    if (!b) return;
    await this.db.scheduleBlock.delete({ where: { id } });
    if (b.workOrderId) {
      await this.db.workOrder.update({
        where: { id: b.workOrderId },
        data: { status: "open", technicianId: null },
      });
    }
  }

  async logActivity(input: ActivityInput): Promise<ActivityEntry> {
    const a = await this.db.activityLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: JSON.stringify(input.payload ?? {}),
        // Demo day plus the real time of day, so the log orders correctly within a session.
        createdAt: demoNow(),
      },
    });
    return toActivity(a);
  }

  async listActivity(filter?: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  }): Promise<ActivityEntry[]> {
    const rows = await this.db.activityLog.findMany({
      where: {
        entityType: filter?.entityType,
        entityId: filter?.entityId,
      },
      orderBy: { createdAt: "desc" },
      take: filter?.limit ?? 50,
    });
    return rows.map(toActivity);
  }

  async getDashboardCounts(): Promise<DashboardCounts> {
    const [aiDrafts, awaitingCustomer, due, overdue] = await Promise.all([
      this.db.estimate.count({ where: { status: { in: ["draft_ai", "draft_reviewed"] } } }),
      this.db.estimate.count({ where: { status: "awaiting_customer" } }),
      this.listVesselsDueForService(),
      this.listOverdueInvoices(),
    ]);
    return {
      aiDrafts,
      awaitingCustomer,
      dueForService: new Set(due.map((d) => d.vessel.id)).size,
      overdueInvoices: overdue.length,
      overdueAmount: round2(overdue.reduce((s, i) => s + i.amount, 0)),
    };
  }

  async getCustomer(id: string): Promise<Customer | null> {
    const c = await this.db.customer.findUnique({ where: { id } });
    return c ? toCustomer(c) : null;
  }
}

function lineData(
  estimateId: string,
  line: EstimateInput["lines"][number] & { sortOrder: number },
  parentLineId: string | null,
): Prisma.EstimateLineUncheckedCreateInput {
  return {
    estimateId,
    kind: line.kind,
    operationCodeId: line.operationCodeId ?? null,
    partId: line.partId ?? null,
    parentLineId,
    description: line.description,
    customerDescription: line.customerDescription ?? null,
    qty: line.qty ?? 1,
    hours: line.hours ?? null,
    standardHours: line.standardHours ?? null,
    technicianHours: line.technicianHours ?? null,
    hoursFlag: line.hoursFlag ?? null,
    rate: line.rate ?? null,
    unitCost: line.unitCost ?? null,
    unitPrice: line.unitPrice ?? null,
    lineTotal: line.lineTotal,
    included: line.included ?? true,
    confidence: line.confidence ?? null,
    source: line.source ?? "ai",
    rationale: line.rationale ?? null,
    sourceNote: line.sourceNote ?? null,
    stockWarning: line.stockWarning ?? null,
    needsManagerReview: line.needsManagerReview ?? false,
    sortOrder: line.sortOrder,
  };
}

/** Default client instance used by server components, actions and route handlers. */
let singleton: PrismaDockMasterClient | null = null;
export function getDockMasterClient(): DockMasterClient {
  if (!singleton) singleton = new PrismaDockMasterClient();
  return singleton;
}
