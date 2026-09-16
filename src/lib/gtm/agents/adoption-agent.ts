/**
 * Adoption Agent: watches product telemetry and drives expansion. Deterministic
 * rules over the weekly figures (drafts started, edit rate, approval rate,
 * ValPay volume, AR days): a health score with reasons, nudges from templates,
 * expansion triggers and churn risk. No model needed; the CSM sees the numbers.
 */

import { formatDate } from "@/lib/demo-date";
import { TIERS } from "../pricing";
import type { AccountWeek, SourceQuery, Tier } from "../types";
import { AgentBlockedError, fig, type AgentDefinition, type AgentResult } from "./framework";

export interface AdoptionInput {
  accountId: string;
}

export interface Trend {
  first: number;
  last: number;
  direction: "up" | "down" | "flat";
  changePct: number;
}

export interface HealthReport {
  weeks: number;
  periodStart: string;
  periodEnd: string;
  health: number;
  band: "healthy" | "watch" | "at_risk";
  reasons: string[];
  trends: { editRate: Trend; draftsStarted: Trend; approvalRate: Trend; valpayVolume: Trend; arDays: Trend; activeTechs: Trend };
  nudges: { channel: "in_app" | "email"; audience: string; text: string }[];
  expansionTriggers: { tier: Tier; trigger: string; evidence: string }[];
  churnRisk: { level: "low" | "medium" | "high"; reasons: string[] };
  figures: SourceQuery[];
}

function trend(values: number[]): Trend {
  const head = values.slice(0, 2);
  const tail = values.slice(-2);
  const first = head.reduce((s, v) => s + v, 0) / head.length;
  const last = tail.reduce((s, v) => s + v, 0) / tail.length;
  const changePct = first === 0 ? (last === 0 ? 0 : 100) : Math.round(((last - first) / first) * 100);
  const direction: Trend["direction"] = Math.abs(changePct) < 10 ? "flat" : changePct > 0 ? "up" : "down";
  return { first: Math.round(first * 100) / 100, last: Math.round(last * 100) / 100, direction, changePct };
}

