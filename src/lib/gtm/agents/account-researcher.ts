/**
 * Account Researcher: enriches an account from public signals (reviews, job
 * postings, LinkedIn, website, associations). Classification work, so it runs
 * on the cheaper model. Every decision maker and trigger must cite the signal
 * it came from; anything citing an unknown signal is dropped and noted.
 */

import { MODEL_CHEAP } from "@/lib/ai/anthropic";
import { ResearchSchema, type Research } from "../schemas";
import type { AccountSignal } from "../types";
import { requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `You enrich sales accounts for a marina software company from raw public signals. The signals are the only source of truth: name people, systems and triggers only when a signal says so, and cite the signal id every time. Triggers worth flagging: a new service manager or GM, an expansion or new location, reviews that mention slow quotes or long waits, technician hiring, a platform change, conference registration. Do not infer anything the signals do not support. Plain language, no hype.`;

export interface ResearchInput {
  accountId: string;
}

export interface ResearchOutput {
  research: Research;
  signalsRead: number;
}

export const accountResearcher: AgentDefinition<ResearchInput, ResearchOutput> = {
  key: "account_researcher",
  name: "Account Researcher",
  job: "Enrich accounts and prospects",
  inputs: "Web, boat show exhibitor lists, Google reviews, job postings, LinkedIn, ABYC and AMI membership",
  output: "Firmographics, service-department size, tech stack, decision makers, triggers",
  owner: "SDR",
  modelTier: "cheap",
  needsAccount: true,
  async run(ctx, _input, account): Promise<AgentResult<ResearchOutput>> {
    const ai = requireAi(ctx);
    const signals: AccountSignal[] = await ctx.gtm.listSignals(account!.id);
    const ids = new Set(signals.map((s) => s.id));
    const notes: string[] = [];

    const { output, latencyMs, model } = await ai.call({
      name: "record_account_research",
      description: "Record what the public signals say about this account.",
      system: SYSTEM,
      model: MODEL_CHEAP,
      maxTokens: 2048,
      schema: ResearchSchema,
      user: JSON.stringify(
        {
          account: { name: account!.name, city: account!.city, state: account!.state, segment: account!.segment, knownPlatform: account!.platform, knownTechnicians: account!.technicianCount || null },
          signals: signals.map((s) => ({ id: s.id, source: s.source, observedAt: s.observedAt.toISOString().slice(0, 10), title: s.title, body: s.body })),
        },
        null,
        2,
      ),
    });

    // Shortlist rule: claims must cite a signal the model was shown.
    const decisionMakers = output.decisionMakers.filter((d) => {
      if (ids.has(d.sourceSignalId)) return true;
      notes.push(`Dropped decision maker "${d.name}": cited unknown signal ${d.sourceSignalId}`);
      return false;
    });
    const triggers = output.triggers.filter((t) => {
      if (ids.has(t.evidenceSignalId)) return true;
      notes.push(`Dropped trigger "${t.summary}": cited unknown signal ${t.evidenceSignalId}`);
      return false;
    });
    const research: Research = { ...output, decisionMakers, triggers };

    return {
      output: { research, signalsRead: signals.length },
      sourceQueries: [],
      steps: [{ step: "classify_signals", latencyMs, model }],
      queue: {
        kind: "research",
        title: `Research: ${account!.name}`,
        sourceData: { signals: signals.map((s) => ({ id: s.id, source: s.source, title: s.title, url: s.url })) },
      },
      contextLine: `Researcher read ${signals.length} signals: ${triggers.length} trigger(s) [${triggers.map((t) => t.type).join(", ") || "none"}], ${decisionMakers.length} decision maker(s)`,
      notes,
    };
  },
};
