/**
 * Server-side loader for the /data pages. Fetches every browsable entity
 * through the DockMasterClient so the entity chips can show counts, and
 * serialises rows for the client component.
 */

import type { DockMasterClient } from "@/lib/dockmaster/client";
import { ENTITY_SLUGS, type EntitySlug } from "./entities";
import {
  toInvoiceRows,
  toOperationRows,
  toPartRows,
  toTechnicianRows,
  toWorkOrderRows,
  type EntityRows,
} from "./rows";

export interface DataPayload {
  rows: EntityRows;
  counts: Record<EntitySlug, number>;
}

export async function loadDataPayload(client: DockMasterClient): Promise<DataPayload> {
  const [ops, kits, vessels, customers, parts, technicians, workOrders, invoices] = await Promise.all([
    client.listOperationCodes(),
    client.listPartsKits(),
    client.listVessels(),
    client.listCustomers(),
    client.listParts(),
    client.listTechnicians(),
    client.listWorkOrders(),
    client.listInvoices(),
  ]);

  const rows: EntityRows = {
    operations: toOperationRows(ops, kits),
    vessels,
    customers,
    parts: toPartRows(parts),
    technicians: toTechnicianRows(technicians),
    "work-orders": toWorkOrderRows(workOrders, vessels),
    invoices: toInvoiceRows(invoices),
  };

  const counts = Object.fromEntries(ENTITY_SLUGS.map((slug) => [slug, rows[slug].length])) as Record<
    EntitySlug,
    number
  >;

  return { rows, counts };
}
