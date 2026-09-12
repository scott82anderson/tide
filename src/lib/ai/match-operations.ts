import type { OperationCode } from "@/lib/dockmaster/types";
import { scoreKeywords } from "@/lib/dockmaster/match-rules";
import type { StructuredCaller } from "./anthropic";
import { OperationMatchSchema, type Finding, type OperationChoice } from "./schemas";

export interface OperationMatchResult {
  finding: Finding;
  findingIndex: number;
  shortlist: OperationCode[];
  code: OperationCode | null;
  confidence: number;
  rationale: string;
  unmappedDescription: string | null;
}

export interface MatchOperationsOutput {
  results: OperationMatchResult[];
  notes: string[];
  latencyMs: number;
}

const SHORTLIST_SIZE = 6;

/** Words that appear in most catalogue descriptions and carry no signal. */
const GENERIC_WORDS = new Set([
  "replace",
  "repair",
  "inspect",
  "clean",
  "service",
  "check",
  "install",
  "remove",
  "engine",
  "system",
  "assembly",
]);

/** Which catalogue categories are plausible for a finding's system. */
const CATEGORY_MAP: Record<Finding["system"], string[]> = {
  engine: ["engine", "winterisation", "commissioning"],
  drive: ["drive", "engine"],
  electrical: ["electrical"],
  plumbing: ["plumbing", "engine"],
  hull: ["hull", "haul", "detailing"],
  canvas: ["canvas"],
  rigging: ["rigging"],
  haul: ["haul", "hull"],
  detailing: ["detailing", "hull"],
  winterisation: ["winterisation", "engine"],
  commissioning: ["commissioning", "engine"],
  hydraulics: ["hydraulics", "drive"],
  other: [],
};

export function findingText(f: Finding): string {
  return `${f.symptom} ${f.observation} ${f.technicianRecommendation}`;
}

/** Deterministic shortlist: keyword hits, with a bonus for category fit. */
export function shortlistOperations(finding: Finding, catalogue: OperationCode[]): OperationCode[] {
  const text = findingText(finding);
  const preferred = new Set(CATEGORY_MAP[finding.system] ?? []);
  const scored = catalogue
    .map((op) => {
      let score = scoreKeywords(text, op.keywords);
      if (score > 0 && preferred.has(op.category)) score += 1.5;
      // The description itself is a weak keyword source.
      const descWords = op.description
        .toLowerCase()
        .split(/[\s,/()]+/)
        .filter((w) => w.length > 4 && !GENERIC_WORDS.has(w));
      score += scoreKeywords(text, descWords) * 0.25;
      return { op, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.op.code.localeCompare(b.op.code));

  const list = scored.slice(0, SHORTLIST_SIZE).map((s) => s.op);
  // Always give the model a couple of category peers so "none of these" has context.
  if (list.length < 3) {
    for (const op of catalogue) {
      if (list.length >= 3) break;
      if (preferred.has(op.category) && !list.includes(op)) list.push(op);
    }
  }
  return list;
}

const SYSTEM = `You map a marine technician's findings onto a boatyard's operation codes.

For each finding you get a numbered shortlist of candidate operation codes with descriptions and standard hours. Choose the single code that best matches the technician's recommendation. Rules:
- Only choose a code that appears in that finding's shortlist. If nothing fits, return null and give a short unmappedDescription the manager can price by hand.
- Match the repair the technician recommended, not the symptom. "Impeller chewed up, replace impeller" is the impeller replacement code, not a cooling system diagnosis code.
- Do not pick a broader or more expensive job than the technician asked for. "Check the heat exchanger" is an inspection, not a replacement.
- When the technician names a failed or leaking component without spelling out the repair (for example "the trim tab actuator is leaking", "the float switch is stuck"), choose the standard corrective operation for that component (replace the actuator, replace the switch) with medium confidence rather than leaving it unmapped. Return null only when no shortlisted code addresses the component at all.
- Confidence: 0.9+ when the wording maps directly; 0.6-0.85 when it is a reasonable interpretation; below 0.6 when you are guessing.
- Rationale: one line, quote the technician's words that drove the choice.`;

export async function matchOperations(
  ai: StructuredCaller,
  findings: Finding[],
  catalogue: OperationCode[],
): Promise<MatchOperationsOutput> {
  const started = Date.now();
  const notes: string[] = [];
  if (findings.length === 0) return { results: [], notes: ["No findings to match"], latencyMs: 0 };

  const shortlists = findings.map((f) => shortlistOperations(f, catalogue));

  const { output } = await ai.call({
    name: "choose_operations",
    description: "Choose the best operation code for each finding from its shortlist.",
    system: SYSTEM,
    user: JSON.stringify(
      {
        findings: findings.map((f, i) => ({
          findingIndex: i,
          system: f.system,
          symptom: f.symptom,
          observation: f.observation,
          technicianRecommendation: f.technicianRecommendation,
          shortlist: shortlists[i].map((op) => ({
            code: op.code,
            description: op.description,
            category: op.category,
            standardHours: op.standardHours,
          })),
        })),
      },
      null,
      2,
    ),
    schema: OperationMatchSchema,
    maxTokens: 2048,
  });

  const byIndex = new Map<number, OperationChoice>();
  for (const c of output.choices) {
    if (c.findingIndex < findings.length && !byIndex.has(c.findingIndex)) byIndex.set(c.findingIndex, c);
  }

  const results: OperationMatchResult[] = findings.map((finding, i) => {
    const shortlist = shortlists[i];
    const choice = byIndex.get(i);
    if (!choice) {
      notes.push(`Finding ${i + 1}: model returned no choice, left unmapped.`);
      return { finding, findingIndex: i, shortlist, code: null, confidence: 0, rationale: "No choice returned", unmappedDescription: finding.technicianRecommendation };
    }
    if (!choice.code) {
      return { finding, findingIndex: i, shortlist, code: null, confidence: choice.confidence, rationale: choice.rationale, unmappedDescription: choice.unmappedDescription ?? finding.technicianRecommendation };
    }
    // Hard guardrail: the code must be in the shortlist and exist in the catalogue.
    const code = shortlist.find((op) => op.code === choice.code) ?? null;
    if (!code) {
      notes.push(`Finding ${i + 1}: model proposed "${choice.code}" which is not in the shortlist. Rejected and left unmapped.`);
      return { finding, findingIndex: i, shortlist, code: null, confidence: 0, rationale: choice.rationale, unmappedDescription: finding.technicianRecommendation };
    }
    return { finding, findingIndex: i, shortlist, code, confidence: choice.confidence, rationale: choice.rationale, unmappedDescription: null };
  });

  return { results, notes, latencyMs: Date.now() - started };
}
