import { describe, expect, it } from "vitest";
import type { AccountWeek } from "../types";
import { computeHealth } from "./adoption-agent";

function weeks(rows: [drafts: number, edit: number, approval: number, valpay: number, ar: number, techs: number][]): AccountWeek[] {
  return rows.map((r, i) => ({
    id: `w${i}`,
    accountId: "a",
    weekStart: new Date(Date.UTC(2026, 6, 20 + i * 7)),
    draftsStarted: r[0],
    draftsApproved: Math.round(r[0] * 0.8),
    editRate: r[1],
    approvalRate: r[2],
    valpayVolume: r[3],
    arDays: r[4],
    activeTechs: r[5],
  }));
}

describe("computeHealth", () => {
  it("scores a healthy account with a falling edit rate and flags the Revenue Suite upsell on AR days", () => {
    const r = computeHealth(
      weeks([
        [10, 0.4, 0.7, 2000, 52, 5],
        [12, 0.34, 0.74, 2600, 52, 6],
        [16, 0.22, 0.8, 4100, 51, 7],
        [21, 0.12, 0.86, 6900, 49, 7],
      ]),
      "service_writer",
      "North Star",
    );
    expect(r.band).toBe("healthy");
    expect(r.trends.editRate.direction).toBe("down");
    expect(r.expansionTriggers.map((t) => t.tier)).toContain("revenue_suite");
    expect(r.churnRisk.level).toBe("low");
    expect(r.figures.find((f) => f.key === "editRateLast")?.value).toBe(17);
  });

  it("flags churn risk when usage falls and the edit rate stays high", () => {
    const r = computeHealth(
      weeks([
        [12, 0.42, 0.66, 0, 52, 6],
        [13, 0.41, 0.64, 0, 52, 6],
        [9, 0.4, 0.61, 200, 55, 4],
        [8, 0.39, 0.6, 200, 55, 4],
      ]),
      "service_writer",
      "Bayhaven",
    );
    expect(r.band).toBe("at_risk");
    expect(r.churnRisk.level).toBe("high");
    expect(r.nudges.some((n) => n.text.includes("keywords"))).toBe(true);
  });
});
