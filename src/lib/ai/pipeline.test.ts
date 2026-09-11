import { describe, expect, it } from "vitest";
import { FakeStructuredCaller } from "./anthropic";
import { draftFromTechNote, runDraftPipeline } from "./pipeline";
import { FakeDockMasterClient } from "@/test/fake-client";
import {
  NOTE_1_TRANSCRIPT,
  extractionFixture,
  narrativeFixtureMain,
  narrativeFixtureSeparate,
  operationMatchFixture,
} from "@/lib/ai/fixtures/note-1";

function makeAi() {
  return new FakeStructuredCaller({
    record_findings: [extractionFixture],
    choose_operations: [operationMatchFixture],
    write_estimate_wording: [narrativeFixtureMain, narrativeFixtureSeparate],
  });
}

describe("runDraftPipeline on sample note 1", () => {
  it("matches the vessel deterministically without calling the model", async () => {
    const ai = makeAi();
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, ai, { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });

    expect(result.vesselMatch.vesselId).toBe("ves_reel_therapy");
    expect(result.vesselMatch.method).toBe("deterministic");
    expect(result.vesselMatch.confidence).toBeGreaterThanOrEqual(0.85);
    expect(ai.calls.map((c) => c.name)).not.toContain("rank_vessel");
  });

  it("produces a main draft and a separate trim tab draft", async () => {
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, makeAi(), { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });

    expect(result.drafts).toHaveLength(2);
    const [main, separate] = result.drafts;
    expect(main.quoteSeparately).toBe(false);
    expect(separate.quoteSeparately).toBe(true);
    expect(separate.title).toMatch(/quoted separately/);

    const mainOps = main.lines.filter((l) => l.kind === "operation").map((l) => l.operationCodeId);
    expect(mainOps).toEqual(["ENG-IMP-01", "ENG-RWP-01", "ENG-CLF-01", "ENG-HEX-01"]);
    expect(separate.lines.filter((l) => l.kind === "operation").map((l) => l.operationCodeId)).toEqual(["HYD-TAB-01"]);
  });

  it("applies the technician's 3.5 h to the pump line because it is within 50% of standard", async () => {
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, makeAi(), { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });
    const pump = result.drafts[0].lines.find((l) => l.operationCodeId === "ENG-RWP-01")!;
    expect(pump.standardHours).toBe(2.5);
    expect(pump.hours).toBe(3.5);
    expect(pump.hoursFlag).toBeNull();
    expect(pump.lineTotal).toBe(3.5 * 165);
  });

  it("pulls kit parts with stock warnings and prices from the catalogue only", async () => {
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, makeAi(), { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });
    const parts = result.drafts[0].lines.filter((l) => l.kind === "part");
    const pump = parts.find((l) => l.partId === "8M0139545")!;
    expect(pump.stockWarning).toMatch(/Out of stock/);
    expect(pump.unitPrice).toBe(465);
    const impeller = parts.find((l) => l.partId === "47-8M0104229")!;
    expect(impeller.qty).toBe(1); // port engine only
    expect(impeller.stockWarning).toBeNull();
  });

  it("raises the 26 month impeller history flag", async () => {
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, makeAi(), { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });
    const flag = result.drafts[0].historyFlags.find((f) => f.operationCode === "ENG-IMP-01")!;
    expect(flag.kind).toBe("interval_overdue");
    expect(flag.message).toMatch(/26 months ago \(WO-2024-0311/);
    expect(flag.message).toMatch(/interval 24 months/);
  });

  it("computes totals with shop supplies and tax", async () => {
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, makeAi(), { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });
    const t = result.drafts[0].totals;
    // labour: 1.0 + 3.5 + 1.0 + 1.5 = 7.0 h at 165
    expect(t.subtotalLabor).toBe(1155);
    // parts: 62 + 465 + 2 x 29.5
    expect(t.subtotalParts).toBe(586);
    expect(t.shopSupplies).toBe(57.75);
    expect(t.tax).toBe(45.06);
    expect(t.total).toBe(1843.81);
    expect(result.drafts[0].requiresManagerApproval).toBe(false);
  });

  it("writes customer wording onto the lines", async () => {
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, makeAi(), { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });
    const imp = result.drafts[0].lines.find((l) => l.operationCodeId === "ENG-IMP-01")!;
    expect(imp.customerDescription).toMatch(/impeller/i);
    expect(result.drafts[0].customerSummary).toBeTruthy();
  });

  it("records a reasoning step per pipeline stage", async () => {
    const client = new FakeDockMasterClient().asClient();
    const result = await runDraftPipeline(client, makeAi(), { transcript: NOTE_1_TRANSCRIPT, technicianId: "tech_marcus_reyes" });
    expect(result.trace.steps.map((s) => s.step)).toEqual([
      "extract_findings",
      "match_vessel",
      "match_operations",
      "build_estimate",
      "write_narrative",
      "write_narrative",
    ]);
  });
});

