/**
 * Orchestrates steps 2-6 for a technician note. Two entry points:
 *
 *   runDraftPipeline  - pure-ish: reads through the DockMasterClient, calls the
 *                       model, returns drafts without writing them. Used by the
 *                       eval harness and the CLI.
 *   draftFromTechNote - the app path: runs the pipeline, persists the estimates
 *                       and logs every step to the activity log.
 */

import type { DockMasterClient } from "@/lib/dockmaster/client";
import type { Estimate, ReasoningStep, ReasoningTrace, Vessel } from "@/lib/dockmaster/types";
import type { StructuredCaller } from "./anthropic";
import { buildEstimates, type DraftEstimate } from "./build-estimate";
import { extractFindings, type PhotoAttachment } from "./extract";
import { matchOperations, type OperationMatchResult } from "./match-operations";
import { matchVessel, type VesselMatchResult } from "./match-vessel";
import { applyNarrative, writeNarrative } from "./narrative";
import type { Extraction } from "./schemas";

export type PipelineStage =
  | "reading_note"
  | "matching_vessel"
  | "matching_operations"
  | "pricing"
  | "writing"
  | "saving";

export interface PipelineInput {
  transcript: string;
  technicianId: string | null;
  photos?: PhotoAttachment[];
  photoPaths?: string[];
  techNoteId?: string | null;
  /** Skip the vessel match and use this vessel (manager confirmed from shortlist). */
  vesselIdOverride?: string | null;
  /** Skip step 6 (eval harness). */
  skipNarrative?: boolean;
  onStage?: (stage: PipelineStage) => void;
}

export interface PipelineResult {
  extraction: Extraction;
  vesselMatch: VesselMatchResult;
  vessel: Vessel | null;
  matches: OperationMatchResult[];
  drafts: DraftEstimate[];
  trace: ReasoningTrace;
  totalLatencyMs: number;
}

