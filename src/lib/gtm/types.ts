/**
 * Domain types for the go-to-market workspace. Plain objects, no Prisma types,
 * so lib/gtm/agents never depends on the storage layer.
 */

export type Segment = "install_base" | "new_logo" | "group";

export type Platform =
  | "dockmaster_desktop"
  | "dockmaster_web"
  | "dockmaster_web_mobile"
  | "molo"
  | "marinaoffice"
  | "spreadsheets"
  | "none";

export type Product = "web" | "mobile" | "valpay" | "blu" | "scheduling";

export type Stage =
  | "target"
  | "contacted"
  | "sandbox"
  | "call"
  | "proposal"
  | "closed_won"
  | "closed_lost"
  | "onboarding"
  | "live";

export type Tier = "service_writer" | "ai_service_desk" | "revenue_suite" | "group";

export type AccountSource = "seed" | "try_it" | "conference" | "partner";

export interface Contact {
  name: string;
  title: string;
  role: "decision_maker" | "champion" | "user" | "finance";
  /** Signal id the contact was found in, so the claim is traceable. */
  sourceSignalId: string | null;
}

export interface Attendee {
  name: string;
  title: string;
}

export type VesselType = "outboard" | "sterndrive" | "inboard" | "sail";

/** Trailing-twelve-month figures the Scout reads. */
export interface AccountData {
  technicianCount: number;
  slipCount: number;
  vesselCount: number;
  laborRate: number;
  standardHoursTtm: number;
  billedHoursTtm: number;
  estimatesTtm: number;
  estimatesOver3Days: number;
  avgEstimateValue: number;
  vesselsPastInterval: number;
  avgIntervalJobValue: number;
  arOver45: number;
  arTotal: number;
  dsoDays: number;
}

