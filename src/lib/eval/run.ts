/**
 * Golden set evaluation for pipeline steps 2-5 (no transcription, no narrative).
 * Scores vessel match, operation set precision/recall, separate-estimate
 * detection and latency per case, then aggregates.
 */

import type { StructuredCaller } from "@/lib/ai/anthropic";
import { runDraftPipeline } from "@/lib/ai/pipeline";
import type { DockMasterClient } from "@/lib/dockmaster/client";

export interface GoldenCase {
  id: string;
  kind: string;
  transcript: string;
  expectedVesselId: string | null;
  expectedCodes: string[];
  expectedSeparate: boolean;
}

export interface CaseResult {
  id: string;
  kind: string;
  transcript: string;
  expectedVesselId: string | null;
  actualVesselId: string | null;
  actualVesselName: string | null;
  vesselConfidence: number;
  vesselMethod: string;
  vesselCorrect: boolean;
  expectedCodes: string[];
  actualCodes: string[];
  matchedCodes: string[];
  missingCodes: string[];
  extraCodes: string[];
  precision: number;
  recall: number;
  expectedSeparate: boolean;
  actualSeparate: boolean;
  separateCorrect: boolean;
  findings: number;
  unmapped: number;
  latencyMs: number;
  pass: boolean;
  error: string | null;
}

export interface EvalSummary {
  cases: number;
  vesselAccuracy: number;
  vesselCorrect: number;
  operationPrecision: number;
  operationRecall: number;
  separateAccuracy: number;
  passRate: number;
  passed: number;
  meanLatencyMs: number;
  targets: { vesselCorrect: number; operationRecall: number };
  targetsMet: boolean;
}

export interface EvalResults {
  generatedAt: string | null;
  model: string;
  summary: EvalSummary | null;
  results: CaseResult[];
}

function setMetrics(expected: string[], actual: string[]) {
  const exp = new Set(expected);
  const act = new Set(actual);
  const matched = [...act].filter((c) => exp.has(c));
  const missing = [...exp].filter((c) => !act.has(c));
  const extra = [...act].filter((c) => !exp.has(c));
  // Empty expected and empty actual is a perfect score (nothing-actionable case).
  const precision = act.size === 0 ? (exp.size === 0 ? 1 : 0) : matched.length / act.size;
  const recall = exp.size === 0 ? (act.size === 0 ? 1 : 0) : matched.length / exp.size;
  return { matched, missing, extra, precision, recall };
}

export async function evaluateCase(
  client: DockMasterClient,
  ai: StructuredCaller,
  c: GoldenCase,
): Promise<CaseResult> {
  const base = {
    id: c.id,
    kind: c.kind,
    transcript: c.transcript,
    expectedVesselId: c.expectedVesselId,
    expectedCodes: c.expectedCodes,
    expectedSeparate: c.expectedSeparate,
  };
  try {
    const result = await runDraftPipeline(client, ai, {
      transcript: c.transcript,
      technicianId: "tech_marcus_reyes",
      skipNarrative: true,
    });
    const actualCodes = result.matches.map((m) => m.code?.code).filter((x): x is string => Boolean(x));
    const m = setMetrics(c.expectedCodes, actualCodes);
    const actualVesselId = result.vesselMatch.vesselId;
    const vesselCorrect = actualVesselId === c.expectedVesselId;
    const actualSeparate = result.extraction.findings.some((f) => f.quoteSeparately);
    const separateCorrect = actualSeparate === c.expectedSeparate;
    const pass = vesselCorrect && m.recall === 1 && m.precision >= 0.75 && separateCorrect;
    return {
      ...base,
      actualVesselId,
      actualVesselName: result.vessel?.name ?? null,
      vesselConfidence: result.vesselMatch.confidence,
      vesselMethod: result.vesselMatch.method,
      vesselCorrect,
      actualCodes,
      matchedCodes: m.matched,
      missingCodes: m.missing,
      extraCodes: m.extra,
      precision: m.precision,
      recall: m.recall,
      actualSeparate,
      separateCorrect,
      findings: result.extraction.findings.length,
      unmapped: result.matches.filter((x) => !x.code).length,
      latencyMs: result.totalLatencyMs,
      pass,
      error: null,
    };
  } catch (err) {
    return {
      ...base,
      actualVesselId: null,
      actualVesselName: null,
      vesselConfidence: 0,
      vesselMethod: "error",
      vesselCorrect: false,
      actualCodes: [],
      matchedCodes: [],
      missingCodes: c.expectedCodes,
      extraCodes: [],
      precision: 0,
      recall: 0,
      actualSeparate: false,
      separateCorrect: false,
      findings: 0,
      unmapped: 0,
      latencyMs: 0,
      pass: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function summarise(results: CaseResult[]): EvalSummary {
  const n = results.length;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const vesselCorrect = results.filter((r) => r.vesselCorrect).length;
  const passed = results.filter((r) => r.pass).length;
  const operationRecall = mean(results.map((r) => r.recall));
  const targets = { vesselCorrect: 14, operationRecall: 0.85 };
  return {
    cases: n,
    vesselAccuracy: n ? vesselCorrect / n : 0,
    vesselCorrect,
    operationPrecision: mean(results.map((r) => r.precision)),
    operationRecall,
    separateAccuracy: n ? results.filter((r) => r.separateCorrect).length / n : 0,
    passRate: n ? passed / n : 0,
    passed,
    meanLatencyMs: Math.round(mean(results.filter((r) => !r.error).map((r) => r.latencyMs))),
    targets,
    targetsMet: vesselCorrect >= targets.vesselCorrect && operationRecall >= targets.operationRecall,
  };
}

export async function runGoldenSet(
  client: DockMasterClient,
  ai: StructuredCaller,
  cases: GoldenCase[],
  onCase?: (r: CaseResult, index: number) => void,
): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const r = await evaluateCase(client, ai, cases[i]);
    results.push(r);
    onCase?.(r, i);
  }
  return results;
}