export function computeHealth(weeks: AccountWeek[], currentTier: Tier | null, accountName: string): HealthReport {
  const t = {
    editRate: trend(weeks.map((w) => w.editRate)),
    draftsStarted: trend(weeks.map((w) => w.draftsStarted)),
    approvalRate: trend(weeks.map((w) => w.approvalRate)),
    valpayVolume: trend(weeks.map((w) => w.valpayVolume)),
    arDays: trend(weeks.map((w) => w.arDays)),
    activeTechs: trend(weeks.map((w) => w.activeTechs)),
  };
  let health = 100;
  const reasons: string[] = [];
  if (t.editRate.last > 0.3) {
    health -= 25;
    reasons.push(`Edit rate is still ${Math.round(t.editRate.last * 100)}%: managers are rewriting drafts`);
  } else if (t.editRate.direction === "down") {
    reasons.push(`Edit rate fell from ${Math.round(t.editRate.first * 100)}% to ${Math.round(t.editRate.last * 100)}%`);
  }
  if (t.draftsStarted.direction === "down") {
    health -= 25;
    reasons.push(`Drafts started fell ${Math.abs(t.draftsStarted.changePct)}% (${t.draftsStarted.first} to ${t.draftsStarted.last} a week)`);
  } else if (t.draftsStarted.direction === "up") {
    reasons.push(`Drafts started rose ${t.draftsStarted.changePct}% to ${t.draftsStarted.last} a week`);
  }
  if (t.approvalRate.last < 0.6) {
    health -= 15;
    reasons.push(`Customer approval rate is ${Math.round(t.approvalRate.last * 100)}%`);
  }
  if (t.activeTechs.direction === "down") {
    health -= 10;
    reasons.push(`Fewer technicians recording notes (${t.activeTechs.first} to ${t.activeTechs.last})`);
  }
  if (t.editRate.direction === "down" && t.draftsStarted.direction !== "down") health = Math.min(100, health + 5);
  health = Math.max(0, health);
  const band: HealthReport["band"] = health >= 75 ? "healthy" : health >= 50 ? "watch" : "at_risk";

  const nudges: HealthReport["nudges"] = [];
  const lastWeek = weeks[weeks.length - 1];
  if (t.editRate.last > 0.3) {
    nudges.push({ channel: "email", audience: "Service manager", text: `Your team edited ${Math.round(t.editRate.last * 100)}% of AI lines last week. Most edits come from missing technician keywords on operation codes. Want a 20 minute session to map the top ten?` });
  }
  if (t.activeTechs.last < Math.max(1, t.activeTechs.first)) {
    nudges.push({ channel: "in_app", audience: "Technicians not yet recording notes", text: "Record a voice note on your next job and the Service Writer drafts the estimate for your manager. Thirty seconds of talking replaces the write-up." });
  }
  if (lastWeek && lastWeek.draftsApproved > 0 && lastWeek.valpayVolume === 0) {
    nudges.push({ channel: "email", audience: "Accounts", text: "Estimates are being approved through the portal. Turning on ValPay links lets owners pay the deposit at signing." });
  }
  if (nudges.length === 0) {
    nudges.push({ channel: "email", audience: "Service manager", text: `${accountName} approved ${lastWeek?.draftsApproved ?? 0} AI drafts last week with an edit rate of ${Math.round(t.editRate.last * 100)}%. Nothing to fix; would you be open to a short case study?` });
  }

  const expansionTriggers: HealthReport["expansionTriggers"] = [];
  if (t.arDays.last > 45 && currentTier !== "revenue_suite" && currentTier !== "group") {
    expansionTriggers.push({ tier: "revenue_suite", trigger: "AR days above 45", evidence: `AR days are ${t.arDays.last}; the collections agent and ValPay attach pay for the upgrade` });
  }
  if (t.editRate.last < 0.15 && currentTier === "service_writer") {
    expansionTriggers.push({ tier: "ai_service_desk", trigger: "Drafting is trusted", evidence: `Edit rate is ${Math.round(t.editRate.last * 100)}%; the team is ready for scheduling and Blu on the same estimates` });
  }
  if (t.valpayVolume.direction === "up" && currentTier === "ai_service_desk") {
    expansionTriggers.push({ tier: "revenue_suite", trigger: "ValPay volume rising", evidence: `ValPay volume rose ${t.valpayVolume.changePct}%; the Revenue Suite price is subsidised by that margin` });
  }

  const churnReasons: string[] = [];
  if (t.draftsStarted.direction === "down") churnReasons.push("Usage falling");
  if (t.editRate.last > 0.3 && t.editRate.direction !== "down") churnReasons.push("Edit rate not improving");
  if (t.activeTechs.direction === "down") churnReasons.push("Technician participation falling");
  const level: HealthReport["churnRisk"]["level"] = churnReasons.length >= 2 ? "high" : churnReasons.length === 1 ? "medium" : "low";

  const figures: SourceQuery[] = [
    fig("editRateLast", "Edit rate, last two weeks", Math.round(t.editRate.last * 100), "pct", "telemetry: edited AI lines / AI lines, mean of last 2 weeks"),
    fig("editRateFirst", "Edit rate, first two weeks", Math.round(t.editRate.first * 100), "pct", "telemetry: mean of first 2 weeks"),
    fig("draftsPerWeek", "Drafts started a week", t.draftsStarted.last, "count", "telemetry: drafts_started, mean of last 2 weeks"),
    fig("approvalRate", "Customer approval rate", Math.round(t.approvalRate.last * 100), "pct", "telemetry: approved / sent, mean of last 2 weeks"),
    fig("valpayVolume", "ValPay volume a week", t.valpayVolume.last, "usd", "telemetry: valpay_volume, mean of last 2 weeks"),
    fig("arDays", "AR days", t.arDays.last, "days", "telemetry: ar_days, last 2 weeks"),
    fig("activeTechs", "Technicians recording notes", t.activeTechs.last, "count", "telemetry: active_techs, mean of last 2 weeks"),
    fig("health", "Health score", health, "count", "100 minus penalties: edit rate > 30% (25), usage falling (25), approval < 60% (15), techs falling (10)"),
  ];

  return {
    weeks: weeks.length,
    periodStart: formatDate(weeks[0].weekStart),
    periodEnd: formatDate(weeks[weeks.length - 1].weekStart),
    health,
    band,
    reasons,
    trends: t,
    nudges,
    expansionTriggers,
    churnRisk: { level, reasons: churnReasons },
    figures,
  };
}

export const adoptionAgent: AgentDefinition<AdoptionInput, HealthReport> = {
  key: "adoption_agent",
  name: "Adoption Agent",
  job: "Watch usage and drive expansion",
  inputs: "Product telemetry: drafts started, edit rate, approval rate, ValPay volume",
  output: "Weekly account health, nudges (in-app, email), expansion triggers, churn risk with reasons",
  owner: "CSM",
  modelTier: "none",
  needsAccount: true,
  async run(ctx, _input, account): Promise<AgentResult<HealthReport>> {
    const acct = account!;
    const weeks = await ctx.gtm.listAccountWeeks(acct.id);
    if (weeks.length < 2) throw new AgentBlockedError(`${acct.name} has no product telemetry yet: the Adoption Agent runs for accounts on the beta or live.`);
    const t0 = Date.now();
    const report = computeHealth(weeks, acct.tier, acct.name);
    const tierName = report.expansionTriggers[0] ? TIERS[report.expansionTriggers[0].tier].name : null;
    return {
      output: report,
      sourceQueries: report.figures,
      steps: [{ step: "score_health", latencyMs: Date.now() - t0 }],
      queue: {
        kind: "health_report",
        title: `Health: ${acct.name} ${report.health}/100 (${report.band.replace("_", " ")})${tierName ? `, ${tierName} trigger` : ""}`,
        sourceData: { weeks: weeks.map((w) => ({ weekStart: formatDate(w.weekStart), draftsStarted: w.draftsStarted, draftsApproved: w.draftsApproved, editRate: w.editRate, approvalRate: w.approvalRate, valpayVolume: w.valpayVolume, arDays: w.arDays, activeTechs: w.activeTechs })) },
      },
      contextLine: `Adoption Agent: health ${report.health}/100 (${report.band}), edit rate ${Math.round(report.trends.editRate.first * 100)}% to ${Math.round(report.trends.editRate.last * 100)}%, ${report.expansionTriggers.length} expansion trigger(s), churn risk ${report.churnRisk.level}`,
      notes: [],
    };
  },
};
