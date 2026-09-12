import { describe, expect, it } from "vitest";
import { kitItemsForVessel, reassignJobLevelHours } from "./build-estimate";
import { stripEmDashes } from "./anthropic";
import type { OperationMatchResult } from "./match-operations";
import { operationCodes, vessels } from "@/test/fake-client";

const reelTherapy = vessels[0]; // MerCruiser 8.2 MAG ECT

function item(partNumber: string, description: string, fits: string[]) {
  return { qty: 1, part: { partNumber, description, fitsEngineMakes: fits } };
}

describe("kitItemsForVessel", () => {
  it("drops other makes and other model variants of the same part", () => {
    const items = [
      item("8M0139545", "Sea water pump assembly, 8.2 MAG", ["MerCruiser"]),
      item("8M0114145", "Sea water pump assembly, 4.5 / 6.2 MPI", ["MerCruiser"]),
      item("3593875", "Sea water pump, D4/D6", ["Volvo Penta"]),
      item("25-8M0055285", "O-ring, sea water pump cover", ["MerCruiser"]),
      item("GEN-1", "Hose clamp, universal", []),
    ];
    const kept = kitItemsForVessel(items, reelTherapy).map((i) => i.part.partNumber);
    expect(kept).toEqual(["8M0139545", "25-8M0055285", "GEN-1"]);
  });

  it("keeps all variants when none mentions the model", () => {
    const items = [
      item("A", "Impeller kit, Bravo", ["MerCruiser"]),
      item("B", "Impeller kit, Alpha", ["MerCruiser"]),
    ];
    expect(kitItemsForVessel(items, reelTherapy)).toHaveLength(2);
  });
});

function match(code: string, hours: number | null): OperationMatchResult {
  const op = operationCodes.find((o) => o.code === code)!;
  return {
    findingIndex: 0,
    finding: {
      system: "engine",
      symptom: "",
      observation: "",
      severity: "medium",
      technicianRecommendation: op.description,
      estimatedHours: hours,
      engine: "port",
      quoteSeparately: false,
    },
    shortlist: [op],
    code: op,
    confidence: 0.9,
    rationale: "",
    unmappedDescription: null,
  };
}

describe("reassignJobLevelHours", () => {
  it("moves a job-level estimate from the impeller line to the pump line", () => {
    const { matches, notes } = reassignJobLevelHours(
      [match("ENG-IMP-01", 3.5), match("ENG-RWP-01", null), match("ENG-CLF-01", null)],
      reelTherapy,
    );
    expect(matches[0].finding.estimatedHours).toBeNull();
    expect(matches[1].finding.estimatedHours).toBe(3.5);
    expect(notes[0]).toMatch(/applied to the largest line ENG-RWP-01/);
  });

  it("leaves hours alone when they already fit", () => {
    const { matches, notes } = reassignJobLevelHours([match("ENG-IMP-01", null), match("ENG-RWP-01", 3.5)], reelTherapy);
    expect(matches[1].finding.estimatedHours).toBe(3.5);
    expect(notes).toHaveLength(0);
  });
});

describe("stripEmDashes", () => {
  it("replaces em and en dashes inside nested output", () => {
    const out = stripEmDashes({ a: "Reel Therapy — we'll flush it", b: ["3–4 hours"], c: { d: "fine" } });
    expect(out).toEqual({ a: "Reel Therapy, we'll flush it", b: ["3, 4 hours"], c: { d: "fine" } });
  });
});
