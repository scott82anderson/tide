/**
 * Objection Coach: live call support. Given a transcript excerpt, it finds the
 * objections, picks the matching entries from the objection library (never a
 * made-up one), adapts the response to the account's own numbers, and drafts
 * follow-up tasks and a CRM note. A new objection comes back as "none" and is
 * routed to Voice of Customer.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import { BRAND_VOICE } from "../brand-voice";
import { OBJECTIONS, OBJECTION_BY_ID } from "../objection-library";
import { CallCoachSchema, type CallCoach } from "../schemas";
import { lintCopy } from "../style-lint";
import type { SourceQuery } from "../types";
import { latestScout } from "./crm-reads";
import { AgentBlockedError, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `${BRAND_VOICE}

You support an account executive on a live call. Read the transcript excerpt, find each objection the prospect raised, and match it to the objection library by id. Adapt the library response to this account using only the figures provided; if none fit, use the library proof point. If an objection is not in the library, use the id "none" and write the best honest response. Then list follow-up tasks with an owner and a CRM note.`;

export interface CoachInput {
  transcript: string;
  accountId?: string | null;
}

export interface CoachOutput extends CallCoach {
  libraryHits: { objectionId: string; libraryObjection: string }[];
  newObjections: number;
}

export const objectionCoach: AgentDefinition<CoachInput, CoachOutput> = {
  key: "objection_coach",
  name: "Objection Coach",
  job: "Live call support",
  inputs: "Transcript from the call, objection library",
  output: "Suggested responses, follow-up tasks, CRM notes",
  owner: "AE",
  modelTier: "strong",
  needsAccount: false,
  async run(ctx, input, account): Promise<AgentResult<CoachOutput>> {
    const ai = requireAi(ctx);
    const transcript = input.transcript.trim();
    if (!transcript) throw new AgentBlockedError("Paste a transcript excerpt first.");
    const scout = account ? await latestScout(ctx.gtm, account.id) : null;
    const figures: SourceQuery[] = (scout?.report.figures ?? []).filter((f) => f.value > 0);

    const { output, latencyMs, model } = await ai.call({
      name: "coach_call",
      description: "Detect objections and suggest responses.",
      system: SYSTEM,
      model: MODEL_STRONG,
      maxTokens: 3000,
      schema: CallCoachSchema,
      user: JSON.stringify(
        {
          account: account ? { name: account.name, segment: account.segment, platform: account.platform } : null,
          figures: figures.map((f) => ({ label: f.label, value: f.value, unit: f.unit })),
          objectionLibrary: OBJECTIONS,
          transcript,
        },
        null,
        2,
      ),
    });

    const notes: string[] = [];
    const detected = output.detected.map((d) => {
      if (d.objectionId === "none" || OBJECTION_BY_ID.has(d.objectionId)) return d;
      notes.push(`Objection id "${d.objectionId}" is not in the library; treated as new.`);
      return { ...d, objectionId: "none" };
    });
    const newObjections = detected.filter((d) => d.objectionId === "none").length;
    if (newObjections > 0) notes.push(`${newObjections} objection(s) not in the library: routed to Voice of Customer.`);
    const lint = lintCopy(detected.map((d) => d.suggestedResponse).join("\n"), { figures });
    if (!lint.ok) notes.push(...lint.issues.map((i) => `Response lint: ${i.message}`));

    return {
      output: {
        ...output,
        detected,
        libraryHits: detected.filter((d) => d.objectionId !== "none").map((d) => ({ objectionId: d.objectionId, libraryObjection: OBJECTION_BY_ID.get(d.objectionId)!.objection })),
        newObjections,
      },
      sourceQueries: figures,
      steps: [{ step: "coach_call", latencyMs, model }],
      queue: {
        kind: "call_notes",
        title: `Call notes${account ? `: ${account.name}` : ""} (${detected.length} objection(s))`,
        sourceData: { transcript, libraryIds: OBJECTIONS.map((o) => o.id) },
      },
      contextLine: `Objection Coach handled ${detected.length} objection(s) on a call [${detected.map((d) => d.objectionId).join(", ") || "none"}], ${output.followUps.length} follow-up(s)`,
      notes,
    };
  },
};
