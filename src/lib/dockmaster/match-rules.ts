import type { Vessel, VesselHint, VesselMatchCandidate } from "./types";

/**
 * Deterministic vessel ranking. Pure function so it can be unit tested without a
 * database and reused by any DockMasterClient implementation.
 *
 * Signal weights (additive, capped at 1):
 *   HIN suffix exact match          0.75
 *   slip / rack location match      0.35
 *   owner last name match           0.25
 *   make (and model) match          0.15 (+0.10 for model)
 *   boat name match                 0.45
 * A lone make match is not enough to identify a vessel.
 */

const WEIGHTS = {
  hin: 0.75,
  slip: 0.35,
  owner: 0.25,
  make: 0.15,
  model: 0.1,
  name: 0.45,
};

export function normalize(s: string | undefined | null): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeLocation(s: string | undefined | null): string {
  // "slip C-12", "C12", "c 12", "Rack B-07" -> "c12" / "b07"
  return normalize(s)
    .replace(/\b(slip|rack|dock|bay|space)\b/g, "")
    .replace(/\s+/g, "")
    .replace(/^([a-z])0*(\d+)$/, "$1$2");
}

function lastName(fullName: string): string {
  const parts = normalize(fullName).split(" ");
  return parts[parts.length - 1] ?? "";
}

export function rankVesselCandidates(
  vessels: Vessel[],
  hint: VesselHint,
): VesselMatchCandidate[] {
  const hinSuffix = normalize(hint.hinSuffix).replace(/\s+/g, "");
  const slip = normalizeLocation(hint.slip);
  const owner = normalize(hint.ownerLastName);
  const makeModel = normalize(hint.makeModel);
  const boatName = normalize(hint.boatName);

  const out: VesselMatchCandidate[] = [];

  for (const v of vessels) {
    let score = 0;
    const reasons: string[] = [];

    if (hinSuffix && normalize(v.hin).endsWith(hinSuffix)) {
      score += WEIGHTS.hin;
      reasons.push(`HIN ends in ${hinSuffix.toUpperCase()}`);
    }

    if (slip && normalizeLocation(v.location) === slip) {
      score += WEIGHTS.slip;
      reasons.push(`Location ${v.location} matches`);
    }

    if (owner) {
      const vesselOwnerLast = lastName(v.customer.name);
      if (vesselOwnerLast === owner || normalize(v.customer.name).includes(owner)) {
        score += WEIGHTS.owner;
        reasons.push(`Owner ${v.customer.name} matches "${hint.ownerLastName}"`);
      }
    }

    if (makeModel) {
      const make = normalize(v.make);
      const model = normalize(v.model);
      const makeHit = make && makeModel.includes(make);
      const modelHit =
        model &&
        model
          .split(" ")
          .filter((t) => t.length > 1)
          .every((t) => makeModel.includes(t));
      if (makeHit) {
        score += WEIGHTS.make;
        reasons.push(`Make ${v.make} matches`);
      }
      if (modelHit) {
        score += WEIGHTS.model;
        reasons.push(`Model ${v.model} matches`);
      }
    }

    if (boatName) {
      const name = normalize(v.name);
      if (name === boatName) {
        score += WEIGHTS.name;
        reasons.push(`Boat name "${v.name}" matches`);
      } else if (name.includes(boatName) || boatName.includes(name)) {
        score += WEIGHTS.name * 0.7;
        reasons.push(`Boat name "${v.name}" partially matches "${hint.boatName}"`);
      }
    }

    if (score > 0) {
      out.push({ vessel: v, score: Math.min(1, Number(score.toFixed(2))), reasons });
    }
  }

  out.sort((a, b) => b.score - a.score || a.vessel.name.localeCompare(b.vessel.name));
  return out.slice(0, 5);
}

/** Simple keyword score used to shortlist operation codes for a finding. */
export function scoreKeywords(text: string, keywords: string[]): number {
  const t = normalize(text);
  if (!t) return 0;
  let score = 0;
  for (const k of keywords) {
    const kw = normalize(k);
    if (!kw) continue;
    if (t.includes(kw)) {
      // longer phrases are stronger evidence than single words
      score += kw.includes(" ") ? 2 : 1;
    }
  }
  return score;
}
