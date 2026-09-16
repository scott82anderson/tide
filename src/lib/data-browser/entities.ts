/**
 * The entities the /data page can browse. Slugs double as URL segments.
 */

export const ENTITY_SLUGS = [
  "operations",
  "vessels",
  "customers",
  "parts",
  "technicians",
  "work-orders",
  "invoices",
] as const;

export type EntitySlug = (typeof ENTITY_SLUGS)[number];

export function isEntitySlug(s: string): s is EntitySlug {
  return (ENTITY_SLUGS as readonly string[]).includes(s);
}

export const ENTITY_META: Record<EntitySlug, { label: string; noun: string; description: string }> = {
  operations: {
    label: "Operation codes",
    noun: "operation codes",
    description: "The service catalogue the AI selects from, with standard hours, intervals and parts kits.",
  },
  vessels: {
    label: "Vessels",
    noun: "vessels",
    description: "Boats in the yard, their engines and owners. Vessel matching ranks these against tech-note hints.",
  },
  customers: {
    label: "Customers",
    noun: "customers",
    description: "Owners, contact details, portal access and accounts receivable balance.",
  },
  parts: {
    label: "Parts",
    noun: "parts",
    description: "Inventory with cost, sell price, stock on hand and reorder points.",
  },
  technicians: {
    label: "Technicians",
    noun: "technicians",
    description: "Yard staff, roles, skills and weekly availability.",
  },
  "work-orders": {
    label: "Work orders",
    noun: "work orders",
    description: "Service history. Closed work orders drive the due-for-service predictions.",
  },
  invoices: {
    label: "Invoices",
    noun: "invoices",
    description: "Accounts receivable. Unpaid invoices past due feed the reminder queue.",
  },
};
