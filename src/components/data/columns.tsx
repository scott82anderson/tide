"use client";

/**
 * Column, facet and detail-row definitions for every entity on /data.
 * This registry lives on the client because it contains render functions;
 * the server page only passes an entity slug and serialised rows.
 */

import { Badge } from "@/components/ui/badge";
import { TONE_CLASS, type Tone } from "@/components/status-badge";
import type { EntitySlug } from "@/lib/data-browser/entities";
import type { FacetSpec, SortDir, SortValue } from "@/lib/data-browser/filter";
import type {
  CustomerRow,
  EntityRowMap,
  InvoicePayment,
  InvoiceRow,
  OperationRow,
  PartRow,
  TechnicianRow,
  VesselRow,
  WorkOrderRow,
} from "@/lib/data-browser/rows";
import { formatDate } from "@/lib/demo-date";
import { cn, formatHours, formatMoney } from "@/lib/utils";

export interface ColumnDef<Row> {
  /** Stable key used in `?sort=`. */
  key: string;
  header: string;
  render: (row: Row) => React.ReactNode;
  /** Absent means the column is not sortable. */
  sortValue?: (row: Row) => SortValue;
  className?: string;
}

export type FacetDef<Row> = FacetSpec<Row> & {
  label: string;
  kind: "select" | "toggle";
  /** "distinct" derives options from the rows; toggles ignore this. */
  options: "distinct" | { value: string; label: string }[];
};

export interface EntityConfig<Row> {
  rowKey: (row: Row) => string;
  searchFields: (row: Row) => unknown[];
  columns: ColumnDef<Row>[];
  facets: FacetDef<Row>[];
  defaultSort: { key: string; dir: SortDir };
  /** Expandable panel under the row. Absent means no chevron column. */
  detail?: (row: Row) => React.ReactNode;
}

// ---------- shared bits ----------

const NUM = "text-right tabular-nums";
const MONO = "font-mono text-xs";

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[tone], className)}>
      {children}
    </Badge>
  );
}

function Chips({ values }: { values: string[] }) {
  if (values.length === 0) return <Dash />;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="font-normal">
          {v}
        </Badge>
      ))}
    </div>
  );
}

function DetailGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MiniTable({
  caption,
  headers,
  rows,
  align,
}: {
  caption: string;
  headers: string[];
  rows: React.ReactNode[][];
  /** Indexes of right-aligned numeric columns. */
  align?: number[];
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{caption}</div>
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {headers.map((h, i) => (
                <th key={h} className={cn("px-2 py-1 font-medium", align?.includes(i) && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, r) => (
              <tr key={r} className="border-b last:border-0">
                {cells.map((c, i) => (
                  <td key={i} className={cn("px-2 py-1", align?.includes(i) && NUM)}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- operations ----------

const operations: EntityConfig<OperationRow> = {
  rowKey: (r) => r.id,
  searchFields: (r) => [
    r.code,
    r.description,
    r.category,
    r.keywords,
    r.kit?.name,
    r.kit?.items.map((i) => i.partNumber),
  ],
  columns: [
    { key: "code", header: "Code", render: (r) => r.code, sortValue: (r) => r.code, className: MONO },
    { key: "description", header: "Description", render: (r) => r.description, sortValue: (r) => r.description },
    {
      key: "category",
      header: "Category",
      render: (r) => <ToneBadge tone="neutral">{r.category}</ToneBadge>,
      sortValue: (r) => r.category,
    },
    {
      key: "hours",
      header: "Std hours",
      render: (r) => formatHours(r.standardHours),
      sortValue: (r) => r.standardHours,
      className: NUM,
    },
    {
      key: "rate",
      header: "Rate",
      render: (r) =>
        r.laborRate === null ? <span className="text-muted-foreground">yard rate</span> : formatMoney(r.laborRate),
      sortValue: (r) => r.laborRate,
      className: NUM,
    },
    {
      key: "interval",
      header: "Interval",
      render: (r) => (r.maintenanceIntervalMonths === null ? <Dash /> : `${r.maintenanceIntervalMonths} mo`),
      sortValue: (r) => r.maintenanceIntervalMonths,
      className: NUM,
    },
    {
      key: "kit",
      header: "Kit",
      render: (r) => (r.kit ? `${r.kit.items.length} ${r.kit.items.length === 1 ? "part" : "parts"}` : <Dash />),
      sortValue: (r) => (r.kit ? r.kit.items.length : null),
      className: NUM,
    },
  ],
  facets: [
    { key: "category", label: "Category", kind: "select", options: "distinct", value: (r) => r.category },
    { key: "kit", label: "Has kit", kind: "toggle", options: [], value: (r) => (r.kit ? "true" : "false") },
  ],
  defaultSort: { key: "code", dir: "asc" },
  detail: (r) => (
    <div className="space-y-3">
      <DetailGrid
        items={[
          { label: "Keywords", value: <Chips values={r.keywords} /> },
          {
            label: "Maintenance interval",
            value: r.maintenanceIntervalMonths === null ? "None" : `Every ${r.maintenanceIntervalMonths} months`,
          },
          {
            label: "Labor rate",
            value: r.laborRate === null ? "Marina default" : `${formatMoney(r.laborRate)} / h (override)`,
          },
          { label: "Kit", value: r.kit ? r.kit.name : "No parts kit" },
        ]}
      />
      {r.kit && (
        <MiniTable
          caption={`Parts kit: ${r.kit.name}`}
          headers={["Part no.", "Description", "Qty", "On hand"]}
          align={[2, 3]}
          rows={r.kit.items.map((i) => [
            <span key="pn" className={MONO}>
              {i.partNumber}
            </span>,
            i.description,
            i.qty,
            <span key="oh" className={cn(i.onHand < i.qty && "font-medium text-destructive")}>
              {i.onHand}
            </span>,
          ])}
        />
      )}
    </div>
  ),
};

// ---------- vessels ----------

const vessels: EntityConfig<VesselRow> = {
  rowKey: (r) => r.id,
  searchFields: (r) => [
    r.name,
    r.make,
    r.model,
    r.year,
    r.hin,
    r.engineMake,
    r.engineModel,
    r.location,
    r.customer.name,
  ],
  columns: [
    { key: "name", header: "Vessel", render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    {
      key: "boat",
      header: "Year / make / model",
      render: (r) => `${r.year} ${r.make} ${r.model}`,
      sortValue: (r) => `${r.make} ${r.model} ${r.year}`,
    },
    { key: "length", header: "Length", render: (r) => `${r.lengthFt} ft`, sortValue: (r) => r.lengthFt, className: NUM },
    {
      key: "engine",
      header: "Engine",
      render: (r) => `${r.engineCount > 1 ? `${r.engineCount}× ` : ""}${r.engineMake} ${r.engineModel}`,
      sortValue: (r) => `${r.engineMake} ${r.engineModel}`,
    },
    {
      key: "hours",
      header: "Eng. hours",
      render: (r) => r.engineHours.toLocaleString("en-US"),
      sortValue: (r) => r.engineHours,
      className: NUM,
    },
    { key: "location", header: "Location", render: (r) => r.location, sortValue: (r) => r.location },
    { key: "owner", header: "Owner", render: (r) => r.customer.name, sortValue: (r) => r.customer.name },
  ],
  facets: [
    { key: "engine", label: "Engine make", kind: "select", options: "distinct", value: (r) => r.engineMake },
    { key: "make", label: "Boat make", kind: "select", options: "distinct", value: (r) => r.make },
  ],
  defaultSort: { key: "name", dir: "asc" },
  detail: (r) => (
    <DetailGrid
      items={[
        { label: "HIN", value: <span className={MONO}>{r.hin}</span> },
        {
          label: "Engine",
          value: `${r.engineCount} × ${r.engineMake} ${r.engineModel}, ${r.engineHours.toLocaleString("en-US")} h`,
        },
        { label: "Owner", value: r.customer.name },
        {
          label: "Contact",
          value: (
            <div className="text-sm">
              <div>{r.customer.email}</div>
              <div className="text-muted-foreground">{r.customer.phone}</div>
            </div>
          ),
        },
      ]}
    />
  ),
};

// ---------- customers ----------

const customers: EntityConfig<CustomerRow> = {
  rowKey: (r) => r.id,
  searchFields: (r) => [r.name, r.email, r.phone],
  columns: [
    { key: "name", header: "Customer", render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: "email", header: "Email", render: (r) => r.email, sortValue: (r) => r.email },
    { key: "phone", header: "Phone", render: (r) => r.phone, sortValue: (r) => r.phone, className: "tabular-nums" },
    {
      key: "portal",
      header: "Portal",
      render: (r) =>
        r.portalEnabled ? <ToneBadge tone="success">Enabled</ToneBadge> : <ToneBadge tone="neutral">Off</ToneBadge>,
      sortValue: (r) => (r.portalEnabled ? 1 : 0),
    },
    {
      key: "ar",
      header: "AR balance",
      render: (r) => (
        <span className={cn(r.arBalance > 0 && "font-medium text-destructive")}>{formatMoney(r.arBalance)}</span>
      ),
      sortValue: (r) => r.arBalance,
      className: NUM,
    },
  ],
  facets: [
    {
      key: "portal",
      label: "Portal",
      kind: "select",
      options: [
        { value: "enabled", label: "Enabled" },
        { value: "disabled", label: "Disabled" },
      ],
      value: (r) => (r.portalEnabled ? "enabled" : "disabled"),
    },
    { key: "owing", label: "Has AR balance", kind: "toggle", options: [], value: (r) => (r.arBalance > 0 ? "true" : "false") },
  ],
  defaultSort: { key: "name", dir: "asc" },
};

// ---------- parts ----------

const parts: EntityConfig<PartRow> = {
  rowKey: (r) => r.id,
  searchFields: (r) => [r.partNumber, r.description, r.vendor, r.binLocation, r.fitsEngineMakes],
  columns: [
    { key: "partNumber", header: "Part no.", render: (r) => r.partNumber, sortValue: (r) => r.partNumber, className: MONO },
    { key: "description", header: "Description", render: (r) => r.description, sortValue: (r) => r.description },
    { key: "vendor", header: "Vendor", render: (r) => r.vendor, sortValue: (r) => r.vendor },
    { key: "cost", header: "Cost", render: (r) => formatMoney(r.cost), sortValue: (r) => r.cost, className: NUM },
    { key: "sell", header: "Sell", render: (r) => formatMoney(r.sellPrice), sortValue: (r) => r.sellPrice, className: NUM },
    {
      key: "margin",
      header: "Margin",
      render: (r) => (r.marginPct === null ? <Dash /> : `${r.marginPct}%`),
      sortValue: (r) => r.marginPct,
      className: NUM,
    },
    {
      key: "onHand",
      header: "On hand",
      render: (r) =>
        r.lowStock ? (
          <ToneBadge tone="warning" className="tabular-nums">
            {r.onHand}
          </ToneBadge>
        ) : (
          r.onHand
        ),
      sortValue: (r) => r.onHand,
      className: NUM,
    },
    { key: "bin", header: "Bin", render: (r) => r.binLocation, sortValue: (r) => r.binLocation, className: MONO },
  ],
  facets: [
    { key: "vendor", label: "Vendor", kind: "select", options: "distinct", value: (r) => r.vendor },
    { key: "low", label: "Low stock", kind: "toggle", options: [], value: (r) => (r.lowStock ? "true" : "false") },
  ],
  defaultSort: { key: "partNumber", dir: "asc" },
  detail: (r) => (
    <DetailGrid
      items={[
        { label: "Fits engine makes", value: <Chips values={r.fitsEngineMakes} /> },
        {
          label: "Stock",
          value: `${r.onHand} on hand, reorder at ${r.reorderPoint}${r.lowStock ? " (at or below reorder point)" : ""}`,
        },
        {
          label: "Pricing",
          value: `${formatMoney(r.cost)} cost, ${formatMoney(r.sellPrice)} sell${r.marginPct === null ? "" : ` (${r.marginPct}% margin)`}`,
        },
        { label: "Bin location", value: <span className={MONO}>{r.binLocation}</span> },
      ]}
    />
  ),
};

// ---------- technicians ----------

const ROLE_LABEL: Record<string, string> = {
  technician: "Technician",
  lead_tech: "Lead tech",
  service_manager: "Service manager",
};

const technicians: EntityConfig<TechnicianRow> = {
  rowKey: (r) => r.id,
  searchFields: (r) => [r.name, r.role, ROLE_LABEL[r.role], r.skills],
  columns: [
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: "role", header: "Role", render: (r) => ROLE_LABEL[r.role] ?? r.role, sortValue: (r) => r.role },
    { key: "skills", header: "Skills", render: (r) => <Chips values={r.skills} /> },
    {
      key: "cost",
      header: "Hourly cost",
      render: (r) => formatMoney(r.hourlyCost),
      sortValue: (r) => r.hourlyCost,
      className: NUM,
    },
    {
      key: "hours",
      header: "Weekly hours",
      render: (r) => `${r.weeklyHours} h`,
      sortValue: (r) => r.weeklyHours,
      className: NUM,
    },
    {
      key: "days",
      header: "Days",
      render: (r) => r.days.map((d) => d.slice(0, 3)).join(", "),
      sortValue: (r) => r.days.length,
    },
  ],
  facets: [
    {
      key: "role",
      label: "Role",
      kind: "select",
      options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })),
      value: (r) => r.role,
    },
    { key: "skill", label: "Skill", kind: "select", options: "distinct", value: (r) => r.skills },
  ],
  defaultSort: { key: "name", dir: "asc" },
};

// ---------- work orders ----------

const WO_TONE: Record<string, Tone> = {
  closed: "success",
  in_progress: "warning",
  scheduled: "ai",
  open: "neutral",
};

const WO_LABEL: Record<string, string> = {
  closed: "Closed",
  in_progress: "In progress",
  scheduled: "Scheduled",
  open: "Open",
};

const workOrders: EntityConfig<WorkOrderRow> = {
  rowKey: (r) => r.id,
  searchFields: (r) => [
    r.number,
    r.description,
    r.vesselName,
    r.technicianName,
    r.status,
    r.operations.map((o) => o.code),
    r.parts.map((p) => p.partNumber),
  ],
  columns: [
    { key: "number", header: "Work order", render: (r) => r.number, sortValue: (r) => r.number, className: MONO },
    { key: "vessel", header: "Vessel", render: (r) => <span className="font-medium">{r.vesselName}</span>, sortValue: (r) => r.vesselName },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="block max-w-[320px] truncate">{r.description}</span>,
      sortValue: (r) => r.description,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <ToneBadge tone={WO_TONE[r.status] ?? "neutral"}>{WO_LABEL[r.status] ?? r.status}</ToneBadge>,
      sortValue: (r) => r.status,
    },
    {
      key: "tech",
      header: "Technician",
      render: (r) => r.technicianName ?? <span className="text-muted-foreground">Unassigned</span>,
      sortValue: (r) => r.technicianName,
    },
    { key: "opened", header: "Opened", render: (r) => formatDate(r.openedAt), sortValue: (r) => r.openedAt },
    {
      key: "closed",
      header: "Closed",
      render: (r) => (r.closedAt ? formatDate(r.closedAt) : <Dash />),
      sortValue: (r) => r.closedAt,
    },
    { key: "hours", header: "Hours", render: (r) => formatHours(r.hoursBilled), sortValue: (r) => r.hoursBilled, className: NUM },
    { key: "total", header: "Total", render: (r) => formatMoney(r.total), sortValue: (r) => r.total, className: NUM },
  ],
  facets: [
    {
      key: "status",
      label: "Status",
      kind: "select",
      options: Object.entries(WO_LABEL).map(([value, label]) => ({ value, label })),
      value: (r) => r.status,
    },
    { key: "tech", label: "Technician", kind: "select", options: "distinct", value: (r) => r.technicianName },
  ],
  defaultSort: { key: "opened", dir: "desc" },
  detail: (r) => (
    <div className="grid gap-4 lg:grid-cols-2">
      {r.operations.length > 0 ? (
        <MiniTable
          caption="Operations"
          headers={["Code", "Description", "Category", "Hours"]}
          align={[3]}
          rows={r.operations.map((o) => [
            <span key="c" className={MONO}>
              {o.code}
            </span>,
            o.description,
            o.category,
            formatHours(o.hours),
          ])}
        />
      ) : (
        <div className="text-sm text-muted-foreground">No operations recorded.</div>
      )}
      {r.parts.length > 0 ? (
        <MiniTable
          caption="Parts"
          headers={["Part no.", "Description", "Qty"]}
          align={[2]}
          rows={r.parts.map((p) => [
            <span key="p" className={MONO}>
              {p.partNumber}
            </span>,
            p.description,
            p.qty,
          ])}
        />
      ) : (
        <div className="text-sm text-muted-foreground">No parts recorded.</div>
      )}
      {r.description && (
        <div className="text-sm lg:col-span-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Description</div>
          {r.description}
        </div>
      )}
    </div>
  ),
};

// ---------- invoices ----------

const PAY_TONE: Record<InvoicePayment, Tone> = { paid: "success", unpaid: "neutral", overdue: "destructive" };
const PAY_LABEL: Record<InvoicePayment, string> = { paid: "Paid", unpaid: "Unpaid", overdue: "Overdue" };

const invoices: EntityConfig<InvoiceRow> = {
  rowKey: (r) => r.id,
  searchFields: (r) => [r.number, r.customerName, r.workOrderNumber, r.description, r.payment],
  columns: [
    { key: "number", header: "Invoice", render: (r) => r.number, sortValue: (r) => r.number, className: MONO },
    { key: "customer", header: "Customer", render: (r) => <span className="font-medium">{r.customerName}</span>, sortValue: (r) => r.customerName },
    {
      key: "wo",
      header: "Work order",
      render: (r) => r.workOrderNumber ?? <Dash />,
      sortValue: (r) => r.workOrderNumber,
      className: MONO,
    },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="block max-w-[320px] truncate">{r.description}</span>,
      sortValue: (r) => r.description,
    },
    { key: "amount", header: "Amount", render: (r) => formatMoney(r.amount), sortValue: (r) => r.amount, className: NUM },
    { key: "issued", header: "Issued", render: (r) => formatDate(r.issuedAt), sortValue: (r) => r.issuedAt },
    { key: "due", header: "Due", render: (r) => formatDate(r.dueAt), sortValue: (r) => r.dueAt },
    {
      key: "payment",
      header: "Payment",
      render: (r) => (
        <ToneBadge tone={PAY_TONE[r.payment]}>
          {PAY_LABEL[r.payment]}
          {r.payment === "overdue" && ` · ${r.daysOverdue} d`}
        </ToneBadge>
      ),
      sortValue: (r) => (r.payment === "overdue" ? 2 : r.payment === "unpaid" ? 1 : 0),
    },
  ],
  facets: [
    {
      key: "pay",
      label: "Payment",
      kind: "select",
      options: (Object.keys(PAY_LABEL) as InvoicePayment[]).map((value) => ({ value, label: PAY_LABEL[value] })),
      value: (r) => r.payment,
    },
  ],
  defaultSort: { key: "issued", dir: "desc" },
};

export const ENTITY_CONFIGS: { [K in EntitySlug]: EntityConfig<EntityRowMap[K]> } = {
  operations,
  vessels,
  customers,
  parts,
  technicians,
  "work-orders": workOrders,
  invoices,
};