describe("draftFromTechNote", () => {
  it("persists both estimates and logs activity", async () => {
    const fake = new FakeDockMasterClient();
    const { estimates } = await draftFromTechNote(fake.asClient(), makeAi(), {
      transcript: NOTE_1_TRANSCRIPT,
      technicianId: "tech_marcus_reyes",
      techNoteId: "note_1",
    });
    expect(estimates).toHaveLength(2);
    expect(estimates[0].status).toBe("draft_ai");
    expect(fake.created[1].parentEstimateId).toBe(estimates[0].id);
    expect(fake.activity.filter((a) => a.action === "estimate.drafted")).toHaveLength(2);
    expect(fake.activity.some((a) => a.action === "pipeline.extract_findings")).toBe(true);
  });
});

describe("guardrails", () => {
  it("rejects a code the model proposes outside the shortlist", async () => {
    const ai = new FakeStructuredCaller({
      record_findings: [{ ...extractionFixture, findings: [extractionFixture.findings[0]] }],
      choose_operations: [
        { choices: [{ findingIndex: 0, code: "ENG-XYZ-99", confidence: 0.9, rationale: "made up", unmappedDescription: null }] },
      ],
      write_estimate_wording: [narrativeFixtureMain],
    });
    const result = await runDraftPipeline(new FakeDockMasterClient().asClient(), ai, {
      transcript: NOTE_1_TRANSCRIPT,
      technicianId: "tech_marcus_reyes",
    });
    expect(result.matches[0].code).toBeNull();
    expect(result.trace.notes.join(" ")).toMatch(/not in the shortlist/);
    const line = result.drafts[0].lines[0];
    expect(line.kind).toBe("misc");
    expect(line.included).toBe(false);
    expect(line.needsManagerReview).toBe(true);
  });

  it("leaves low-confidence lines unchecked", async () => {
    const ai = new FakeStructuredCaller({
      record_findings: [{ ...extractionFixture, findings: [extractionFixture.findings[0]] }],
      choose_operations: [
        { choices: [{ findingIndex: 0, code: "ENG-IMP-01", confidence: 0.4, rationale: "guess", unmappedDescription: null }] },
      ],
      write_estimate_wording: [narrativeFixtureMain],
    });
    const result = await runDraftPipeline(new FakeDockMasterClient().asClient(), ai, {
      transcript: NOTE_1_TRANSCRIPT,
      technicianId: "tech_marcus_reyes",
    });
    expect(result.drafts[0].lines.every((l) => l.included === false)).toBe(true);
  });

  it("flags codes outside the technician's role scope for manager review", async () => {
    const ai = new FakeStructuredCaller({
      record_findings: [
        {
          ...extractionFixture,
          findings: [{ ...extractionFixture.findings[0], system: "drive", technicianRecommendation: "lower unit is toast, replace it" }],
        },
      ],
      choose_operations: [
        { choices: [{ findingIndex: 0, code: "DRV-LU-02", confidence: 0.9, rationale: "lower unit toast", unmappedDescription: null }] },
      ],
      write_estimate_wording: [narrativeFixtureMain],
    });
    const result = await runDraftPipeline(new FakeDockMasterClient().asClient(), ai, {
      transcript: "lower unit is toast",
      technicianId: "tech_marcus_reyes",
      vesselIdOverride: "ves_salty_dog",
    });
    const line = result.drafts[0].lines[0];
    expect(line.operationCodeId).toBe("DRV-LU-02");
    expect(line.needsManagerReview).toBe(true);
    expect(line.included).toBe(false);
  });
});
