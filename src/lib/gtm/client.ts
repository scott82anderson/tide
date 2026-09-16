/**
 * GtmClient: the boundary between the go-to-market agents and the systems they
 * read and write. The GTM document calls the CRM record "the one memory the
 * agents share": every agent reads it before acting and writes back what it
 * did. This interface is that memory plus the two data sources the agents mine.
 *
 * The prototype ships one implementation, `PrismaGtmClient` (prisma-client.ts),
 * backed by the same local database as the Service Writer. Nothing under
 * lib/gtm/agents imports Prisma.
 *
 * How a production implementation would bind
 * ------------------------------------------
 * CRM (HubSpot or Salesforce) holds accounts, contacts, stages, activities:
 *   listAccounts / getAccount     GET  /crm/v3/objects/companies (+ custom props)
 *   updateAccount                 PATCH /crm/v3/objects/companies/{id}
 *   recordRun / listRuns          POST /crm/v3/objects/notes (agent activity type)
 *   createQueueItem / reviewQueueItem
 *                                 a custom object "Agent draft" with an approval
 *                                 workflow, or the job runner's own store with a
 *                                 CRM note per decision
 *   recordOutbound                POST /crm/v3/objects/emails (engagement) after a
 *                                 human sends through the sequencing tool
 *   getContextFile / appendContext
 *                                 a long-text property on the company record
 *
 * DockMaster data warehouse (consented accounts only):
 *   getAccountData                SELECT over work_orders, estimates, invoices,
 *                                 vessels per tenant, trailing twelve months.
 *                                 Each figure carries the query that produced it
 *                                 (see SourceQuery) so a pitch can cite it.
 *   listAccountCodes              GET /api/v1/service/operation-codes per tenant
 *   applyCodeMerges               PATCH per code (the one write the Onboarding
 *                                 Agent is allowed, and only after CSM approval)
 *
 * Telemetry warehouse:
 *   listAccountWeeks              product events aggregated per account per week
 *
 * Web and enrichment (Account Researcher):
 *   listSignals                   in production, web search, review sites and
 *                                 LinkedIn via MCP tools; the prototype seeds the
 *                                 raw signal text the model classifies
 *
 * Guardrail note: the LLM never sees this client. Agents pass it lists (signals,
 * objection library entries, knowledge docs, codes) and validate that every id
 * the model returns came from those lists.
 */

import type {
  Account,
  AccountCode,
  AccountInput,
  AccountSignal,
  AccountUpdate,
  AccountWeek,
  AgentKey,
  AgentRun,
  AgentRunInput,
  FeedbackItem,
  GtmCounts,
  OutboundMessage,
  OutboundMessageInput,
  Partner,
  QueueItem,
  QueueItemInput,
  QueueReview,
  QueueStatus,
} from "./types";

export interface GtmClient {
  // CRM: accounts
  listAccounts(filter?: { segment?: Account["segment"]; stage?: Account["stage"][] }): Promise<Account[]>;
  getAccount(id: string): Promise<Account | null>;
  createAccount(input: AccountInput): Promise<Account>;
  updateAccount(id: string, update: AccountUpdate): Promise<Account>;
  /** Appends a dated line to the per-account context file the agents share. */
  appendContext(accountId: string, line: string): Promise<void>;

  // Data sources the agents mine
  listSignals(accountId: string): Promise<AccountSignal[]>;
  listAccountCodes(accountId: string): Promise<AccountCode[]>;
  applyCodeMerges(accountId: string, merges: { fromCode: string; intoCode: string }[]): Promise<number>;
  listAccountWeeks(accountId: string): Promise<AccountWeek[]>;
  listFeedback(): Promise<FeedbackItem[]>;
  listPartners(): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | null>;

  // Audit: every agent action with inputs and outputs
  recordRun(input: AgentRunInput): Promise<AgentRun>;
  listRuns(filter?: { accountId?: string; agent?: AgentKey; limit?: number }): Promise<AgentRun[]>;

  // Review queue
  createQueueItem(input: QueueItemInput): Promise<QueueItem>;
  getQueueItem(id: string): Promise<QueueItem | null>;
  listQueueItems(filter?: { status?: QueueStatus[]; accountId?: string; agent?: AgentKey; kind?: QueueItem["kind"] }): Promise<QueueItem[]>;
  reviewQueueItem(id: string, review: QueueReview): Promise<QueueItem>;

  // Outbound, only ever called from a human click
  recordOutbound(input: OutboundMessageInput): Promise<OutboundMessage>;
  listOutbound(filter?: { accountId?: string }): Promise<OutboundMessage[]>;

  // Console
  getCounts(): Promise<GtmCounts>;
}
