import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEMO_TODAY } from "../src/lib/demo-date";
import { d, json } from "./seed-data/helpers";
import { marina, technicians } from "./seed-data/technicians";
import { customers, vesselRows, vessels } from "./seed-data/customers-vessels";
import { operationCodes } from "./seed-data/operation-codes";
import { parts } from "./seed-data/parts";
import { buildWorkOrders, controlledVessels } from "./seed-data/work-orders";
import { buildInvoices } from "./seed-data/invoices";
import { buildScheduleBlocks } from "./seed-data/schedule";
import { seedGtm } from "./seed-data/gtm";

const prisma = new PrismaClient();

async function clear() {
  // Dependency-safe order: children before parents. GTM tables are cleared by seedGtm.
  await prisma.activityLog.deleteMany();
  await prisma.scheduleBlock.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.workOrderPart.deleteMany();
  await prisma.workOrderOperation.deleteMany();
  await prisma.estimateLine.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.techNote.deleteMany();
  await prisma.kitItem.deleteMany();
  await prisma.operationCode.deleteMany();
  await prisma.partsKit.deleteMany();
  await prisma.part.deleteMany();
  await prisma.vessel.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.marina.deleteMany();
}

async function main() {
  const started = Date.now();
  await clear();

  await prisma.marina.create({ data: marina });
  await prisma.technician.createMany({ data: technicians });

  // Parts and kits before operation codes (OperationCode.kitId references PartsKit).
  await prisma.part.createMany({
    data: parts.map((p) => ({
      id: p.partNumber,
      partNumber: p.partNumber,
      description: p.description,
      vendor: p.vendor,
      cost: p.cost,
      sellPrice: p.sellPrice,
      onHand: p.onHand,
      reorderPoint: p.reorderPoint,
      binLocation: p.binLocation,
      fitsEngineMakes: json(p.fitsEngineMakes),
    })),
  });

  const partNumbers = new Set(parts.map((p) => p.partNumber));
  const withKits = operationCodes.filter((o) => o.kit);
  await prisma.partsKit.createMany({
    data: withKits.map((o) => ({ id: `kit_${o.code}`, name: `${o.description} kit` })),
  });
  await prisma.kitItem.createMany({
    data: withKits.flatMap((o) =>
      Object.entries(o.kit!).map(([partId, qty]) => {
        if (!partNumbers.has(partId)) throw new Error(`Kit for ${o.code} references unknown part ${partId}`);
        return { kitId: `kit_${o.code}`, partId, qty };
      }),
    ),
  });
  await prisma.operationCode.createMany({
    data: operationCodes.map((o) => ({
      id: o.code,
      code: o.code,
      description: o.description,
      category: o.category,
      standardHours: o.standardHours,
      laborRate: o.laborRate ?? null,
      keywords: json(o.keywords),
      maintenanceIntervalMonths: o.maintenanceIntervalMonths ?? null,
      kitId: o.kit ? `kit_${o.code}` : null,
    })),
  });

  // Work orders, then invoices (which set AR balances), then customers/vessels.
  const { workOrders, operations, woParts } = buildWorkOrders();
  const { invoices, arByCustomer } = buildInvoices(workOrders);

  await prisma.customer.createMany({
    data: customers.map((c) => ({ ...c, arBalance: arByCustomer.get(c.id) ?? 0 })),
  });
  await prisma.vessel.createMany({ data: vesselRows });

  await prisma.workOrder.createMany({ data: workOrders });
  await prisma.workOrderOperation.createMany({ data: operations });
  await prisma.workOrderPart.createMany({ data: woParts });
  await prisma.invoice.createMany({ data: invoices });
  await prisma.scheduleBlock.createMany({ data: buildScheduleBlocks(workOrders) });

  const openWos = workOrders.filter((w) => w.status !== "closed");
  await prisma.activityLog.createMany({
    data: [
      { actor: "staff", action: "work_order.opened", entityType: "work_order", entityId: openWos[0].id, payload: json({ by: "Lena Okafor" }), createdAt: openWos[0].openedAt },
      { actor: "staff", action: "work_order.assigned", entityType: "work_order", entityId: openWos[1].id, payload: json({ technicianId: openWos[1].technicianId }), createdAt: openWos[1].openedAt },
      { actor: "staff", action: "work_order.opened", entityType: "work_order", entityId: openWos[5].id, payload: json({ by: "Lena Okafor" }), createdAt: openWos[5].openedAt },
      { actor: "customer", action: "estimate.signed", entityType: "estimate", entityId: "EST-2026-0097", payload: json({ signedBy: "Beth Thornton", vesselId: "ves_carpe_diem" }), createdAt: d("2026-08-12") },
      { actor: "staff", action: "invoice.reminder_sent", entityType: "invoice", entityId: invoices.find((i) => i.workOrderId?.startsWith("WO-2026") && !i.paidAt)?.id ?? invoices[0].id, payload: json({ channel: "email", by: "Lena Okafor" }), createdAt: d("2026-08-28") },
    ],
  });

  // Go-to-market workspace: accounts, signals, telemetry, and the agent history.
  await seedGtm(prisma);

  // ----------------------------------------------------------- summary
  const counts = {
    marina: await prisma.marina.count(),
    technicians: await prisma.technician.count(),
    customers: await prisma.customer.count(),
    vessels: await prisma.vessel.count(),
    operationCodes: await prisma.operationCode.count(),
    partsKits: await prisma.partsKit.count(),
    kitItems: await prisma.kitItem.count(),
    parts: await prisma.part.count(),
    workOrders: await prisma.workOrder.count(),
    workOrderOperations: await prisma.workOrderOperation.count(),
    workOrderParts: await prisma.workOrderPart.count(),
    invoices: await prisma.invoice.count(),
    scheduleBlocks: await prisma.scheduleBlock.count(),
    activityLog: await prisma.activityLog.count(),
    gtmAccounts: await prisma.account.count(),
    gtmSignals: await prisma.accountSignal.count(),
    gtmAgentRuns: await prisma.agentRun.count(),
    gtmQueueItems: await prisma.queueItem.count(),
    gtmOutbound: await prisma.outboundMessage.count(),
  };
  console.log(`Seeded in ${Date.now() - started} ms (demo today: ${DEMO_TODAY.toISOString().slice(0, 10)})`);
  console.table(counts);

  const overdue = invoices
    .filter((i) => !i.paidAt && i.dueAt < DEMO_TODAY)
    .map((i) => ({
      number: i.number,
      customer: customers.find((c) => c.id === i.customerId)?.name,
      amount: i.amount,
      daysOverdue: Math.floor((DEMO_TODAY.getTime() - i.dueAt.getTime()) / 86400000),
    }));
  console.log("Overdue invoices:");
  console.table(overdue);

  console.log("Due-for-service vessels (hand-set history):");
  console.table(
    [...controlledVessels].map((id) => ({
      vessel: vessels.find((v) => v.id === id)?.name,
      lastJobs: workOrders
        .filter((w) => w.vesselId === id && w.closedAt && w.closedAt < d("2025-07-01"))
        .map((w) => `${w.number} ${w.closedAt!.toISOString().slice(0, 10)}`)
        .join(", "),
    })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
