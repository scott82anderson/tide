/**
 * Serialised row shapes for the data browser. Server pages build these from
 * DockMasterClient results and hand them to a client component, so nothing
 * here may contain Dates, functions or Prisma types.
 */

import type { EntitySlug } from "./entities";
import { DEMO_TODAY, daysBetween } from "@/lib/demo-date";
import type {
  Customer,
  Invoice,
  OperationCode,
  Part,
  PartsKit,
  Technician,
  Vessel,
  WorkOrderSummary,
} from "@/lib/dockmaster/types";

export interface KitLine {
  partNumber: string;
  description: string;
  qty: number;
  onHand: number;
}

export type OperationRow = OperationCode & {
  kit: { name: string; items: KitLine[] } | null;
};

export type VesselRow = Vessel;

export type CustomerRow = Customer;

export type PartRow = Part & {
  lowStock: boolean;
  /** Percent markup over cost, or null when cost is zero. */
  marginPct: number | null;
};

export type TechnicianRow = Omit<Technician, "availability"> & {
  weeklyHours: number;
  days: string[];
};

export type WorkOrderRow = Omit<WorkOrderSummary, "openedAt" | "closedAt"> & {
  openedAt: string;
  closedAt: string | null;
  vesselName: string;
};

export type InvoicePayment = "paid" | "unpaid" | "overdue";

export type InvoiceRow = Omit<Invoice, "issuedAt" | "dueAt" | "paidAt" | "customer"> & {
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  customerName: string;
  payment: InvoicePayment;
  daysOverdue: number;
};

export type EntityRowMap = {
  operations: OperationRow;
  vessels: VesselRow;
  customers: CustomerRow;
  parts: PartRow;
  technicians: TechnicianRow;
  "work-orders": WorkOrderRow;
  invoices: InvoiceRow;
};

export type EntityRows = { [K in EntitySlug]: EntityRowMap[K][] };

export function toOperationRows(ops: OperationCode[], kits: PartsKit[]): OperationRow[] {
  const byCode = new Map(kits.filter((k) => k.operationCode).map((k) => [k.operationCode, k]));
  const byId = new Map(kits.map((k) => [k.id, k]));
  return ops.map((op) => {
    const kit = byCode.get(op.code) ?? (op.kitId ? byId.get(op.kitId) : undefined) ?? null;
    return {
      ...op,
      kit: kit
        ? {
            name: kit.name,
            items: kit.items.map((i) => ({
              partNumber: i.part.partNumber,
              description: i.part.description,
              qty: i.qty,
              onHand: i.part.onHand,
            })),
          }
        : null,
    };
  });
}

export function toPartRows(parts: Part[]): PartRow[] {
  return parts.map((p) => ({
    ...p,
    lowStock: p.onHand <= p.reorderPoint,
    marginPct: p.cost > 0 ? Math.round(((p.sellPrice - p.cost) / p.cost) * 100) : null,
  }));
}

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function toTechnicianRows(techs: Technician[]): TechnicianRow[] {
  return techs.map((t) => {
    const { availability, ...rest } = t;
    let weeklyHours = 0;
    const days: string[] = [];
    for (const [day, windows] of Object.entries(availability)) {
      if (windows.length > 0) days.push(day);
      for (const [start, end] of windows) weeklyHours += end - start;
    }
    days.sort((a, b) => {
      const ia = WEEKDAY_ORDER.indexOf(a.slice(0, 3).toLowerCase());
      const ib = WEEKDAY_ORDER.indexOf(b.slice(0, 3).toLowerCase());
      return ia - ib;
    });
    return { ...rest, weeklyHours, days };
  });
}

export function toWorkOrderRows(workOrders: WorkOrderSummary[], vessels: Vessel[]): WorkOrderRow[] {
  const names = new Map(vessels.map((v) => [v.id, v.name]));
  return workOrders.map((w) => ({
    ...w,
    openedAt: w.openedAt.toISOString(),
    closedAt: w.closedAt ? w.closedAt.toISOString() : null,
    vesselName: names.get(w.vesselId) ?? "Unknown vessel",
  }));
}

export function toInvoiceRows(invoices: Invoice[], today: Date = DEMO_TODAY): InvoiceRow[] {
  return invoices.map((inv) => {
    const { customer, ...rest } = inv;
    const overdue = !inv.paidAt && inv.dueAt.getTime() < today.getTime();
    const payment: InvoicePayment = inv.paidAt ? "paid" : overdue ? "overdue" : "unpaid";
    return {
      ...rest,
      issuedAt: inv.issuedAt.toISOString(),
      dueAt: inv.dueAt.toISOString(),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      customerName: customer.name,
      payment,
      daysOverdue: overdue ? daysBetween(inv.dueAt, today) : 0,
    };
  });
}
