import { describe, expect, it } from "vitest";
import type { Account } from "../types";
import { computeScoutReport } from "./opportunity-scout";

const base: Account = {
  id: "acc_x",
  name: "Bayhaven Boatworks",
  city: "Annapolis",
  state: "MD",
  segment: "install_base",
  platform: "dockmaster_web_mobile",
  products: ["web", "mobile", "valpay"],
  groupName: null,
  source: "seed",
  stage: "target",
  tier: null,
  ownerName: null,
  ownerRole: null,
  designPartner: true,
  dataConsent: true,
  consentGrantedAt: new Date("2026-06-22T00:00:00Z"),
  smsOptIn: false,
  emailOptOut: false,
  conferenceAttendees: [],
  contacts: [],
  vesselMix: ["sterndrive"],
  technicianCount: 8,
  slipCount: 260,
  vesselCount: 310,
  laborRate: 158,
  standardHoursTtm: 5300,
  billedHoursTtm: 4120,
  estimatesTtm: 340,
  estimatesOver3Days: 38,
  avgEstimateValue: 2100,
  vesselsPastInterval: 61,
  avgIntervalJobValue: 1400,
  arOver45: 84000,
  arTotal: 132000,
  dsoDays: 52,
  contextFile: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("computeScoutReport", () => {
  it("produces the pitch sentence from the account's own numbers with a query per figure", () => {
    const r = computeScoutReport(base, { dataSource: "warehouse_extract", queries: {} });
    expect(r.pitchSentence).toContain("billed 4,120 of 5,300 standard hours");
    expect(r.pitchSentence).toContain("38 estimates took more than 3 days");
    expect(r.pitchSentence).toContain("61 vessels are past a maintenance interval");
    expect(r.pitchSentence).toContain("$84,000 of AR is over 45 days");
    for (const f of r.figures) expect(f.query.length).toBeGreaterThan(0);
    // 1180 unbilled hours x 158 x 0.5 = 93,220
    expect(r.opportunities.find((o) => o.key === "unbilled_labour")?.annualUsd).toBe(93220);
    expect(r.totalAnnualUsd).toBe(r.opportunities.reduce((s, o) => s + o.annualUsd, 0));
    expect(r.confidence).toBe("high");
    expect(r.fit.recommendedTier).toBe("revenue_suite");
    expect(r.fit.onWebMobile).toBe(true);
    expect(r.score).toBeGreaterThan(80);
  });

  it("falls back to public signals and a low-confidence anchor without consent", () => {
    const r = computeScoutReport({ ...base, dataConsent: false, laborRate: 0, standardHoursTtm: 0 }, { dataSource: "public_signals", queries: {} });
    expect(r.confidence).toBe("low");
    expect(r.opportunities).toHaveLength(1);
    // 8 techs x 48 weeks x $150 regional assumption
    expect(r.opportunities[0].annualUsd).toBe(57600);
    expect(r.figures.find((f) => f.key === "laborRate")?.assumption).toBeTruthy();
    expect(r.pitchSentence).toContain("about 8 technicians");
  });

  it("recommends the group tier and flags a migration for desktop sites", () => {
    const r = computeScoutReport({ ...base, groupName: "Blue Harbor", platform: "dockmaster_desktop", products: [] }, { dataSource: "warehouse_extract", queries: {} });
    expect(r.fit.recommendedTier).toBe("group");
    expect(r.fit.migrationNeeded).toBe(true);
  });
});
