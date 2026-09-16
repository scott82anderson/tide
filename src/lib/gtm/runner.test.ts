/**
 * The runner's contract: read the CRM first, record every run (including
 * guardrail blocks), queue the output for a named human, write back to the
 * account's context file. Uses an in-memory GtmClient and the fake model.
 */

import { describe, expect, it } from "vitest";
import { FakeStructuredCaller } from "@/lib/ai/anthropic";
import { FakeDockMasterClient } from "@/test/fake-client";
import type { GtmClient } from "./client";
import { AgentRunError, runAgent } from "./runner";
import type { Account, AccountSignal, AgentRun, AgentRunInput, QueueItem, QueueItemInput } from "./types";

function account(over: Partial<Account> = {}): Account {
  return {
    id: "acc_t",
    name: "Tidewater Boat Repair",
    city: "Norfolk",
    state: "VA",
    segment: "new_logo",
    platform: "molo",
    products: [],
    groupName: null,
    source: "seed",
    stage: "target",
    tier: null,
    ownerName: "Casey Morgan",
    ownerRole: "AE",
    designPartner: false,
    dataConsent: false,
    consentGrantedAt: null,
    smsOptIn: false,
    emailOptOut: false,
    conferenceAttendees: [],
    contacts: [],
    vesselMix: ["outboard"],
    technicianCount: 7,
    slipCount: 0,
    vesselCount: 220,
    laborRate: 0,
    standardHoursTtm: 0,
    billedHoursTtm: 0,
    estimatesTtm: 0,
    estimatesOver3Days: 0,
    avgEstimateValue: 0,
    vesselsPastInterval: 0,
    avgIntervalJobValue: 0,
    arOver45: 0,
    arTotal: 0,
    dsoDays: 0,
    contextFile: "# Tidewater",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

class MemoryGtm {
  accounts = new Map<string, Account>();
  runs: AgentRun[] = [];
  queue: QueueItem[] = [];
  signals: AccountSignal[] = [];
  async getAccount(id: string) {
    return this.accounts.get(id) ?? null;
  }
  async listAccounts() {
    return [...this.accounts.values()];
  }
  async appendContext(id: string, line: string) {
    const a = this.accounts.get(id)!;
    a.contextFile += `\n- ${line}`;
  }
  async listSignals(accountId: string) {
    return this.signals.filter((s) => s.accountId === accountId);
  }
  async recordRun(input: AgentRunInput) {
    const run: AgentRun = { id: `run_${this.runs.length + 1}`, accountName: null, sourceQueries: [], model: null, modelTier: null, error: null, createdAt: new Date(), ...input, accountId: input.accountId ?? null };
    this.runs.push(run);
    return run;
  }
  async listRuns() {
    return this.runs;
  }
  async createQueueItem(input: QueueItemInput) {
    const q: QueueItem = { id: `q_${this.queue.length + 1}`, runId: input.runId ?? null, accountId: input.accountId ?? null, accountName: null, status: "pending", reviewerName: null, reviewedAt: null, editedOutput: null, editRatio: null, reviewNote: null, createdAt: new Date(), sentTouches: [], sourceData: input.sourceData ?? null, ...input };
    this.queue.push(q);
    return q;
  }
  async listQueueItems(filter?: { accountId?: string; kind?: string }) {
    return this.queue.filter((q) => (!filter?.accountId || q.accountId === filter.accountId) && (!filter?.kind || q.kind === filter.kind));
  }
  asClient(): GtmClient {
    return this as unknown as GtmClient;
  }
}

describe("runAgent", () => {
  it("runs the deterministic Scout without a model, queues the report and writes the context file", async () => {
    const gtm = new MemoryGtm();
    gtm.accounts.set("acc_t", account());
    const ctx = { gtm: gtm.asClient(), dockmaster: new FakeDockMasterClient().asClient(), ai: null };
    const out = await runAgent(ctx, "opportunity_scout", { accountId: "acc_t" });
    expect(out.run.status).toBe("succeeded");
    expect(out.run.modelTier).toBe("none");
    expect(out.queueItem?.kind).toBe("scout_report");
    expect(out.queueItem?.approverRole).toBe("Head of Sales");
    expect(gtm.accounts.get("acc_t")!.contextFile).toContain("Scout scored");
    expect(out.result.notes[0]).toContain("No data consent");
  });

  it("records a blocked run when a model agent has no key, and a failed one on an error", async () => {
    const gtm = new MemoryGtm();
    gtm.accounts.set("acc_t", account());
    const ctx = { gtm: gtm.asClient(), dockmaster: new FakeDockMasterClient().asClient(), ai: null };
    await expect(runAgent(ctx, "account_researcher", { accountId: "acc_t" })).rejects.toBeInstanceOf(AgentRunError);
    expect(gtm.runs[0].status).toBe("blocked");
    expect(gtm.queue).toHaveLength(0);
    expect(gtm.accounts.get("acc_t")!.contextFile).toContain("blocked");
  });

  it("validates the Researcher's citations against the signals it was shown", async () => {
    const gtm = new MemoryGtm();
    gtm.accounts.set("acc_t", account());
    gtm.signals.push({ id: "sig_1", accountId: "acc_t", source: "job_posting", title: "Hiring a service writer", body: "Seven-technician shop hiring a service writer.", url: null, observedAt: new Date() });
    const ai = new FakeStructuredCaller({
      record_account_research: [
        {
          serviceDepartmentSize: "medium",
          estimatedTechnicians: 7,
          techStack: ["Molo"],
          decisionMakers: [{ name: "Deshawn Carter", title: "Service Manager", role: "champion", sourceSignalId: "sig_999" }],
          triggers: [{ type: "hiring_technicians", summary: "Hiring a service writer", evidenceSignalId: "sig_1", strength: "strong" }],
          summary: "Seven-tech shop on Molo hiring a service writer.",
        },
      ],
    });
    const ctx = { gtm: gtm.asClient(), dockmaster: new FakeDockMasterClient().asClient(), ai };
    const out = await runAgent<Record<string, unknown>, { research: { decisionMakers: unknown[]; triggers: unknown[] } }>(ctx, "account_researcher", { accountId: "acc_t" });
    expect(out.result.output.research.triggers).toHaveLength(1);
    expect(out.result.output.research.decisionMakers).toHaveLength(0);
    expect(out.result.notes[0]).toContain("unknown signal sig_999");
    expect(ai.calls[0].model).toBe("claude-haiku-4-5");
  });

  it("blocks the Sequencer until a Scout report exists and refuses opted-out accounts", async () => {
    const gtm = new MemoryGtm();
    gtm.accounts.set("acc_t", account());
    const ai = new FakeStructuredCaller({});
    const ctx = { gtm: gtm.asClient(), dockmaster: new FakeDockMasterClient().asClient(), ai };
    await expect(runAgent(ctx, "sequencer", { accountId: "acc_t" })).rejects.toThrow(/Run the Opportunity Scout first/);
    gtm.accounts.get("acc_t")!.emailOptOut = true;
    await expect(runAgent(ctx, "sequencer", { accountId: "acc_t" })).rejects.toThrow(/opted out/);
  });
});
