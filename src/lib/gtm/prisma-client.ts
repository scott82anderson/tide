/**
 * Prisma-backed GtmClient. Stands in for the CRM, the DockMaster warehouse
 * extract and the telemetry warehouse using the seeded local database. See
 * client.ts for the production mapping.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { DEMO_TODAY, demoNow, formatDate } from "@/lib/demo-date";
import { parseJson } from "@/lib/utils";
import type { GtmClient } from "./client";
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

type AccountRow = Prisma.AccountGetPayload<object>;
type RunRow = Prisma.AgentRunGetPayload<{ include: { account: true } }>;
const queueInclude = { account: true, messages: true } satisfies Prisma.QueueItemInclude;
type QueueRow = Prisma.QueueItemGetPayload<{ include: typeof queueInclude }>;
type MessageRow = Prisma.OutboundMessageGetPayload<{ include: { account: true } }>;

function toAccount(a: AccountRow): Account {
  return {
    id: a.id,
    name: a.name,
    city: a.city,
    state: a.state,
    segment: a.segment as Account["segment"],
    platform: a.platform as Account["platform"],
    products: parseJson(a.products, []),
    groupName: a.groupName,
    source: a.source as Account["source"],
    stage: a.stage as Account["stage"],
    tier: (a.tier as Account["tier"]) ?? null,
    ownerName: a.ownerName,
    ownerRole: (a.ownerRole as Account["ownerRole"]) ?? null,
    designPartner: a.designPartner,
    dataConsent: a.dataConsent,
    consentGrantedAt: a.consentGrantedAt,
    smsOptIn: a.smsOptIn,
    emailOptOut: a.emailOptOut,
    conferenceAttendees: parseJson(a.conferenceAttendees, []),
    contacts: parseJson(a.contacts, []),
    vesselMix: parseJson(a.vesselMix, []),
    technicianCount: a.technicianCount,
    slipCount: a.slipCount,
    vesselCount: a.vesselCount,
    laborRate: a.laborRate,
    standardHoursTtm: a.standardHoursTtm,
    billedHoursTtm: a.billedHoursTtm,
    estimatesTtm: a.estimatesTtm,
    estimatesOver3Days: a.estimatesOver3Days,
    avgEstimateValue: a.avgEstimateValue,
    vesselsPastInterval: a.vesselsPastInterval,
    avgIntervalJobValue: a.avgIntervalJobValue,
    arOver45: a.arOver45,
    arTotal: a.arTotal,
    dsoDays: a.dsoDays,
    contextFile: a.contextFile,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function toSignal(s: Prisma.AccountSignalGetPayload<object>): AccountSignal {
  return { id: s.id, accountId: s.accountId, source: s.source as AccountSignal["source"], title: s.title, body: s.body, url: s.url, observedAt: s.observedAt };
}

function toRun(r: RunRow): AgentRun {
  return {
    id: r.id,
    agent: r.agent as AgentKey,
    accountId: r.accountId,
    accountName: r.account?.name ?? null,
    status: r.status as AgentRun["status"],
    input: parseJson(r.input, {}),
    output: parseJson(r.output, null),
    sourceQueries: parseJson(r.sourceQueries, []),
    model: r.model,
    modelTier: (r.modelTier as AgentRun["modelTier"]) ?? null,
    latencyMs: r.latencyMs,
    error: r.error,
    createdAt: r.createdAt,
  };
}

function toQueueItem(q: QueueRow): QueueItem {
  return {
    id: q.id,
    runId: q.runId,
    agent: q.agent as AgentKey,
    kind: q.kind as QueueItem["kind"],
    accountId: q.accountId,
    accountName: q.account?.name ?? null,
    title: q.title,
    output: parseJson(q.output, null),
    sourceData: parseJson(q.sourceData, null),
    approverRole: q.approverRole as QueueItem["approverRole"],
    status: q.status as QueueStatus,
    reviewerName: q.reviewerName,
    reviewedAt: q.reviewedAt,
    editedOutput: q.editedOutput ? parseJson(q.editedOutput, null) : null,
    editRatio: q.editRatio,
    reviewNote: q.reviewNote,
    createdAt: q.createdAt,
    sentTouches: q.messages.map((m) => m.touchIndex),
  };
}

function toMessage(m: MessageRow): OutboundMessage {
  return {
    id: m.id,
    accountId: m.accountId,
    accountName: m.account.name,
    queueItemId: m.queueItemId,
    touchIndex: m.touchIndex,
    channel: m.channel as OutboundMessage["channel"],
    subject: m.subject,
    body: m.body,
    approvedBy: m.approvedBy,
    sentAt: m.sentAt,
    status: m.status as OutboundMessage["status"],
    repliedAt: m.repliedAt,
  };
}

export class PrismaGtmClient implements GtmClient {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async listAccounts(filter?: { segment?: Account["segment"]; stage?: Account["stage"][] }): Promise<Account[]> {
    const rows = await this.db.account.findMany({
      where: { segment: filter?.segment, stage: filter?.stage ? { in: filter.stage } : undefined },
      orderBy: { name: "asc" },
    });
    return rows.map(toAccount);
  }

  async getAccount(id: string): Promise<Account | null> {
    const a = await this.db.account.findUnique({ where: { id } });
    return a ? toAccount(a) : null;
  }

  async createAccount(input: AccountInput): Promise<Account> {
    const a = await this.db.account.create({
      data: {
        name: input.name,
        city: input.city,
        state: input.state,
        segment: input.segment,
        platform: input.platform,
        products: JSON.stringify(input.products ?? []),
        source: input.source ?? "seed",
        stage: input.stage ?? "target",
        ownerName: input.ownerName ?? null,
        ownerRole: input.ownerRole ?? null,
        technicianCount: input.technicianCount ?? 0,
        vesselCount: input.vesselCount ?? 0,
        laborRate: input.laborRate ?? 0,
        vesselMix: JSON.stringify(input.vesselMix ?? []),
        contextFile: input.contextFile ?? "",
        createdAt: demoNow(),
        updatedAt: demoNow(),
      },
    });
    return toAccount(a);
  }

  async updateAccount(id: string, update: AccountUpdate): Promise<Account> {
    const data: Prisma.AccountUpdateInput = { updatedAt: demoNow() };
    if (update.stage) data.stage = update.stage;
    if (update.tier !== undefined) data.tier = update.tier;
    if (update.dataConsent !== undefined) data.dataConsent = update.dataConsent;
    if (update.consentGrantedAt !== undefined) data.consentGrantedAt = update.consentGrantedAt;
    if (update.smsOptIn !== undefined) data.smsOptIn = update.smsOptIn;
    if (update.emailOptOut !== undefined) data.emailOptOut = update.emailOptOut;
    if (update.contacts) data.contacts = JSON.stringify(update.contacts);
    if (update.contextFile !== undefined) data.contextFile = update.contextFile;
    if (update.ownerName !== undefined) data.ownerName = update.ownerName;
    if (update.ownerRole !== undefined) data.ownerRole = update.ownerRole;
    const a = await this.db.account.update({ where: { id }, data });
    return toAccount(a);
  }

  async appendContext(accountId: string, line: string): Promise<void> {
    const a = await this.db.account.findUniqueOrThrow({ where: { id: accountId } });
    const stamp = formatDate(DEMO_TODAY);
    const next = `${a.contextFile.trimEnd()}\n- ${stamp}: ${line}`.trim();
    await this.db.account.update({ where: { id: accountId }, data: { contextFile: next, updatedAt: demoNow() } });
  }

  async listSignals(accountId: string): Promise<AccountSignal[]> {
    const rows = await this.db.accountSignal.findMany({ where: { accountId }, orderBy: { observedAt: "desc" } });
    return rows.map(toSignal);
  }

  async listAccountCodes(accountId: string): Promise<AccountCode[]> {
    const rows = await this.db.accountCode.findMany({ where: { accountId }, orderBy: { code: "asc" } });
    return rows.map((c) => ({ id: c.id, accountId: c.accountId, code: c.code, description: c.description, hours: c.hours, usageCount: c.usageCount, mergedInto: c.mergedInto }));
  }

  async applyCodeMerges(accountId: string, merges: { fromCode: string; intoCode: string }[]): Promise<number> {
    let n = 0;
    for (const m of merges) {
      const res = await this.db.accountCode.updateMany({ where: { accountId, code: m.fromCode }, data: { mergedInto: m.intoCode } });
      n += res.count;
    }
    return n;
  }

  async listAccountWeeks(accountId: string): Promise<AccountWeek[]> {
    const rows = await this.db.accountWeek.findMany({ where: { accountId }, orderBy: { weekStart: "asc" } });
    return rows.map((w) => ({ ...w }));
  }

  async listFeedback(): Promise<FeedbackItem[]> {
    const rows = await this.db.feedbackItem.findMany({ include: { account: true }, orderBy: { observedAt: "desc" } });
    return rows.map((f) => ({ id: f.id, accountId: f.accountId, accountName: f.account?.name ?? null, source: f.source as FeedbackItem["source"], text: f.text, observedAt: f.observedAt }));
  }

  async listPartners(): Promise<Partner[]> {
    const rows = await this.db.partner.findMany({ orderBy: { name: "asc" } });
    return rows.map((p) => ({ id: p.id, name: p.name, kind: p.kind as Partner["kind"], focus: p.focus, contacts: parseJson(p.contacts, []), notes: p.notes }));
  }

  async getPartner(id: string): Promise<Partner | null> {
    const p = await this.db.partner.findUnique({ where: { id } });
    return p ? { id: p.id, name: p.name, kind: p.kind as Partner["kind"], focus: p.focus, contacts: parseJson(p.contacts, []), notes: p.notes } : null;
  }

  async recordRun(input: AgentRunInput): Promise<AgentRun> {
    const r = await this.db.agentRun.create({
      data: {
        agent: input.agent,
        accountId: input.accountId ?? null,
        status: input.status,
        input: JSON.stringify(input.input ?? {}),
        output: JSON.stringify(input.output ?? null),
        sourceQueries: JSON.stringify(input.sourceQueries ?? []),
        model: input.model ?? null,
        modelTier: input.modelTier ?? null,
        latencyMs: input.latencyMs,
        error: input.error ?? null,
        createdAt: demoNow(),
      },
      include: { account: true },
    });
    return toRun(r);
  }

  async listRuns(filter?: { accountId?: string; agent?: AgentKey; limit?: number }): Promise<AgentRun[]> {
    const rows = await this.db.agentRun.findMany({
      where: { accountId: filter?.accountId, agent: filter?.agent },
      include: { account: true },
      orderBy: { createdAt: "desc" },
      take: filter?.limit ?? 100,
    });
    return rows.map(toRun);
  }

  async createQueueItem(input: QueueItemInput): Promise<QueueItem> {
    const q = await this.db.queueItem.create({
      data: {
        runId: input.runId ?? null,
        agent: input.agent,
        kind: input.kind,
        accountId: input.accountId ?? null,
        title: input.title,
        output: JSON.stringify(input.output ?? null),
        sourceData: JSON.stringify(input.sourceData ?? null),
        approverRole: input.approverRole,
        createdAt: demoNow(),
      },
      include: queueInclude,
    });
    return toQueueItem(q);
  }

  async getQueueItem(id: string): Promise<QueueItem | null> {
    const q = await this.db.queueItem.findUnique({ where: { id }, include: queueInclude });
    return q ? toQueueItem(q) : null;
  }

  async listQueueItems(filter?: { status?: QueueStatus[]; accountId?: string; agent?: AgentKey; kind?: QueueItem["kind"] }): Promise<QueueItem[]> {
    const rows = await this.db.queueItem.findMany({
      where: {
        status: filter?.status ? { in: filter.status } : undefined,
        accountId: filter?.accountId,
        agent: filter?.agent,
        kind: filter?.kind,
      },
      include: queueInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toQueueItem);
  }

  async reviewQueueItem(id: string, review: QueueReview): Promise<QueueItem> {
    const q = await this.db.queueItem.update({
      where: { id },
      data: {
        status: review.status,
        reviewerName: review.reviewerName,
        reviewedAt: demoNow(),
        editedOutput: review.editedOutput !== undefined ? JSON.stringify(review.editedOutput) : undefined,
        editRatio: review.editRatio ?? undefined,
        reviewNote: review.reviewNote ?? undefined,
      },
      include: queueInclude,
    });
    return toQueueItem(q);
  }

  async recordOutbound(input: OutboundMessageInput): Promise<OutboundMessage> {
    const m = await this.db.outboundMessage.create({
      data: {
        accountId: input.accountId,
        queueItemId: input.queueItemId ?? null,
        touchIndex: input.touchIndex ?? 0,
        channel: input.channel,
        subject: input.subject ?? null,
        body: input.body,
        approvedBy: input.approvedBy,
        sentAt: demoNow(),
      },
      include: { account: true },
    });
    return toMessage(m);
  }

  async listOutbound(filter?: { accountId?: string }): Promise<OutboundMessage[]> {
    const rows = await this.db.outboundMessage.findMany({
      where: { accountId: filter?.accountId },
      include: { account: true },
      orderBy: { sentAt: "desc" },
    });
    return rows.map(toMessage);
  }

  async getCounts(): Promise<GtmCounts> {
    const [accounts, consented, pendingReviews, scoredRows, sentRows, sandbox, calls, proposals, closedWon] = await Promise.all([
      this.db.account.count(),
      this.db.account.count({ where: { dataConsent: true } }),
      this.db.queueItem.count({ where: { status: "pending" } }),
      this.db.agentRun.findMany({ where: { agent: "opportunity_scout", status: "succeeded" }, select: { accountId: true } }),
      this.db.outboundMessage.findMany({ select: { accountId: true } }),
      this.db.agentRun.count({ where: { agent: "try_it_concierge", status: "succeeded" } }),
      this.db.account.count({ where: { stage: { in: ["call", "proposal", "closed_won", "onboarding", "live"] } } }),
      this.db.queueItem.count({ where: { kind: "proposal" } }),
      this.db.account.count({ where: { stage: { in: ["closed_won", "onboarding", "live"] } } }),
    ]);
    return {
      accounts,
      scored: new Set(scoredRows.map((r) => r.accountId)).size,
      consented,
      pendingReviews,
      sequencesSent: new Set(sentRows.map((r) => r.accountId)).size,
      sandboxSessions: sandbox,
      callsBooked: calls,
      proposals,
      closedWon,
    };
  }
}

let singleton: PrismaGtmClient | null = null;
export function getGtmClient(): GtmClient {
  if (!singleton) singleton = new PrismaGtmClient();
  return singleton;
}
