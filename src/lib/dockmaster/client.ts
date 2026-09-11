/**
 * DockMasterClient: the boundary between the Service Writer and the DockMaster
 * system of record.
 *
 * Every read and write the feature needs goes through this interface. The
 * prototype ships one implementation, `PrismaDockMasterClient` (mock-client.ts),
 * backed by a local database seeded with realistic yard data. Nothing under
 * lib/ai imports Prisma directly; the pipeline only ever sees this interface.
 *
 * How a production implementation would bind to the DockMaster Web 2.0 API
 * --------------------------------------------------------------------------
 * DockMaster Web exposes the same entities this interface returns. A
 * `HttpDockMasterClient` would map each method to a REST call, translate the
 * wire shapes into the types in ./types.ts, and keep the pipeline unchanged:
 *
 *   findVesselByHint        GET  /api/v1/vessels?hin_suffix=&slip=&owner=&make=
 *                           (or a client-side rank over GET /vessels for a
 *                           single-location yard; see match-rules.ts)
 *   getVesselHistory        GET  /api/v1/vessels/{id}/work-orders?status=closed
 *   listOperationCodes      GET  /api/v1/service/operation-codes (cache 1 h)
 *   getPartsKit             GET  /api/v1/service/operation-codes/{code}/kit
 *   getPartStock            GET  /api/v1/inventory/parts?numbers=a,b,c
 *   createEstimate          POST /api/v1/service/estimates
 *   updateEstimate          PATCH /api/v1/service/estimates/{id}
 *   sendEstimateForSignature POST /api/v1/service/estimates/{id}/send
 *                           (DockMaster eSignature; the portal page in this
 *                           prototype simulates the customer side)
 *   convertToWorkOrder      POST /api/v1/service/estimates/{id}/convert
 *   listVesselsDueForService derived: closed work orders + operation intervals,
 *                           or DockMaster's own service reminder report if enabled
 *   listOverdueInvoices     GET  /api/v1/ar/invoices?status=open&past_due=true
 *   createPaymentLink       POST /api/v1/valpay/payment-links  (ValPay)
 *   logActivity             POST /api/v1/activity  (or the audit log endpoint)
 *   scheduling              handed to the existing AI Scheduling Assistant:
 *                           POST /api/v1/scheduling/suggestions {workOrderId}
 *
 * Auth would be an OAuth client-credentials token per tenant, injected by the
 * constructor. Tenant scoping is a header on every call, so multi-marina
 * support is a constructor argument rather than a change to this interface.
 *
 * Guardrail note: the LLM never sees this client. It only ever selects from
 * lists this client returns (vessels, operation codes, kit parts). Prices,
 * part numbers and codes cannot be invented because they are copied from these
 * responses after validation.
 */

import type {
  ActivityEntry,
  ActivityInput,
  Customer,
  DashboardCounts,
  DueForServiceItem,
  Estimate,
  EstimateInput,
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

export interface DockMasterClient {
  // Yard configuration
  getMarina(): Promise<Marina>;
  listTechnicians(): Promise<Technician[]>;
  getTechnician(id: string): Promise<Technician | null>;

  // Vessels and history
  listVessels(): Promise<Vessel[]>;
  getVessel(id: string): Promise<Vessel | null>;
  findVesselByHint(hint: VesselHint): Promise<VesselMatchCandidate[]>;
  getVesselHistory(vesselId: string): Promise<WorkOrderSummary[]>;

  // Service catalogue and inventory
  listOperationCodes(): Promise<OperationCode[]>;
  getOperationCode(code: string): Promise<OperationCode | null>;
  getPartsKit(operationCode: string): Promise<PartsKit | null>;
  getPartStock(partNumbers: string[]): Promise<Part[]>;

  // Tech notes and estimates
  createTechNote(input: TechNoteInput): Promise<TechNote>;
  getTechNote(id: string): Promise<TechNote | null>;
  createEstimate(input: EstimateInput): Promise<Estimate>;
  getEstimate(id: string): Promise<Estimate | null>;
  listEstimates(filter?: { status?: Estimate["status"][] }): Promise<Estimate[]>;
  updateEstimate(id: string, update: EstimateUpdate): Promise<Estimate>;
  convertToWorkOrder(estimateId: string): Promise<WorkOrderSummary>;
  listWorkOrders(filter?: { status?: string[] }): Promise<WorkOrderSummary[]>;

  // Proactive panels
  listVesselsDueForService(): Promise<DueForServiceItem[]>;
  listOverdueInvoices(): Promise<OverdueInvoice[]>;
  getInvoice(id: string): Promise<Invoice | null>;
  createPaymentLink(invoiceId: string): Promise<PaymentLink>;

  // Scheduling
  listScheduleBlocks(range: { start: Date; end: Date }): Promise<ScheduleBlock[]>;
  createScheduleBlock(input: ScheduleBlockInput): Promise<ScheduleBlock>;
  /** Staff accepting an AI suggestion flips its source to "staff". */
  updateScheduleBlock(id: string, update: { source: "staff" | "ai_suggested" }): Promise<ScheduleBlock>;
  deleteScheduleBlock(id: string): Promise<void>;

  // Audit
  logActivity(input: ActivityInput): Promise<ActivityEntry>;
  listActivity(filter?: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  }): Promise<ActivityEntry[]>;

  // Dashboard
  getDashboardCounts(): Promise<DashboardCounts>;
  getCustomer(id: string): Promise<Customer | null>;
}
