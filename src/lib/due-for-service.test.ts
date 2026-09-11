import { describe, expect, it } from "vitest";
import { predictDueForService } from "./due-for-service";
import { operationCodes, reelTherapyHistory, vessels } from "@/test/fake-client";

describe("predictDueForService", () => {
  it("flags Reel Therapy's impeller (26 months vs 24) and oil (26 vs 12)", () => {
    const history = new Map([["ves_reel_therapy", reelTherapyHistory]]);
    const items = predictDueForService(vessels, history, operationCodes);
    const codes = items.filter((i) => i.vessel.id === "ves_reel_therapy").map((i) => i.operation.code);
    expect(codes).toContain("ENG-IMP-01");
    expect(codes).toContain("ENG-OIL-01");
    const oil = items.find((i) => i.operation.code === "ENG-OIL-01")!;
    expect(oil.monthsSince).toBe(26);
    expect(oil.monthsOverdue).toBe(14);
    // most overdue first
    expect(items[0].operation.code).toBe("ENG-OIL-01");
  });

  it("ignores vessels with no history", () => {
    const items = predictDueForService(vessels, new Map(), operationCodes);
    expect(items).toHaveLength(0);
  });
});
