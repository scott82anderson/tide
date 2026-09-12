/**
 * Onboarding Agent: gets an account to first value fast. It reads the yard's
 * exported operation codes, finds duplicate candidates deterministically, then
 * has the cheaper model confirm merges, propose the technician keywords the
 * matcher needs, suggest kits, and write the migration checklist and training
 * plan per role. The only write any GTM agent makes to DockMaster (applying
 * approved merges) happens after the CSM approves the queue item.
 */

import { MODEL_CHEAP } from "@/lib/ai/anthropic";
import { OnboardingSchema, type OnboardingPlan } from "../schemas";
import type { AccountCode } from "../types";
import { AgentBlockedError, fig, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `You clean up a boatyard's operation code list before the Service Writer goes live. You are given the raw codes and the duplicate candidates a similarity pass found. Confirm which candidates are true duplicates (same work, different wording) and which are distinct (port vs starboard, inspect vs replace, different systems). Keep the code with the higher usage as the survivor. For every surviving code, list the words a technician would actually say. Suggest kit part descriptions where the operation obviously consumes parts. Write a migration checklist and a training plan per role. Use only codes from the list.`;

const STOP = new Set(["and", "the", "of", "a", "an", "to", "for", "with", "in", "on", "or", "per", "each", "both", "svc", "service"]);

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t))
      .map((t) => t.replace(/s$/, "")),
  );
}

/**
 * Overlap coefficient over description tokens: shared tokens divided by the
 * shorter description's token count, so "IMPELLER" scores high against
 * "Water pump impeller replace". Candidates only; the model confirms.
 */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

export interface DuplicateCandidate {
  a: string;
  b: string;
  similarity: number;
}

export function findDuplicateCandidates(codes: AccountCode[], threshold = 0.6): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const s = similarity(codes[i].description, codes[j].description);
      if (s >= threshold) out.push({ a: codes[i].code, b: codes[j].code, similarity: Math.round(s * 100) / 100 });
    }
  }
  return out.sort((x, y) => y.similarity - x.similarity);
}

export interface OnboardingInput {
  accountId: string;
}

export interface OnboardingOutput extends OnboardingPlan {
  codesRead: number;
  candidatePairs: DuplicateCandidate[];
  survivingCodes: number;
}

export const onboardingAgent: AgentDefinition<OnboardingInput, OnboardingOutput> = {
  key: "onboarding_agent",
  name: "Onboarding Agent",
  job: "Get accounts to first value fast",
  inputs: "Account's operation codes, parts catalogue, technician roster",
  output: "Cleaned and deduplicated codes, keyword mapping, kit suggestions, migration checklist, training plan per role",
  owner: "CSM",
  modelTier: "cheap",
  needsAccount: true,
  async run(ctx, _input, account): Promise<AgentResult<OnboardingOutput>> {
    const ai = requireAi(ctx);
    const acct = account!;
    const codes = await ctx.gtm.listAccountCodes(acct.id);
    if (codes.length === 0) throw new AgentBlockedError(`${acct.name} has not exported its operation codes yet. Ask the CSM to pull them from the account's DockMaster.`);
    const t0 = Date.now();
    const candidates = findDuplicateCandidates(codes);
    const known = new Set(codes.map((c) => c.code));

    const { output, latencyMs, model } = await ai.call({
      name: "plan_onboarding",
      description: "Confirm merges, map keywords, suggest kits, write the checklist and training plan.",
      system: SYSTEM,
      model: MODEL_CHEAP,
      maxTokens: 4000,
      schema: OnboardingSchema,
      user: JSON.stringify(
        {
          account: { name: acct.name, technicians: acct.technicianCount, vesselMix: acct.vesselMix, platform: acct.platform },
          codes: codes.map((c) => ({ code: c.code, description: c.description, hours: c.hours, usageCount: c.usageCount })),
          duplicateCandidates: candidates,
        },
        null,
        2,
      ),
    });

    const notes: string[] = [];
    const merges = output.merges.filter((m) => {
      const ok = known.has(m.fromCode) && known.has(m.intoCode) && m.fromCode !== m.intoCode;
      if (!ok) notes.push(`Dropped merge ${m.fromCode} into ${m.intoCode}: not both in the export.`);
      return ok;
    });
    const keywordMap = output.keywordMap.filter((k) => known.has(k.code));
    const kitSuggestions = output.kitSuggestions.filter((k) => known.has(k.code));
    const merged = new Set(merges.map((m) => m.fromCode));
    const survivingCodes = codes.filter((c) => !merged.has(c.code)).length;
    const uncovered = codes.filter((c) => !merged.has(c.code) && !keywordMap.some((k) => k.code === c.code)).length;
    if (uncovered > 0) notes.push(`${uncovered} surviving code(s) have no keywords yet; the matcher will rely on descriptions for those.`);

    return {
      output: { ...output, merges, keywordMap, kitSuggestions, codesRead: codes.length, candidatePairs: candidates, survivingCodes },
      sourceQueries: [
        fig("codesRead", "Codes exported", codes.length, "count", "GtmClient.listAccountCodes"),
        fig("candidatePairs", "Duplicate candidates", candidates.length, "count", "token overlap coefficient >= 0.6 over descriptions"),
        fig("merges", "Merges proposed", merges.length, "count", "model confirmation over candidates"),
        fig("survivingCodes", "Codes after merge", survivingCodes, "count", "codes - merges"),
      ],
      steps: [
        { step: "find_duplicates", latencyMs: Date.now() - t0 - latencyMs },
        { step: "plan_onboarding", latencyMs, model },
      ],
      queue: {
        kind: "onboarding_plan",
        title: `Onboarding: ${acct.name} (${codes.length} codes, ${merges.length} merges)`,
        sourceData: { codes: codes.map((c) => ({ code: c.code, description: c.description, usageCount: c.usageCount })), candidates },
      },
      contextLine: `Onboarding Agent read ${codes.length} codes, proposed ${merges.length} merge(s) and keywords for ${keywordMap.length} code(s); merges apply only after CSM approval`,
      notes,
    };
  },
};