export interface Account extends AccountData {
  id: string;
  name: string;
  city: string;
  state: string;
  segment: Segment;
  platform: Platform;
  products: Product[];
  groupName: string | null;
  source: AccountSource;
  stage: Stage;
  tier: Tier | null;
  ownerName: string | null;
  ownerRole: "CSM" | "AE" | null;
  designPartner: boolean;
  dataConsent: boolean;
  consentGrantedAt: Date | null;
  smsOptIn: boolean;
  emailOptOut: boolean;
  conferenceAttendees: Attendee[];
  contacts: Contact[];
  vesselMix: VesselType[];
  contextFile: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountInput {
  name: string;
  city: string;
  state: string;
  segment: Segment;
  platform: Platform;
  products?: Product[];
  source?: AccountSource;
  stage?: Stage;
  ownerName?: string | null;
  ownerRole?: "CSM" | "AE" | null;
  technicianCount?: number;
  vesselCount?: number;
  laborRate?: number;
  vesselMix?: VesselType[];
  contextFile?: string;
}

export interface AccountUpdate {
  stage?: Stage;
  tier?: Tier | null;
  dataConsent?: boolean;
  consentGrantedAt?: Date | null;
  smsOptIn?: boolean;
  emailOptOut?: boolean;
  contacts?: Contact[];
  contextFile?: string;
  ownerName?: string | null;
  ownerRole?: "CSM" | "AE" | null;
}

export type SignalSource =
  | "linkedin"
  | "google_reviews"
  | "job_posting"
  | "website"
  | "boat_show"
  | "association"
  | "news"
  | "capterra";

export interface AccountSignal {
  id: string;
  accountId: string;
  source: SignalSource;
  title: string;
  body: string;
  url: string | null;
  observedAt: Date;
}

export interface AccountCode {
  id: string;
  accountId: string;
  code: string;
  description: string;
  hours: number;
  usageCount: number;
  mergedInto: string | null;
}

export interface AccountWeek {
  id: string;
  accountId: string;
  weekStart: Date;
  draftsStarted: number;
  draftsApproved: number;
  editRate: number;
  approvalRate: number;
  valpayVolume: number;
  arDays: number;
  activeTechs: number;
}

export type FeedbackSource = "support_ticket" | "call_transcript" | "dot_vote" | "review";

export interface FeedbackItem {
  id: string;
  accountId: string | null;
  accountName: string | null;
  source: FeedbackSource;
  text: string;
  observedAt: Date;
}

export type PartnerKind = "oem" | "distributor" | "insurer" | "pe_operating_partner" | "association";

export interface Partner {
  id: string;
  name: string;
  kind: PartnerKind;
  focus: string;
  contacts: Attendee[];
  notes: string;
}

export type AgentKey =
  | "opportunity_scout"
  | "account_researcher"
  | "sequencer"
  | "demo_builder"
  | "try_it_concierge"
  | "sales_engineer"
  | "deal_desk"
  | "objection_coach"
  | "onboarding_agent"
  | "adoption_agent"
  | "proof_agent"
  | "voice_of_customer"
  | "conference_concierge"
  | "partner_agent";

export type ApproverRole =
  | "Head of Sales"
  | "SDR"
  | "AE"
  | "Marketing"
  | "Solutions lead"
  | "CSM"
  | "Product"
  | "Events lead"
  | "Partnerships lead";

export type ModelTier = "none" | "cheap" | "strong";

export type QueueKind =
  | "scout_report"
  | "research"
  | "sequence"
  | "sandbox"
  | "try_it_lead"
  | "rfp_answer"
  | "proposal"
  | "call_notes"
  | "onboarding_plan"
  | "health_report"
  | "case_study"
  | "voc_report"
  | "conference_plan"
  | "partner_brief";

/**
 * Truth in numbers: every figure in a pitch links back to the query that
 * produced it. Agents attach one of these per number they surface.
 */
export interface SourceQuery {
  key: string;
  label: string;
  value: number;
  unit: "hours" | "count" | "usd" | "days" | "pct";
  /** The query, API call or formula that produced the value. */
  query: string;
  /** Set when the value depends on a rate that Valsoft data has not confirmed. */
  assumption?: string;
}

export type RunStatus = "succeeded" | "failed" | "blocked";

export interface AgentRun {
  id: string;
  agent: AgentKey;
  accountId: string | null;
  accountName: string | null;
  status: RunStatus;
  input: Record<string, unknown>;
  output: unknown;
  sourceQueries: SourceQuery[];
  model: string | null;
  modelTier: ModelTier | null;
  latencyMs: number;
  error: string | null;
  createdAt: Date;
}

export interface AgentRunInput {
  agent: AgentKey;
  accountId?: string | null;
  status: RunStatus;
  input: Record<string, unknown>;
  output: unknown;
  sourceQueries?: SourceQuery[];
  model?: string | null;
  modelTier?: ModelTier | null;
  latencyMs: number;
  error?: string | null;
}

export type QueueStatus = "pending" | "approved" | "edited" | "rejected";

export interface QueueItem {
  id: string;
  runId: string | null;
  agent: AgentKey;
  kind: QueueKind;
  accountId: string | null;
  accountName: string | null;
  title: string;
  output: unknown;
  sourceData: unknown;
  approverRole: ApproverRole;
  status: QueueStatus;
  reviewerName: string | null;
  reviewedAt: Date | null;
  editedOutput: unknown | null;
  editRatio: number | null;
  reviewNote: string | null;
  createdAt: Date;
  /** Touches sent from this item (sequences only). */
  sentTouches: number[];
}

export interface QueueItemInput {
  runId?: string | null;
  agent: AgentKey;
  kind: QueueKind;
  accountId?: string | null;
  title: string;
  output: unknown;
  sourceData?: unknown;
  approverRole: ApproverRole;
}

export interface QueueReview {
  status: Exclude<QueueStatus, "pending">;
  reviewerName: string;
  editedOutput?: unknown;
  editRatio?: number | null;
  reviewNote?: string | null;
}

export type Channel = "email" | "sms" | "linkedin" | "call";

export interface OutboundMessage {
  id: string;
  accountId: string;
  accountName: string;
  queueItemId: string | null;
  touchIndex: number;
  channel: Channel;
  subject: string | null;
  body: string;
  approvedBy: string;
  sentAt: Date;
  status: "sent" | "replied" | "bounced" | "opted_out";
  repliedAt: Date | null;
}

export interface OutboundMessageInput {
  accountId: string;
  queueItemId?: string | null;
  touchIndex?: number;
  channel: Channel;
  subject?: string | null;
  body: string;
  approvedBy: string;
}

export interface GtmCounts {
  accounts: number;
  scored: number;
  consented: number;
  pendingReviews: number;
  sequencesSent: number;
  sandboxSessions: number;
  callsBooked: number;
  proposals: number;
  closedWon: number;
}
