import { describe, expect, it } from "vitest";
import { rankVesselCandidates, scoreKeywords } from "./match-rules";
import { vessels } from "@/test/fake-client";

describe("rankVesselCandidates", () => {
  it("matches on HIN suffix plus slip with high confidence", () => {
    const out = rankVesselCandidates(vessels, { hinSuffix: "4471", slip: "C-12" });
    expect(out[0].vessel.id).toBe("ves_reel_therapy");
    expect(out[0].score).toBeGreaterThanOrEqual(0.85);
    expect(out[0].reasons.join(" ")).toMatch(/HIN ends in 4471/);
    expect(out[0].reasons.join(" ")).toMatch(/Slip C-12/);
  });

  it("normalises slip spelling", () => {
    expect(rankVesselCandidates(vessels, { slip: "slip c12" })[0].vessel.id).toBe("ves_reel_therapy");
    expect(rankVesselCandidates(vessels, { slip: "C 12" })[0].vessel.id).toBe("ves_reel_therapy");
  });

  it("does not identify a vessel from make alone", () => {
    const out = rankVesselCandidates(vessels, { makeModel: "Sea Ray" });
    expect(out.length).toBe(2);
    expect(out[0].score).toBeLessThan(0.7);
  });

  it("owner plus make separates two boats of the same make", () => {
    const out = rankVesselCandidates(vessels, { makeModel: "Sea Ray", ownerLastName: "Brooks" });
    expect(out[0].vessel.id).toBe("ves_second_wind");
  });

  it("returns nothing for an unknown boat", () => {
    expect(rankVesselCandidates(vessels, { hinSuffix: "9999", boatName: "Ghost Ship" })).toHaveLength(0);
  });
});

describe("scoreKeywords", () => {
  it("weights phrases above single words", () => {
    const kws = ["impeller", "raw water pump", "weeping"];
    expect(scoreKeywords("the raw water pump is weeping", kws)).toBe(3);
    expect(scoreKeywords("impeller", kws)).toBe(1);
    expect(scoreKeywords("nothing here", kws)).toBe(0);
  });
});
