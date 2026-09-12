/**
 * The job runner. One entry point, runAgent, does what the GTM document asks
 * of every agent action:
 *
 *   1. read the CRM record (account and context file) before acting
 *   2. run the agent
 *   3. write the run to the CRM with inputs, outputs and where every number
 *      came from, including failures and guardrail blocks
 *   4. put the output on the review queue for the named human
 *   5. append a line to the per-account context file
 *
 * Agents never send anything. Sending is a separate human action (see
 * app/gtm/actions.ts) that refuses unless the queue item was approved.
 */

import { AiCallError, AiUnavailableError, getAi, isAiConfigured } from "@/lib/ai/anthropic";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import type { GtmClient } from "./client";
import { getGtmClient } from "./prisma-client";
import { AGENT_BY_KEY } from "./agents/registry";
import { AgentBlockedError, type AgentContext, type AgentResult } from "./agents/framework";
import type { Account, AgentKey, AgentRun, QueueItem } from "./types";

export interface RunOutcome<O = unknown> {
  run: AgentRun;
  queueItem: QueueItem | null;
  result: AgentResult<O>;
  account: Account | null;
}

export function createAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    gtm: overrides.gtm ?? getGtmClient(),
    dockmaster: overrides.dockmaster ?? getDockMasterClient(),
    ai: overrides.ai !== undefined ? overrides.ai : isAiConfigured() ? getAi() : null,
  };
}

export class AgentRunError extends Error {
  constructor(
    message: string,
    public readonly run: AgentRun,
    public readonly blocked: boolean,
  ) {
    super(message);
    this.name = "AgentRunError";
  }
}

export async function runAgent<I extends Record<string, unknown>, O = unknown>(
  ctx: AgentContext,
  key: AgentKey,
  input: I,
): Promise<RunOutcome<O>> {
  const agent = AGENT_BY_KEY[key];
  if (!agent) throw new Error(`Unknown agent ${key}`);
  const gtm: GtmClient = ctx.gtm;
  const started = Date.now();

  // 1. Read the CRM record first.
  const accountId = typeof input.accountId === "string" ? input.accountId : null;
  let account: Account | null = accountId ? await gtm.getAccount(accountId) : null;
  if (agent.needsAccount && !account) throw new Error("This agent needs an account.");

  // 2. Run.
  let result: AgentResult<O>;
  try {
    result = (await agent.run(ctx, input, account)) as AgentResult<O>;
  } catch (err) {
    const blocked = err instanceof AgentBlockedError;
    const message =
      err instanceof AgentBlockedError || err instanceof AiUnavailableError || err instanceof AiCallError
        ? err.message
        : err instanceof Error
          ? err.message
          : "The agent failed.";
    // 3. Failures and blocks are written to the CRM too.
    const run = await gtm.recordRun({
      agent: key,
      accountId: account?.id ?? null,
      status: blocked ? "blocked" : "failed",
      input,
      output: null,
      model: null,
      modelTier: agent.modelTier,
      latencyMs: Date.now() - started,
      error: message,
    });
    if (account) await gtm.appendContext(account.id, `${agent.name} ${blocked ? "blocked" : "failed"}: ${message}`);
    throw new AgentRunError(message, run, blocked);
  }

  if (result.accountId && !account) account = await gtm.getAccount(result.accountId);
  const modelStep = result.steps.find((s) => s.model);

  // 3. Audit.
  const run = await gtm.recordRun({
    agent: key,
    accountId: account?.id ?? null,
    status: "succeeded",
    input,
    output: result.output,
    sourceQueries: result.sourceQueries,
    model: modelStep?.model ?? null,
    modelTier: agent.modelTier,
    latencyMs: Date.now() - started,
  });

  // 4. Queue for a named human.
  let queueItem: QueueItem | null = null;
  if (result.queue) {
    queueItem = await gtm.createQueueItem({
      runId: run.id,
      agent: key,
      kind: result.queue.kind,
      accountId: account?.id ?? null,
      title: result.queue.title,
      output: result.output,
      sourceData: { ...(result.queue.sourceData as object | undefined), notes: result.notes, steps: result.steps },
      approverRole: result.queue.approverRole ?? agent.owner,
    });
  }

  // 5. Shared memory.
  if (account) await gtm.appendContext(account.id, result.contextLine);

  return { run, queueItem, result, account };
}
