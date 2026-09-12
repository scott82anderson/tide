/**
 * pnpm gtm:scout [--account acc_id]
 * Runs the Opportunity Scout over every account (or one) through the real
 * runner: runs are recorded, reports land on the review queue. No model call.
 */
import "./env";
import { createAgentContext, runAgent } from "../src/lib/gtm/runner";
import type { ScoutReport } from "../src/lib/gtm/agents/opportunity-scout";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  const ctx = createAgentContext({ ai: null });
  const only = arg("account");
  const accounts = (await ctx.gtm.listAccounts()).filter((a) => !only || a.id === only);
  const rows: { account: string; score: number; aYear: number; confidence: string; source: string; tier: string }[] = [];
  for (const a of accounts) {
    const out = await runAgent<Record<string, unknown>, ScoutReport>(ctx, "opportunity_scout", { accountId: a.id });
    const r = out.result.output;
    rows.push({ account: a.name, score: r.score, aYear: r.totalAnnualUsd, confidence: r.confidence, source: r.dataSource, tier: r.fit.recommendedTier });
  }
  rows.sort((x, y) => y.score - x.score);
  console.table(rows);
  console.log(`${rows.length} report(s) on the review queue for the Head of Sales.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
