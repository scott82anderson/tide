/**
 * Deal Desk: builds the proposal and ROI model. Pricing and the discount check
 * are deterministic (pricing.ts); the strongest model writes the executive
 * summary from the figures it is given, and the summary is linted so it cannot
 * quote a number the model was not shown. A discount outside policy is refused
 * here and routed to a human.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import { BRAND_VOICE } from "../brand-voice";
import { DISCOUNT_POLICY, TIERS, quote, type PriceQuote } from "../pricing";
import { ProposalNarrativeSchema, type ProposalNarrative } from "../schemas";
import { lintCopy } from "../style-lint";
import type { SourceQuery, Tier } from "../types";
import { latestScout } from "./crm-reads";
import { AgentBlockedError, fig, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `${BRAND_VOICE}

You write the narrative for a software proposal to a marina. Use only the figures provided, exactly as given. The executive summary states what the yard's own data shows, what the Service Writer does about it, the price and the payback. No promises about outcomes: say "your data shows" and "the model assumes".`;

export interface DealDeskInput {
  accountId: string;
  tier: Tier;
  discountPct: number;
  locations?: number;
}

export interface Proposal {
  tier: Tier;
  tierName: string;
  includes: string[];
  quote: PriceQuote;
  roi: {
    recoverableAnnualUsd: number;
    netAnnualUsd: number;
    paybackMonths: number;
    roiMultiple: number;
  };
  financeSignOff: boolean;
  narrative: ProposalNarrative;
  figures: SourceQuery[];
}

export const dealDesk: AgentDefinition<DealDeskInput, Proposal> = {
  key: "deal_desk",
  name: "Deal Desk",
  job: "Build the proposal and ROI model",
  inputs: "Scout numbers, tier rules, discount policy",
  output: "Proposal, ROI sheet, redline suggestions within policy",
  owner: "AE",
  modelTier: "strong",
  needsAccount: true,
  async run(ctx, input, account): Promise<AgentResult<Proposal>> {
    const ai = requireAi(ctx);
    const acct = account!;
    const discountPct = Math.max(0, Math.round(input.discountPct ?? 0));
    if (discountPct > DISCOUNT_POLICY.financeMaxPct) {
      throw new AgentBlockedError(`A ${discountPct}% discount exceeds policy (Finance can approve up to ${DISCOUNT_POLICY.financeMaxPct}%). Deal Desk cannot build this proposal; take it to Finance.`);
    }
    const scout = await latestScout(ctx.gtm, acct.id);
    if (!scout) throw new AgentBlockedError("Run the Opportunity Scout first: the ROI model is built from its figures.");
    const def = TIERS[input.tier];
    if (def.requiresWeb && !acct.products.includes("web") && acct.segment === "install_base") {
      // Not a block: the migration is part of the deal, but the reviewer must see it.
    }
    const locations = Math.max(1, input.locations ?? 1);
    const techs = Math.max(1, acct.technicianCount);
    const q = quote(input.tier, locations, techs, acct.laborRate || 150, discountPct);
    const recoverable = scout.report.totalAnnualUsd;
    const paybackMonths = recoverable > 0 ? Math.round((q.netAnnual / (recoverable / 12)) * 10) / 10 : 0;
    const roiMultiple = q.netAnnual > 0 ? Math.round((recoverable / q.netAnnual) * 10) / 10 : 0;

    const figures: SourceQuery[] = [
      ...scout.report.figures,
      fig("listAnnual", "List price, annual", q.listAnnual, "usd", `${locations} location(s) x $${q.perLocationMonthly} + ${techs} technician(s) x $${q.perTechMonthly}, x 12`),
      fig("discountPct", "Discount", discountPct, "pct", "requested by AE"),
      fig("netAnnual", "Net price, annual", q.netAnnual, "usd", "list x (1 - discount)"),
      fig("paybackMonths", "Payback", paybackMonths, "days", "net annual / (recoverable annual / 12)"),
      fig("roiMultiple", "Return multiple", roiMultiple, "count", "recoverable annual / net annual"),
      fig("technicians", "Technicians priced", techs, "count", "account.technicianCount"),
      fig("perLocationMonthly", "Per location, monthly", q.perLocationMonthly, "usd", "pricing.ts"),
      fig("perTechMonthly", "Per technician, monthly", q.perTechMonthly, "usd", "pricing.ts"),
    ];

    const { output, latencyMs, model } = await ai.call({
      name: "write_proposal_narrative",
      description: "Write the proposal narrative from the figures.",
      system: SYSTEM,
      model: MODEL_STRONG,
      maxTokens: 1500,
      schema: ProposalNarrativeSchema,
      user: JSON.stringify(
        {
          account: { name: acct.name, segment: acct.segment, platform: acct.platform, products: acct.products },
          tier: { name: def.name, includes: def.includes },
          figures: figures.filter((f) => f.value > 0).map((f) => ({ label: f.label, value: f.value, unit: f.unit })),
          migrationNeeded: scout.report.fit.migrationNeeded,
          discountStatus: q.discountStatus,
        },
        null,
        2,
      ),
    });

    const notes: string[] = [];
    const lint = lintCopy([output.executiveSummary, ...output.whyNow, ...output.nextSteps].join("\n"), { figures, maxWords: 260 });
    if (!lint.ok) notes.push(...lint.issues.map((i) => `Narrative lint: ${i.message}`));
    if (q.discountStatus === "needs_finance") notes.push(`Discount of ${discountPct}% is above the AE limit of ${DISCOUNT_POLICY.aeMaxPct}%: Finance sign-off required before sending.`);
    if (scout.report.fit.migrationNeeded) notes.push("Account is not on Web and Mobile: the proposal must include the migration plan.");
    if (scout.report.confidence === "low") notes.push("ROI is built from a low-confidence Scout report (no data consent).");

    const proposal: Proposal = {
      tier: input.tier,
      tierName: def.name,
      includes: def.includes,
      quote: q,
      roi: { recoverableAnnualUsd: recoverable, netAnnualUsd: q.netAnnual, paybackMonths, roiMultiple },
      financeSignOff: q.discountStatus === "needs_finance",
      narrative: output,
      figures,
    };

    return {
      output: proposal,
      sourceQueries: figures,
      steps: [{ step: "price_and_roi", latencyMs: 0 }, { step: "write_narrative", latencyMs, model }],
      queue: {
        kind: "proposal",
        title: `Proposal: ${acct.name}, ${def.name}, $${q.netAnnual.toLocaleString("en-US")}/yr${proposal.financeSignOff ? " (Finance)" : ""}`,
        sourceData: { scoutQueueItemId: scout.item.id, quote: q },
      },
      contextLine: `Deal Desk built a ${def.name} proposal at $${q.netAnnual.toLocaleString("en-US")}/yr (${discountPct}% discount, ${q.discountStatus}), payback ${paybackMonths} months`,
      notes,
    };
  },
};
