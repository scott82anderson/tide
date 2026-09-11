import type { Vessel } from "@/lib/dockmaster/types";
import type { StructuredCaller, StructuredResult } from "./anthropic";
import type { DraftEstimate } from "./build-estimate";
import { NarrativeSchema, type Narrative } from "./schemas";

const SYSTEM = `You write the customer-facing wording for a marina service estimate.

The reader is a boat owner, not a mechanic. For each line, explain in plain language what will be done and why it matters, two sentences maximum. No jargon, no part numbers, no upsell language, no urgency tricks, no promises about outcomes. Do not mention prices or hours; the estimate shows those. Do not invent findings; only use the technician's observations you are given.

Also write a customerSummary (two or three sentences about the overall job, warm and direct) and an internalSummary for the work order (technician shorthand is fine, include the concrete observations like temperatures and part conditions).`;

export async function writeNarrative(
  ai: StructuredCaller,
  draft: DraftEstimate,
  vessel: Vessel,
  transcript: string,
): Promise<StructuredResult<Narrative>> {
  const operationLines = draft.lines.filter((l) => l.kind !== "part");
  return ai.call({
    name: "write_estimate_wording",
    description: "Write plain language descriptions for each estimate line and two summaries.",
    system: SYSTEM,
    user: JSON.stringify(
      {
        vessel: `${vessel.year} ${vessel.make} ${vessel.model} "${vessel.name}"`,
        technicianNote: transcript,
        lines: operationLines.map((l) => ({
          lineKey: l.key,
          description: l.description,
          technicianWords: l.sourceNote,
          rationale: l.rationale,
        })),
      },
      null,
      2,
    ),
    schema: NarrativeSchema,
    maxTokens: 2048,
  });
}

/** Applies narrative output back onto the draft. Unknown keys are ignored. */
export function applyNarrative(draft: DraftEstimate, narrative: Narrative): DraftEstimate {
  const byKey = new Map(narrative.lines.map((l) => [l.lineKey, l.customerDescription]));
  return {
    ...draft,
    customerSummary: narrative.customerSummary,
    internalSummary: narrative.internalSummary,
    lines: draft.lines.map((l) =>
      l.key && byKey.has(l.key) ? { ...l, customerDescription: byKey.get(l.key) } : l,
    ),
  };
}
