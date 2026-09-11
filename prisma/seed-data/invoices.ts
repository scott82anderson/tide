/**
 * About 80 invoices. Six are unpaid and overdue as of DEMO_TODAY (2026-09-14)
 * with ages 9, 22, 38, 47, 66 and 92 days; three are unpaid but not yet due.
 */

import { d, rng } from "./helpers";
import { vessels } from "./customers-vessels";
import { findWorkOrder, type WorkOrderRow } from "./work-orders";

export interface InvoiceRow {
  id: string;
  number: string;
  customerId: string;
  workOrderId: string | null;
  amount: number;
  issuedAt: Date;
  dueAt: Date;
  paidAt: Date | null;
  description: string;
}

const customerOfVessel = new Map(vessels.map((v) => [v.id, v.customerId]));
const DAY = 86400000;

interface Explicit { vesselId: string; closedAt: string; issued: string; due: string; amount: number; description: string; daysOverdue?: number }

/** dueAt = DEMO_TODAY minus daysOverdue; issuedAt = dueAt minus 30 days. */
const overdue: Explicit[] = [
  { vesselId: "ves_la_sirena", closedAt: "2026-05-14", issued: "2026-05-15", due: "2026-06-14", amount: 3860.0, description: "Port exhaust manifold and riser replacement", daysOverdue: 92 },
  { vesselId: "ves_tenacity", closedAt: "2026-06-09", issued: "2026-06-10", due: "2026-07-10", amount: 6900.0, description: "Starboard sea water pump and heat exchanger service", daysOverdue: 66 },
  { vesselId: "ves_reel_estate", closedAt: "2026-06-28", issued: "2026-06-29", due: "2026-07-29", amount: 1240.5, description: "Port trim tab actuator, bleed steering", daysOverdue: 47 },
  { vesselId: "ves_irish_wake", closedAt: "2026-07-07", issued: "2026-07-08", due: "2026-08-07", amount: 2150.75, description: "Fuel filters and serpentine belts, both engines", daysOverdue: 38 },
  { vesselId: "ves_daydream", closedAt: "2026-07-23", issued: "2026-07-24", due: "2026-08-23", amount: 685.0, description: "Bilge pump and float switch", daysOverdue: 22 },
  { vesselId: "ves_wanderlust", closedAt: "2026-08-05", issued: "2026-08-06", due: "2026-09-05", amount: 480.0, description: "Replace bow and stern navigation lights", daysOverdue: 9 },
];

const unpaidNotDue: Explicit[] = [
  { vesselId: "ves_carpe_diem", closedAt: "2026-08-20", issued: "2026-08-20", due: "2026-09-19", amount: 1980.0, description: "100 hour service, both F300s" },
  { vesselId: "ves_seas_the_day", closedAt: "2026-08-27", issued: "2026-08-27", due: "2026-09-26", amount: 2640.0, description: "Annual oil service and engine anodes" },
  { vesselId: "ves_fika", closedAt: "2026-09-04", issued: "2026-09-04", due: "2026-10-04", amount: 760.0, description: "Replace fresh water pump" },
];

export function buildInvoices(workOrders: WorkOrderRow[]) {
  const r = rng(80);
  const rows: Omit<InvoiceRow, "id" | "number">[] = [];
  const invoicedWo = new Set<string>();

  for (const e of [...overdue, ...unpaidNotDue]) {
    const wo = findWorkOrder(workOrders, e.vesselId, e.closedAt);
    invoicedWo.add(wo.id);
    rows.push({
      customerId: customerOfVessel.get(e.vesselId)!,
      workOrderId: wo.id,
      amount: e.amount,
      // Noon UTC so the day count against DEMO_TODAY (13:00Z) lands exactly.
      issuedAt: d(e.issued, 12),
      dueAt: d(e.due, 12),
      paidAt: null,
      description: e.description,
    });
  }

  // Paid invoices for closed work orders from 2024 onward.
  const candidates = workOrders
    .filter((w) => w.status === "closed" && w.closedAt && w.closedAt >= d("2024-01-01") && !invoicedWo.has(w.id))
    .sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  for (const wo of candidates) {
    if (rows.length >= 80) break;
    if (!r.chance(0.8)) continue;
    const issuedAt = new Date(wo.closedAt!.getTime() + DAY);
    const dueAt = new Date(issuedAt.getTime() + 30 * DAY);
    // Mostly paid before due, sometimes a little late.
    const offset = r.chance(0.75) ? -r.int(0, 25) : r.int(1, 20);
    const paidAt = new Date(dueAt.getTime() + offset * DAY);
    rows.push({
      customerId: customerOfVessel.get(wo.vesselId)!,
      workOrderId: wo.id,
      amount: wo.total,
      issuedAt,
      dueAt,
      paidAt,
      description: wo.description,
    });
  }

  rows.sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
  const counters: Record<string, number> = {};
  const invoices: InvoiceRow[] = rows.map((row) => {
    const year = String(row.issuedAt.getUTCFullYear());
    counters[year] = (counters[year] ?? 0) + r.int(1, 5);
    const number = `INV-${year}-${String(counters[year]).padStart(4, "0")}`;
    return { id: number, number, ...row };
  });

  // AR balance per customer = sum of unpaid invoices.
  const arByCustomer = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.paidAt) continue;
    arByCustomer.set(inv.customerId, Math.round(((arByCustomer.get(inv.customerId) ?? 0) + inv.amount) * 100) / 100);
  }

  return { invoices, arByCustomer };
}
