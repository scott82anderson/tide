import type { DockMasterClient } from "@/lib/dockmaster/client";
import type { VesselHint, VesselMatchCandidate } from "@/lib/dockmaster/types";
import type { StructuredCaller } from "./anthropic";
import { VesselRankSchema } from "./schemas";

export interface VesselMatchResult {
  vesselId: string | null;
  confidence: number;
  reasons: string[];
  candidates: VesselMatchCandidate[];
  method: "deterministic" | "llm" | "none";
  latencyMs: number;
}

/** Below this the UI asks the manager to confirm from the shortlist. */
export const VESSEL_CONFIRM_THRESHOLD = 0.7;

const SYSTEM = `You help a marina service manager identify which boat a technician was talking about.
You are given the hints extracted from the technician's note and a short list of candidate vessels from the yard's records.
Pick the single best candidate only if the hints genuinely support it. Prefer hard identifiers (HIN suffix, slip) over soft ones (make, owner name). If the hints could describe more than one candidate equally, or none, return null with low confidence. Never invent a vessel.`;

function hasAnyHint(h: VesselHint): boolean {
  return Boolean(h.hinSuffix || h.boatName || h.makeModel || h.slip || h.ownerLastName);
}

export async function matchVessel(
  client: DockMasterClient,
  ai: StructuredCaller,
  hint: VesselHint,
): Promise<VesselMatchResult> {
  const started = Date.now();
  if (!hasAnyHint(hint)) {
    return { vesselId: null, confidence: 0, reasons: ["No vessel hints in the note"], candidates: [], method: "none", latencyMs: 0 };
  }

  // Step 1: deterministic ranking (HIN suffix, slip, owner + make, name).
  const candidates = await client.findVesselByHint(hint);
  const top = candidates[0];
  const second = candidates[1];

  if (top && top.score >= VESSEL_CONFIRM_THRESHOLD && (!second || top.score - second.score >= 0.2)) {
    return {
      vesselId: top.vessel.id,
      confidence: top.score,
      reasons: top.reasons,
      candidates,
      method: "deterministic",
      latencyMs: Date.now() - started,
    };
  }

  if (candidates.length === 0) {
    return {
      vesselId: null,
      confidence: 0,
      reasons: ["No vessel in the system matches the hints"],
      candidates,
      method: "none",
      latencyMs: Date.now() - started,
    };
  }

  // Step 2: ambiguous. Let the model weigh the shortlist, never the whole fleet.
  const { output } = await ai.call({
    name: "rank_vessel",
    description: "Choose the vessel the technician meant from the candidate list, or null.",
    system: SYSTEM,
    user: JSON.stringify(
      {
        hints: hint,
        candidates: candidates.map((c) => ({
          vesselId: c.vessel.id,
          name: c.vessel.name,
          year: c.vessel.year,
          make: c.vessel.make,
          model: c.vessel.model,
          hinSuffix: c.vessel.hin.slice(-4),
          location: c.vessel.location,
          owner: c.vessel.customer.name,
          engine: `${c.vessel.engineCount} x ${c.vessel.engineMake} ${c.vessel.engineModel}`,
          deterministicScore: c.score,
          deterministicReasons: c.reasons,
        })),
      },
      null,
      2,
    ),
    schema: VesselRankSchema,
    maxTokens: 512,
  });

  // Validate: the model may only pick from the shortlist.
  const chosen = output.vesselId ? candidates.find((c) => c.vessel.id === output.vesselId) : undefined;
  if (!chosen) {
    return {
      vesselId: null,
      confidence: Math.min(output.confidence, 0.5),
      reasons: output.reasons.length ? output.reasons : ["Model could not choose a vessel"],
      candidates,
      method: "llm",
      latencyMs: Date.now() - started,
    };
  }
  return {
    vesselId: chosen.vessel.id,
    // Blend so a strong deterministic signal is not overridden by an over-confident model.
    confidence: Number(Math.min(1, (output.confidence + chosen.score) / 2).toFixed(2)),
    reasons: [...chosen.reasons, ...output.reasons],
    candidates,
    method: "llm",
    latencyMs: Date.now() - started,
  };
}
