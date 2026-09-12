import { describe, expect, it } from "vitest";
import type { AccountCode } from "../types";
import { findDuplicateCandidates, similarity } from "./onboarding-agent";

const code = (c: string, d: string, usage = 1): AccountCode => ({ id: c, accountId: "a", code: c, description: d, hours: 1, usageCount: usage, mergedInto: null });

describe("duplicate candidates", () => {
  it("pairs codes whose descriptions say the same work in different words", () => {
    const cands = findDuplicateCandidates([
      code("IMP", "IMPELLER"),
      code("WP-IMP", "Water pump impeller replace"),
      code("IMP-YAM", "Impeller replacement - Yamaha"),
      code("BTMPNT", "Bottom paint"),
      code("BP-HAUL", "BOTTOM PAINT - HAUL INCL"),
      code("ELEC-DX", "Electrical diag"),
    ]);
    const pairs = cands.map((c) => `${c.a}|${c.b}`);
    expect(pairs).toContain("IMP|IMP-YAM");
    expect(pairs).toContain("BTMPNT|BP-HAUL");
    expect(pairs.some((p) => p.includes("ELEC-DX"))).toBe(false);
  });

  it("similarity is symmetric and ignores stop words and case", () => {
    expect(similarity("Oil and filter change", "OIL CHANGE, FILTER")).toBeCloseTo(similarity("OIL CHANGE, FILTER", "Oil and filter change"));
    expect(similarity("Haul out", "Detail")).toBe(0);
  });
});
