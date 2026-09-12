/**
 * pnpm eval
 * Runs the golden set through pipeline steps 2-5 against the seeded database
 * and the live model, writes src/lib/eval/eval-results.json (rendered by /eval)
 * and prints the aggregate metrics.
 */
import "./env";
import fs from "node:fs";
import path from "node:path";
import { MODEL, getAi } from "../src/lib/ai/anthropic";
import { PrismaDockMasterClient } from "../src/lib/dockmaster/mock-client";
import golden from "../src/lib/eval/golden-set.json";
import { runGoldenSet, summarise, type EvalResults, type GoldenCase } from "../src/lib/eval/run";

const OUT = path.join("src", "lib", "eval", "eval-results.json");

async function main() {
  const cases = golden.cases as GoldenCase[];
  const only = process.argv.indexOf("--only") >= 0 ? process.argv[process.argv.indexOf("--only") + 1] : null;
  const selected = only ? cases.filter((c) => c.id === only) : cases;

  console.log(`Running ${selected.length} golden cases against ${MODEL}...\n`);
  const results = await runGoldenSet(new PrismaDockMasterClient(), getAi(), selected, (r, i) => {
    const mark = r.pass ? "PASS" : "FAIL";
    const vessel = r.vesselCorrect ? "vessel ok" : `vessel ${r.actualVesselId ?? "none"} (expected ${r.expectedVesselId ?? "none"})`;
    const ops = `P ${r.precision.toFixed(2)} R ${r.recall.toFixed(2)}`;
    const extra = r.error ? `  error: ${r.error}` : "";
    console.log(`${String(i + 1).padStart(2)}. ${mark}  ${r.id.padEnd(36)} ${vessel}; ${ops}; ${r.latencyMs} ms${extra}`);
    if (r.missingCodes.length) console.log(`      missing: ${r.missingCodes.join(", ")}`);
    if (r.extraCodes.length) console.log(`      extra:   ${r.extraCodes.join(", ")}`);
  });

  const summary = summarise(results);
  const out: EvalResults = { generatedAt: new Date().toISOString(), model: MODEL, summary, results };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log("\nSummary");
  console.log(`  vessel match accuracy   ${summary.vesselCorrect}/${summary.cases} (${(summary.vesselAccuracy * 100).toFixed(0)}%), target ${summary.targets.vesselCorrect}/${summary.cases}`);
  console.log(`  operation precision     ${summary.operationPrecision.toFixed(2)}`);
  console.log(`  operation recall        ${summary.operationRecall.toFixed(2)}, target ${summary.targets.operationRecall}`);
  console.log(`  separate estimate acc.  ${(summary.separateAccuracy * 100).toFixed(0)}%`);
  console.log(`  cases passed            ${summary.passed}/${summary.cases}`);
  console.log(`  mean latency            ${summary.meanLatencyMs} ms`);
  console.log(`  targets met             ${summary.targetsMet ? "yes" : "no"}`);
  console.log(`\nWrote ${OUT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
