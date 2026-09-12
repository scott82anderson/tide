import { describe, expect, it } from "vitest";
import { OPT_OUT_LINE } from "./brand-voice";
import { editRatio, lintCopy, matchesKnownFigure, unlinkedNumbers } from "./style-lint";
import type { SourceQuery } from "./types";

const figures: SourceQuery[] = [
  { key: "billed", label: "Billed hours", value: 4120, unit: "hours", query: "q" },
  { key: "ar", label: "AR over 45 days", value: 84000, unit: "usd", query: "q" },
  { key: "vessels", label: "Vessels past interval", value: 61, unit: "count", query: "q" },
];

describe("truth in numbers", () => {
  it("accepts figures the agent was given, including sensible rounding", () => {
    expect(unlinkedNumbers("you billed 4,120 hours and $84,000 of AR is aged; 61 vessels are due", figures)).toEqual([]);
    expect(unlinkedNumbers("about $84k of AR", figures)).toEqual([]);
    expect(matchesKnownFigure(4100, [4120])).toBe(true);
  });

  it("flags a number that links to nothing", () => {
    const bad = unlinkedNumbers("you billed 4,120 hours and lost $120,000 last year across 38 estimates", figures);
    expect(bad).toContain("$120,000");
    expect(bad).toContain("38 estimates");
    expect(bad).not.toContain("4,120 hours");
  });
});

describe("brand voice lint", () => {
  it("catches hype, exclamation marks, dashes and length", () => {
    const r = lintCopy("A game-changing tool! Really — seamless.", { maxWords: 3 });
    const rules = r.issues.map((i) => i.rule);
    expect(rules).toContain("hype");
    expect(rules).toContain("exclamation");
    expect(rules).toContain("dash");
    expect(rules).toContain("length");
  });

  it("requires the opt-out line on emails and an opt-in for SMS", () => {
    expect(lintCopy("Hi Gail, here are your numbers.", { requireOptOut: true, channel: "email" }).issues.map((i) => i.rule)).toContain("opt_out");
    expect(lintCopy(`Hi Gail.\n\n${OPT_OUT_LINE}`, { requireOptOut: true, channel: "email" }).ok).toBe(true);
    expect(lintCopy("Short text", { channel: "sms", smsOptIn: false }).issues.map((i) => i.rule)).toContain("sms_consent");
  });
});

describe("editRatio", () => {
  it("measures the changed middle of a draft", () => {
    expect(editRatio("abcdef", "abcdef")).toBe(0);
    expect(editRatio("abcdef", "abXYef")).toBeCloseTo(2 / 6, 2);
    expect(editRatio("", "x")).toBe(1);
  });
});
