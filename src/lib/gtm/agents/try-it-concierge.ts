/**
 * Try-It Concierge: runs the self-serve web demo. A prospect pastes a tech
 * note on the public /try page and gets a draft estimate in seconds, drafted
 * by the same pipeline the product uses against the public sample yard. When
 * the prospect leaves their details, the session becomes a lead with intent
 * and a data sample, and Marketing gets a queue item to book a call.
 */

import { runDraftPipeline } from "@/lib/ai/pipeline";
import { isRecordedTranscript, recordedCallerForNote1 } from "@/lib/ai/recorded";
import { TEAM } from "../team";
import type { Account, Platform } from "../types";
import { AgentBlockedError, type AgentDefinition, type AgentResult } from "./framework";

export interface TryItLead {
  name: string;
  email: string;
  yardName: string;
  platform: Platform;
}

export interface TryItInput {
  transcript: string;
  /** Set when the visitor came from a Demo Builder sandbox link. */
  accountId?: string | null;
  lead?: TryItLead | null;
}

export interface TryItLine {
  kind: "operation" | "part" | "misc";
  code: string | null;
  description: string;
  hours: number | null;
  qty: number;
  rate: number | null;
  unitPrice: number | null;
  lineTotal: number;
  confidence: number | null;
  sourceNote: string | null;
  stockWarning: string | null;
  included: boolean;
}

export interface TryItResult {
  transcript: string;
  recorded: boolean;
  vessel: { name: string; detail: string; confidence: number; reasons: string[] } | null;
  findings: { system: string; recommendation: string; severity: string }[];
  lines: TryItLine[];
  total: number;
  separateDrafts: number;
  latencyMs: number;
  accountId: string | null;
  accountName: string | null;
  lead: TryItLead | null;
  nextStep: string;
}

export const NEXT_STEP = "Send us 20 real notes and your rate card and we will show you your accuracy on your own codes.";

export const tryItConcierge: AgentDefinition<TryItInput, TryItResult> = {
  key: "try_it_concierge",
  name: "Try-It Concierge",
  job: "Run the self-serve web demo",
  inputs: "Prospect pastes or records a tech note on the marketing site",
  output: "Draft estimate in seconds, then an offer to see it against their own codes",
  owner: "Marketing",
  modelTier: "strong",
  needsAccount: false,
  async run(ctx, input): Promise<AgentResult<TryItResult>> {
    const transcript = input.transcript.trim();
    if (!transcript) throw new AgentBlockedError("Paste a technician note first.");
    const recorded = !ctx.ai && isRecordedTranscript(transcript);
    if (!ctx.ai && !recorded) {
      throw new AgentBlockedError("No ANTHROPIC_API_KEY set. The bundled sample note still drafts from recorded model output; paste that one to see the demo.");
    }
    const ai = recorded ? recordedCallerForNote1() : ctx.ai!;

    const result = await runDraftPipeline(ctx.dockmaster, ai, { transcript, technicianId: null, skipNarrative: true });
    const drafts = result.drafts;
    const main = drafts[0];
    const lines: TryItLine[] = (main?.lines ?? []).map((l) => ({
      kind: l.kind,
      code: l.operationCodeId ?? null,
      description: l.description,
      hours: l.hours ?? null,
      qty: l.qty ?? 1,
      rate: l.rate ?? null,
      unitPrice: l.unitPrice ?? null,
      lineTotal: l.lineTotal,
      confidence: l.confidence ?? null,
      sourceNote: l.sourceNote ?? null,
      stockWarning: l.stockWarning ?? null,
      included: l.included ?? true,
    }));

    // A visitor who leaves details becomes an account (new logo, source try_it).
    let account: Account | null = input.accountId ? await ctx.gtm.getAccount(input.accountId) : null;
    const notes: string[] = [];
    if (input.lead) {
      const existing = (await ctx.gtm.listAccounts()).find((a) => a.name.toLowerCase() === input.lead!.yardName.toLowerCase());
      if (existing) {
        account = existing;
        notes.push(`Lead matched existing account ${existing.name}.`);
      } else {
        const ae = TEAM.find((t) => t.name === "Casey Morgan")!;
        account = await ctx.gtm.createAccount({
          name: input.lead.yardName,
          city: "Unknown",
          state: "",
          segment: "new_logo",
          platform: input.lead.platform,
          source: "try_it",
          stage: "sandbox",
          ownerName: ae.name,
          ownerRole: "AE",
          contextFile: `# ${input.lead.yardName}\nCreated from a Try-It session by ${input.lead.name} (${input.lead.email}).`,
        });
      }
      if (account.stage === "target" || account.stage === "contacted") {
        account = await ctx.gtm.updateAccount(account.id, { stage: "sandbox" });
      }
    }

    const out: TryItResult = {
      transcript,
      recorded,
      vessel: result.vessel
        ? {
            name: result.vessel.name,
            detail: `${result.vessel.year} ${result.vessel.make} ${result.vessel.model}, ${result.vessel.location}, ${result.vessel.customer.name}`,
            confidence: result.vesselMatch.confidence,
            reasons: result.vesselMatch.reasons,
          }
        : null,
      findings: result.extraction.findings.map((f) => ({ system: f.system, recommendation: f.technicianRecommendation, severity: f.severity })),
      lines,
      total: main?.totals.total ?? 0,
      separateDrafts: Math.max(0, drafts.length - 1),
      latencyMs: result.totalLatencyMs,
      accountId: account?.id ?? null,
      accountName: account?.name ?? null,
      lead: input.lead ?? null,
      nextStep: NEXT_STEP,
    };

    return {
      output: out,
      sourceQueries: [],
      steps: result.trace.steps.map((s) => ({ step: s.step, latencyMs: s.latencyMs, model: s.model })),
      queue: input.lead
        ? {
            kind: "try_it_lead",
            title: `Try-It lead: ${input.lead.yardName} (${input.lead.name})`,
            sourceData: { transcript, vessel: out.vessel?.name ?? null, lines: lines.length, total: out.total },
          }
        : null,
      contextLine: input.lead
        ? `Try-It session by ${input.lead.name}: ${lines.filter((l) => l.kind === "operation").length} operation lines drafted in ${(result.totalLatencyMs / 1000).toFixed(1)}s; book a 20 minute call`
        : `Anonymous Try-It session: ${lines.filter((l) => l.kind === "operation").length} operation lines drafted`,
      notes,
      accountId: account?.id ?? null,
    };
  },
};
