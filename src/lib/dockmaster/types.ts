/**
 * Domain types shared by the Service Writer pipeline, the UI and the
 * DockMasterClient boundary. These are plain objects (no Prisma types) so that
 * lib/ai never depends on the storage layer.
 */

export type Skill =
  | "engine"
  | "electrical"
  | "fiberglass"
  | "rigging"
  | "hydraulics"
  | "plumbing"
  | "canvas"
  | "detailing"
  | "haul";

export type TechnicianRole = "technician" | "lead_tech" | "service_manager";

export interface Marina {
  id: string;
  name: string;
  city: string;
  state: string;
  laborRate: number;
  shopSuppliesPct: number;
  taxPct: number;
}

export interface Technician {
  id: string;
  name: string;
  role: TechnicianRole;
  skills: string[];
  hourlyCost: number;
  /** weekday -> [startHour, endHour][] in local time */
  availability: Record<string, [number, number][]>;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  portalEnabled: boolean;
  arBalance: number;
}

export interface Vessel {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  lengthFt: number;
  hin: string;
  engineMake: string;
  engineModel: string;
  engineCount: number;
  engineHours: number;
  location: string;
  customerId: string;
  customer: Customer;
}

export interface OperationCode {
  id: string;
  code: string;
  description: string;
  category: string;
  standardHours: number;
  laborRate: number | null;
  keywords: string[];
  maintenanceIntervalMonths: number | null;
  kitId: string | null;
}

export interface Part {
  id: string;
  partNumber: string;
  description: string;
  vendor: string;
  cost: number;
  sellPrice: number;
  onHand: number;
  reorderPoint: number;
  binLocation: string;
  fitsEngineMakes: string[];
}

export interface KitPart {
  part: Part;
  qty: number;
}

export interface PartsKit {
  id: string;
  name: string;
  operationCode: string;
  items: KitPart[];
}

export interface WorkOrderOperationSummary {
  code: string;
  description: string;
  category: string;
  hours: number;
  maintenanceIntervalMonths: number | null;
}

export interface WorkOrderSummary {
  id: string;
  number: string;
  vesselId: string;
  status: string;
  description: string;
  openedAt: Date;
  closedAt: Date | null;
  technicianName: string | null;
  hoursStandard: number;
  hoursBilled: number;
  total: number;
  operations: WorkOrderOperationSummary[];
  parts: { partNumber: string; description: string; qty: number }[];
}

export interface VesselHint {
  hinSuffix?: string;
  boatName?: string;
  makeModel?: string;
  slip?: string;
  ownerLastName?: string;
}

export interface VesselMatchCandidate {
  vessel: Vessel;
  score: number;
  reasons: string[];
}

export type EstimateStatus =
  | "draft_ai"
  | "draft_reviewed"
  | "awaiting_customer"
  | "approved"
  | "declined"
  | "converted";

export type LineKind = "operation" | "part" | "misc";
export type LineSource = "ai" | "staff";

export interface EstimateLineInput {
  kind: LineKind;
  operationCodeId?: string | null;
  partId?: string | null;
  parentLineKey?: string | null;
  /** Client-side key so part lines can reference their operation line before ids exist. */
  key?: string;
  description: string;
  customerDescription?: string | null;
  qty?: number;
  hours?: number | null;
  standardHours?: number | null;
  technicianHours?: number | null;
  hoursFlag?: string | null;
  rate?: number | null;
  unitCost?: number | null;
  unitPrice?: number | null;
  lineTotal: number;
  included?: boolean;
  confidence?: number | null;
  source?: LineSource;
  rationale?: string | null;
  sourceNote?: string | null;
  stockWarning?: string | null;
  needsManagerReview?: boolean;
  sortOrder?: number;
}

export interface EstimateLine extends EstimateLineInput {
  id: string;
  estimateId: string;
  parentLineId: string | null;
  qty: number;
  included: boolean;
  source: LineSource;
  needsManagerReview: boolean;
  sortOrder: number;
  operationCode?: OperationCode | null;
  part?: Part | null;
}

export interface HistoryFlag {
  kind: "interval_overdue" | "interval_ok" | "repeat_issue" | "info";
  message: string;
  workOrderNumber?: string;
  operationCode?: string;
}

export interface EstimateTotals {
  subtotalLabor: number;
  subtotalParts: number;
  shopSupplies: number;
  tax: number;
  total: number;
}

export interface ReasoningStep {
  step: string;
  latencyMs: number;
  input: unknown;
  output: unknown;
  model?: string;
}

