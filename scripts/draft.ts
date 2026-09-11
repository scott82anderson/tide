/**
 * CLI: pnpm draft --sample 1   (or --file path/to/note.txt, or --text "...")
 * Runs steps 2-6 against the seeded database and prints the drafts as JSON.
 * Nothing is persisted.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getAi } from "../src/lib/ai/anthropic";
import { runDraftPipeline } from "../src/lib/ai/pipeline";
import { PrismaDockMasterClient } from "../src/lib/dockmaster/mock-client";

const SAMPLES: Record<string, string> = {
  "1": "note-1-sea-ray-overheat.txt",
  "2": "note-2-grady-white-electrical.txt",
  "3": "note-3-catalina-rigging.txt",
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  let transcript = arg("text");
  const file = arg("file");
  const sample = arg("sample") ?? (!transcript && !file ? "1" : undefined);
  if (sample) {
    const name = SAMPLES[sample];
    if (!name) throw new Error(`Unknown sample ${sample}. Use 1, 2 or 3.`);
    transcript = fs.readFileSync(path.join("public", "samples", name), "utf8");
  } else if (file) {
    transcript = fs.readFileSync(file, "utf8");
  }
  if (!transcript) throw new Error("Provide --sample N, --file path or --text \"...\"");

  const client = new PrismaDockMasterClient();
  const result = await runDraftPipeline(client, getAi(), {
    transcript,
    technicianId: "tech_marcus_reyes",
    onStage: (s) => console.error(`  ${s}`),
  });

  console.log(
    JSON.stringify(
      {
        vessel: result.vessel ? `${result.vessel.name} (${result.vessel.id})` : null,
        vesselMatch: { confidence: result.vesselMatch.confidence, reasons: result.vesselMatch.reasons, method: result.vesselMatch.method },
        findings: result.extraction.findings,
        operations: result.matches.map((m) => ({ finding: m.finding.technicianRecommendation, code: m.code?.code ?? null, confidence: m.confidence, rationale: m.rationale })),
        drafts: result.drafts.map((d) => ({
          title: d.title,
          quoteSeparately: d.quoteSeparately,
          totals: d.totals,
          requiresManagerApproval: d.requiresManagerApproval,
          historyFlags: d.historyFlags,
          customerSummary: d.customerSummary,
          lines: d.lines.map((l) => ({ kind: l.kind, description: l.description, hours: l.hours, qty: l.qty, lineTotal: l.lineTotal, included: l.included, confidence: l.confidence, stockWarning: l.stockWarning, hoursFlag: l.hoursFlag, customerDescription: l.customerDescription })),
        })),
        notes: result.trace.notes,
        latencyMs: result.totalLatencyMs,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
