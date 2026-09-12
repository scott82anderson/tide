/**
 * Partner Agent: runs the OEM, distributor, insurer and association channel.
 * Writes a partner brief, co-marketing ideas and a lead-routing rule for the
 * Partnerships lead to approve.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import { BRAND_VOICE } from "../brand-voice";
import { PartnerBriefSchema, type PartnerBrief } from "../schemas";
import { lintCopy } from "../style-lint";
import type { Partner } from "../types";
import { AgentBlockedError, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `${BRAND_VOICE}

You write a partner brief for a marina software company. Engine OEMs and parts distributors benefit from faster, more accurate service and parts orders. Marine insurers benefit from documented work that reduces claims friction. PE operating partners want standardisation and recovered revenue per site. Associations want member value and conference content. Say why this partner should care, propose two or three co-marketing ideas with timing around the boating season, and state how leads from the partner reach an account executive. No hype, no promises.`;

export interface PartnerInput {
  partnerId: string;
}

export interface PartnerOutput extends PartnerBrief {
  partner: Partner;
}

export const partnerAgent: AgentDefinition<PartnerInput, PartnerOutput> = {
  key: "partner_agent",
  name: "Partner Agent",
  job: "Run the OEM, distributor and association channel",
  inputs: "Partner lists, co-marketing calendars",
  output: "Partner briefs, co-branded content, lead routing",
  owner: "Partnerships lead",
  modelTier: "strong",
  needsAccount: false,
  async run(ctx, input): Promise<AgentResult<PartnerOutput>> {
    const ai = requireAi(ctx);
    const partner = await ctx.gtm.getPartner(input.partnerId);
    if (!partner) throw new AgentBlockedError("Pick a partner from the list.");

    const { output, latencyMs, model } = await ai.call({
      name: "write_partner_brief",
      description: "Write the partner brief.",
      system: SYSTEM,
      model: MODEL_STRONG,
      maxTokens: 2000,
      schema: PartnerBriefSchema,
      user: JSON.stringify({ partner: { name: partner.name, kind: partner.kind, focus: partner.focus, contacts: partner.contacts, notes: partner.notes }, seasonNote: "Marinas do not buy during haul-out (Oct to Nov) or commissioning (Mar to Apr); align pushes to the shoulder months." }, null, 2),
    });

    const notes: string[] = [];
    const lint = lintCopy([output.brief, ...output.whyTheyCare, ...output.asks].join("\n"), { maxWords: 400 });
    if (!lint.ok) notes.push(...lint.issues.map((i) => `Brief lint: ${i.message}`));

    return {
      output: { ...output, partner },
      sourceQueries: [],
      steps: [{ step: "write_partner_brief", latencyMs, model }],
      queue: { kind: "partner_brief", title: `Partner brief: ${partner.name}`, sourceData: { partner } },
      contextLine: `Partner Agent drafted a brief for ${partner.name} (${partner.kind})`,
      notes,
    };
  },
};