export interface ReasoningTrace {
  steps: ReasoningStep[];
  /** Any non-fatal notes produced while drafting, e.g. codes rejected by validation. */
  notes: string[];
}

export interface EstimateInput {
  status: EstimateStatus;
  title: string;
  vesselId: string;
  customerId: string;
  technicianId?: string | null;
  techNoteId?: string | null;
  origin?: "tech_note" | "outreach" | "manual";
  quoteSeparately?: boolean;
  parentEstimateId?: string | null;
  totals: EstimateTotals;
  requiresManagerApproval: boolean;
  vesselMatchConfidence?: number | null;
  vesselMatchReasons?: string[];
  historyFlags?: HistoryFlag[];
  reasoning?: ReasoningTrace;
  customerSummary?: string | null;
  internalSummary?: string | null;
  photoPaths?: string[];
  lines: EstimateLineInput[];
}

export interface Estimate {
  id: string;
  number: string;
  status: EstimateStatus;
  title: string;
  vesselId: string;
  vessel: Vessel;
  customerId: string;
  customer: Customer;
  technicianId: string | null;
  technicianName: string | null;
  techNoteId: string | null;
  origin: "tech_note" | "outreach" | "manual";
  quoteSeparately: boolean;
  parentEstimateId: string | null;
  totals: EstimateTotals;
  requiresManagerApproval: boolean;
  vesselMatchConfidence: number | null;
  vesselMatchReasons: string[];
  historyFlags: HistoryFlag[];
  reasoning: ReasoningTrace;
  customerSummary: string | null;
  internalSummary: string | null;
  photoPaths: string[];
  sentAt: Date | null;
  approvedAt: Date | null;
  signedByName: string | null;
  signedAt: Date | null;
  declinedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: EstimateLine[];
  workOrderNumber: string | null;
  workOrderId: string | null;
}

export interface EstimateUpdate {
  status?: EstimateStatus;
  totals?: EstimateTotals;
  requiresManagerApproval?: boolean;
  vesselId?: string;
  customerId?: string;
  vesselMatchConfidence?: number | null;
  vesselMatchReasons?: string[];
  customerSummary?: string | null;
  internalSummary?: string | null;
  sentAt?: Date | null;
  approvedAt?: Date | null;
  signedByName?: string | null;
  signedAt?: Date | null;
  declinedReason?: string | null;
  /** Per-line edits keyed by line id. Any line touched here flips source to "staff". */
  lines?: Record<
    string,
    { hours?: number | null; qty?: number; included?: boolean; lineTotal?: number; source?: LineSource }
  >;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customer: Customer;
  workOrderId: string | null;
  workOrderNumber: string | null;
  amount: number;
  issuedAt: Date;
  dueAt: Date;
  paidAt: Date | null;
  description: string;
}

export interface OverdueInvoice extends Invoice {
  daysOverdue: number;
  ageBucket: "friendly" | "firm" | "final";
}

export interface DueForServiceItem {
  vessel: Vessel;
  operation: OperationCode;
  lastDoneAt: Date | null;
  lastWorkOrderNumber: string | null;
  monthsSince: number | null;
  intervalMonths: number;
  monthsOverdue: number;
}

export interface PaymentLink {
  url: string;
  token: string;
  invoiceId: string;
  amount: number;
}

export type Actor = "ai" | "staff" | "customer";

export interface ActivityEntry {
  id: string;
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ActivityInput {
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}

export interface TechNote {
  id: string;
  transcript: string;
  audioPath: string | null;
  photoPaths: string[];
  technicianId: string;
  technicianName: string;
  vesselId: string | null;
  createdAt: Date;
}

export interface TechNoteInput {
  transcript: string;
  audioPath?: string | null;
  photoPaths?: string[];
  technicianId: string;
  vesselId?: string | null;
}

export interface ScheduleBlock {
  id: string;
  technicianId: string;
  technicianName: string;
  workOrderId: string | null;
  workOrderNumber: string | null;
  label: string;
  start: Date;
  end: Date;
  source: "staff" | "ai_suggested";
}

export interface ScheduleBlockInput {
  technicianId: string;
  workOrderId?: string | null;
  label: string;
  start: Date;
  end: Date;
  source: "staff" | "ai_suggested";
}

export interface DashboardCounts {
  aiDrafts: number;
  awaitingCustomer: number;
  dueForService: number;
  overdueInvoices: number;
  overdueAmount: number;
}
