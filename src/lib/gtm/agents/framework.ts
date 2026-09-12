/**
 * The agent contract. Each agent is a Claude-based worker (or a deterministic
 * one) with a defined input, a defined output and a named human approver. The
 * runner (../runner.ts) reads the CRM record before the agent acts, records
 * the run with inputs and outputs, puts the output on the review queue and
 * writes a line back to the account's context file.
 */

import type { StructuredCaller } from "@/lib/ai/anthropic";
import type { DockMasterClient } from "@/lib/dockmaster/client";
import type { GtmClient } from "../client";
import type { Account, AgentKey, ApproverRole, ModelTier, QueueKind, SourceQuery } from "../types";

export interface AgentContext {
  gtm: GtmClient;
  dockmaster: DockMasterClient;
  /** Null when no ANTHROPIC_API_KEY is configured. Deterministic agents ignore it. */
  ai: StructuredCaller | null;
}

export interface AgentStep {
  step: string;
  latencyMs: number;
  model?: string;
}

export interface AgentResult<O> {
  output: O;
  /** Where every number in the output came from. */
  sourceQueries: SourceQuery[];
  steps: AgentStep[];
  /** What goes on the review queue, or null for agents that only write to the CRM. */
  queue: { kind: QueueKind; title: string; sourceData?: unknown; approverRole?: ApproverRole } | null;
  /** One line for the account context file. */
  contextLine: string;
  /** Guardrail notes surfaced to the reviewer (lint failures, validation rejections). */
  notes: string[];
  /** Agents that create an account mid-run (Try-It) report it here so the run attaches to it. */
  accountId?: string | null;
}

export interface AgentDefinition<I, O> {
  key: AgentKey;
  name: string;
  job: string;
  inputs: string;
  output: string;
  owner: ApproverRole;
  modelTier: ModelTier;
  /** True when the input must name an account (most agents). */
  needsAccount: boolean;
  run(ctx: AgentContext, input: I, account: Account | null): Promise<AgentResult<O>>;
}

/** Thrown when a guardrail stops the agent before it produces anything. */
export class AgentBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentBlockedError";
  }
}

export function requireAi(ctx: AgentContext): StructuredCaller {
  if (!ctx.ai) {
    throw new AgentBlockedError("This agent drafts with Claude and needs ANTHROPIC_API_KEY. Deterministic agents (Scout, Adoption) still run.");
  }
  return ctx.ai;
}

export function fig(key: string, label: string, value: number, unit: SourceQuery["unit"], query: string, assumption?: string): SourceQuery {
  return { key, label, value: Math.round(value * 100) / 100, unit, query, assumption };
}
