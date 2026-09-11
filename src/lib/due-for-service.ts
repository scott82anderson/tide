import { DEMO_TODAY, monthsBetween } from "@/lib/demo-date";
import type {
  DueForServiceItem,
  OperationCode,
  Vessel,
  WorkOrderSummary,
} from "@/lib/dockmaster/types";

/**
 * Interval-based service predictions. For each vessel, look at the last closed
 * work order for every operation that has a manufacturer or yard interval, and
 * flag those where the interval has elapsed as of DEMO_TODAY.
 *
 * Pure function: the DockMasterClient supplies vessels, their history and the
 * operation catalogue. A production version would also weight engine hours.
 */
export function predictDueForService(
  vessels: Vessel[],
  historyByVessel: Map<string, WorkOrderSummary[]>,
  operationCodes: OperationCode[],
  today: Date = DEMO_TODAY,
): DueForServiceItem[] {
  const intervalOps = operationCodes.filter((o) => o.maintenanceIntervalMonths);
  const byCode = new Map(intervalOps.map((o) => [o.code, o]));
  const items: DueForServiceItem[] = [];

  for (const vessel of vessels) {
    const history = (historyByVessel.get(vessel.id) ?? []).filter(
      (wo) => wo.status === "closed" && wo.closedAt,
    );
    const lastDone = new Map<string, { at: Date; number: string }>();
    for (const wo of history) {
      for (const op of wo.operations) {
        if (!byCode.has(op.code)) continue;
        const prev = lastDone.get(op.code);
        const at = wo.closedAt as Date;
        if (!prev || at > prev.at) lastDone.set(op.code, { at, number: wo.number });
      }
    }

    for (const [code, last] of lastDone) {
      const op = byCode.get(code)!;
      const interval = op.maintenanceIntervalMonths as number;
      const monthsSince = monthsBetween(last.at, today);
      const monthsOverdue = monthsSince - interval;
      if (monthsOverdue >= 0) {
        items.push({
          vessel,
          operation: op,
          lastDoneAt: last.at,
          lastWorkOrderNumber: last.number,
          monthsSince,
          intervalMonths: interval,
          monthsOverdue,
        });
      }
    }
  }

  // Most overdue first; one line per vessel/operation pair.
  items.sort(
    (a, b) => b.monthsOverdue - a.monthsOverdue || a.vessel.name.localeCompare(b.vessel.name),
  );
  return items;
}

/** Same computation for a single vessel, used by the estimate builder's history flags. */
export function intervalStatus(
  history: WorkOrderSummary[],
  operation: OperationCode,
  today: Date = DEMO_TODAY,
): { lastDoneAt: Date | null; workOrderNumber: string | null; monthsSince: number | null } {
  let best: { at: Date; number: string } | null = null;
  for (const wo of history) {
    if (wo.status !== "closed" || !wo.closedAt) continue;
    if (!wo.operations.some((o) => o.code === operation.code)) continue;
    if (!best || wo.closedAt > best.at) best = { at: wo.closedAt, number: wo.number };
  }
  if (!best) return { lastDoneAt: null, workOrderNumber: null, monthsSince: null };
  return {
    lastDoneAt: best.at,
    workOrderNumber: best.number,
    monthsSince: monthsBetween(best.at, today),
  };
}