export async function runDraftPipeline(
  client: DockMasterClient,
  ai: StructuredCaller,
  input: PipelineInput,
): Promise<PipelineResult> {
  const started = Date.now();
  const steps: ReasoningStep[] = [];
  const notes: string[] = [];

  // Step 2: extract
  input.onStage?.("reading_note");
  const extracted = await extractFindings(ai, input.transcript, input.photos ?? []);
  steps.push({
    step: "extract_findings",
    latencyMs: extracted.latencyMs,
    model: extracted.model,
    input: { transcript: input.transcript, photos: (input.photos ?? []).map((p) => p.path) },
    output: extracted.output,
  });
  const extraction = extracted.output;

  // Step 3: match vessel
  input.onStage?.("matching_vessel");
  let vesselMatch: VesselMatchResult;
  if (input.vesselIdOverride) {
    vesselMatch = {
      vesselId: input.vesselIdOverride,
      confidence: 1,
      reasons: ["Confirmed by service manager"],
      candidates: [],
      method: "deterministic",
      latencyMs: 0,
    };
  } else {
    vesselMatch = await matchVessel(client, ai, {
      hinSuffix: extraction.vesselHints.hinSuffix ?? undefined,
      boatName: extraction.vesselHints.boatName ?? undefined,
      makeModel: extraction.vesselHints.makeModel ?? undefined,
      slip: extraction.vesselHints.slip ?? undefined,
      ownerLastName: extraction.vesselHints.ownerLastName ?? undefined,
    });
  }
  steps.push({
    step: "match_vessel",
    latencyMs: vesselMatch.latencyMs,
    input: extraction.vesselHints,
    output: {
      vesselId: vesselMatch.vesselId,
      confidence: vesselMatch.confidence,
      reasons: vesselMatch.reasons,
      method: vesselMatch.method,
      candidates: vesselMatch.candidates.map((c) => ({ id: c.vessel.id, name: c.vessel.name, score: c.score })),
    },
  });
  const vessel = vesselMatch.vesselId ? await client.getVessel(vesselMatch.vesselId) : null;

  // Step 4: match operations
  input.onStage?.("matching_operations");
  const catalogue = await client.listOperationCodes();
  const matched = await matchOperations(ai, extraction.findings, catalogue);
  notes.push(...matched.notes);
  steps.push({
    step: "match_operations",
    latencyMs: matched.latencyMs,
    input: matched.results.map((r) => ({
      finding: r.finding.technicianRecommendation,
      shortlist: r.shortlist.map((s) => s.code),
    })),
    output: matched.results.map((r) => ({
      finding: r.finding.technicianRecommendation,
      code: r.code?.code ?? null,
      confidence: r.confidence,
      rationale: r.rationale,
    })),
  });

  // Step 5: build (needs a vessel for history and pricing context)
  input.onStage?.("pricing");
  let drafts: DraftEstimate[] = [];
  if (vessel) {
    const t5 = Date.now();
    const [marina, history, technician] = await Promise.all([
      client.getMarina(),
      client.getVesselHistory(vessel.id),
      input.technicianId ? client.getTechnician(input.technicianId) : Promise.resolve(null),
    ]);
    drafts = await buildEstimates({
      client,
      marina,
      vessel,
      history,
      technician,
      matches: matched.results,
      techNoteId: input.techNoteId,
      photoPaths: input.photoPaths,
    });
    for (const d of drafts) notes.push(...d.buildNotes);
    steps.push({
      step: "build_estimate",
      latencyMs: Date.now() - t5,
      input: { vessel: vessel.name, laborRate: marina.laborRate, historyWorkOrders: history.length },
      output: drafts.map((d) => ({
        title: d.title,
        lines: d.lines.length,
        total: d.totals.total,
        flags: d.historyFlags,
        requiresManagerApproval: d.requiresManagerApproval,
      })),
    });
  } else {
    notes.push("No vessel matched, so no estimate was priced. Confirm the vessel to continue.");
  }

  // Step 6: narrative
  if (vessel && drafts.length && !input.skipNarrative) {
    input.onStage?.("writing");
    // One narrative call per draft, in parallel: they are independent.
    const narratives = await Promise.all(drafts.map((d) => writeNarrative(ai, d, vessel, input.transcript)));
    drafts = drafts.map((draft, i) => {
      const n = narratives[i];
      steps.push({
        step: "write_narrative",
        latencyMs: n.latencyMs,
        model: n.model,
        input: { title: draft.title },
        output: n.output,
      });
      return applyNarrative(draft, n.output);
    });
  }

  return {
    extraction,
    vesselMatch,
    vessel,
    matches: matched.results,
    drafts,
    trace: { steps, notes },
    totalLatencyMs: Date.now() - started,
  };
}

/** App path: run the pipeline, persist the drafts, log each step. */
export async function draftFromTechNote(
  client: DockMasterClient,
  ai: StructuredCaller,
  input: PipelineInput,
): Promise<{ result: PipelineResult; estimates: Estimate[] }> {
  const result = await runDraftPipeline(client, ai, input);
  input.onStage?.("saving");

  const estimates: Estimate[] = [];
  let parentId: string | null = null;
  for (const draft of result.drafts) {
    const est = await client.createEstimate({
      ...draft,
      parentEstimateId: draft.quoteSeparately ? parentId : null,
      vesselMatchConfidence: result.vesselMatch.confidence,
      vesselMatchReasons: result.vesselMatch.reasons,
      reasoning: result.trace,
    });
    if (!draft.quoteSeparately) parentId = est.id;
    estimates.push(est);

    await client.logActivity({
      actor: "ai",
      action: "estimate.drafted",
      entityType: "estimate",
      entityId: est.id,
      payload: {
        title: est.title,
        total: est.totals.total,
        lines: est.lines.length,
        vesselConfidence: result.vesselMatch.confidence,
        latencyMs: result.totalLatencyMs,
      },
    });
  }

  for (const step of result.trace.steps) {
    await client.logActivity({
      actor: "ai",
      action: `pipeline.${step.step}`,
      entityType: "tech_note",
      entityId: input.techNoteId ?? "adhoc",
      payload: { latencyMs: step.latencyMs, model: step.model, input: step.input, output: step.output },
    });
  }

  return { result, estimates };
}
