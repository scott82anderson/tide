/**
 * Proof Agent: turns a design partner's before-and-after telemetry into a case
 * study draft, ROI stats and conference slide bullets, with quote drafts for
 * the customer to edit and sign off. Requires the account's consent, and every
 * number in the draft is linted against the metrics provided.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import { BRAND_VOICE } from "../brand-voice";
import { CaseStudySchema, type CaseStudy } from "../schemas";
import { lintCopy } from "../style-lint";
import type { SourceQuery } from "../types";
import { computeHealth } from "./adoption-agent";
import { latestScout } from "./crm-reads";
import { AgentBlockedError, fig, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `${BRAND_VOICE}

You draft a customer case study for a marina software company from before-and-after metrics. Use the figures exactly as given; do not compute new ones. The quotes are drafts for the customer to edit and sign off, so mark nothing as final and keep them modest and specific. No superlatives.`;

export interface ProofInput {
  accountId: string;
}

export interface ProofOutput extends CaseStudy {
  consentOnFile: boolean;
  metrics: SourceQuery[];
}

export const proofAgent: AgentDefinition<ProofInput, ProofOutput> = {
  key: "proof_agent",
  name: "Proof Agent",
  job: "Turn results into collateral",
  inputs: "Before and after metrics per design partner (with consent)",
  output: "Case studies, ROI stats, conference slides, testimonial drafts for sign-off",
  owner: "Marketing",
  modelTier: "strong",
  needsAccount: true,
  async run(ctx, _input, account): Promise<AgentResult<ProofOutput>> {
    const ai = requireAi(ctx);
    const acct = account!;
    if (!acct.dataConsent) throw new AgentBlockedError(`${acct.name} has not consented to its data being used. Case studies need a recorded opt-in.`);
    const weeks = await ctx.gtm.listAccountWeeks(acct.id);
    if (weeks.length < 4) throw new AgentBlockedError(`${acct.name} needs at least four weeks of telemetry for a before-and-after story.`);
    const health = computeHealth(weeks, acct.tier, acct.name);
    const scout = await latestScout(ctx.gtm, acct.id);
    const t = health.trends;
    const metrics: SourceQuery[] = [
      fig("editRateBefore", "Edit rate, first two weeks", Math.round(t.editRate.first * 100), "pct", "telemetry"),
      fig("editRateAfter", "Edit rate, last two weeks", Math.round(t.editRate.last * 100), "pct", "telemetry"),
      fig("draftsBefore", "Drafts a week, first two weeks", t.draftsStarted.first, "count", "telemetry"),
      fig("draftsAfter", "Drafts a week, last two weeks", t.draftsStarted.last, "count", "telemetry"),
      fig("approvalRate", "Customer approval rate", Math.round(t.approvalRate.last * 100), "pct", "telemetry"),
      fig("weeksOnBeta", "Weeks on the beta", weeks.length, "count", "telemetry"),
      fig("technicians", "Technicians recording notes", t.activeTechs.last, "count", "telemetry"),
      fig("arDaysBefore", "AR days, first two weeks", t.arDays.first, "days", "telemetry"),
      fig("arDaysAfter", "AR days, last two weeks", t.arDays.last, "days", "telemetry"),
    ];
    if (scout) metrics.push(fig("recoverable", "Revenue left on the dock, a year", scout.report.totalAnnualUsd, "usd", "Opportunity Scout"));

    const { output, latencyMs, model } = await ai.call({
      name: "draft_case_study",
      description: "Draft the case study from the metrics.",
      system: SYSTEM,
      model: MODEL_STRONG,
      maxTokens: 2500,
      schema: CaseStudySchema,
      user: JSON.stringify(
        {
          account: { name: acct.name, city: acct.city, state: acct.state, technicians: acct.technicianCount, vesselMix: acct.vesselMix, tier: acct.tier },
          metrics: metrics.map((m) => ({ label: m.label, value: m.value, unit: m.unit })),
          contacts: acct.contacts.map((c) => ({ name: c.name, title: c.title })),
        },
        null,
        2,
      ),
    });

    const notes: string[] = [];
    const lint = lintCopy([output.headline, output.summary, ...output.stats.map((s) => s.value), ...output.slideBullets].join("\n"), { figures: metrics, maxWords: 400 });
    if (!lint.ok) notes.push(...lint.issues.map((i) => `Case study lint: ${i.message}`));
    notes.push("Quotes are drafts: the customer must edit and sign off before any use.");

    return {
      output: { ...output, consentOnFile: acct.dataConsent, metrics },
      sourceQueries: metrics,
      steps: [{ step: "draft_case_study", latencyMs, model }],
      queue: { kind: "case_study", title: `Case study: ${acct.name}`, sourceData: { metrics } },
      contextLine: `Proof Agent drafted a case study (edit rate ${Math.round(t.editRate.first * 100)}% to ${Math.round(t.editRate.last * 100)}%); quotes await customer sign-off`,
      notes,
    };
  },
};
