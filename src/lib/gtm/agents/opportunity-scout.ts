/**
 * Opportunity Scout: computes the "Revenue Left on the Dock" report per account.
 *
 * Deterministic, no model. For the live Harbourline yard the figures come from
 * the DockMasterClient (the same API the Service Writer uses); for every other
 * consented account they come from the warehouse extract on the CRM record; for
 * accounts without consent only public signals are used and the report is
 * marked low confidence. Every figure carries the query that produced it and
 * every recovery rate is labelled as an assumption.
 */

import { DEMO_TODAY, addDays } from "@/lib/demo-date";
import type { DockMasterClient } from "@/lib/dockmaster/client";
import type { Account, SourceQuery, Tier } from "../types";
import { fig, type AgentContext, type AgentDefinition, type AgentResult } from "./framework";

/** The account row that represents the yard the Service Writer prototype runs on. */
export const HARBOURLINE_ACCOUNT_ID = "acc_harbourline";

export const RECOVERY_ASSUMPTIONS = {
  unbilledLabour: { rate: 0.5, note: "Half of the gap between standard and billed hours is recoverable with a documented, approved estimate (assumption)" },
  slowEstimates: { rate: 0.2, note: "One in five estimates that take over 3 days is lost or shrinks (assumption)" },
  dueForService: { rate: 0.3, note: "Proactive outreach converts 30% of vessels past an interval (assumption)" },
  agedAr: { rate: 0.08, note: "8% of AR over 45 days is bad debt or financing cost avoided with automated reminders and ValPay (assumption)" },
  publicHoursPerTech: { hours: 1600, note: "A yard technician has about 1,600 standard hours a year (assumption used only without consent)" },
  publicLaborRate: { rate: 150, note: "Regional average labour rate when the yard's rate is unknown (assumption)" },
} as const;

export type DataSource = "dockmaster_api_live" | "warehouse_extract" | "public_signals";

export interface Opportunity {
  key: string;
  label: string;
  annualUsd: number;
  formula: string;
  assumption: string;
}

export interface ScoutReport {
  accountId: string;
  accountName: string;
  dataSource: DataSource;
  consented: boolean;
  figures: SourceQuery[];
  opportunities: Opportunity[];
  totalAnnualUsd: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  fit: {
    onWebMobile: boolean;
    migrationNeeded: boolean;
    recommendedTier: Tier;
    reasons: string[];
  };
  score: number;
  pitchSentence: string;
}

export interface ScoutInput {
  accountId: string;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function int(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Trailing-twelve-month figures for the live yard, read through the DockMaster API boundary. */
export async function liveAccountData(dockmaster: DockMasterClient, account: Account): Promise<{ data: Account; queries: Record<string, string> }> {
  const since = addDays(DEMO_TODAY, -365);
  const [workOrders, overdue, due, technicians, vessels, marina] = await Promise.all([
    dockmaster.listWorkOrders({ status: ["closed"] }),
    dockmaster.listOverdueInvoices(),
    dockmaster.listVesselsDueForService(),
    dockmaster.listTechnicians(),
    dockmaster.listVessels(),
    dockmaster.getMarina(),
  ]);
  const ttm = workOrders.filter((w) => w.closedAt && w.closedAt >= since);
  const standard = ttm.reduce((s, w) => s + w.hoursStandard, 0);
  const billed = ttm.reduce((s, w) => s + w.hoursBilled, 0);
  const arOver45 = overdue.filter((i) => i.daysOverdue > 45).reduce((s, i) => s + i.amount, 0);
  const arTotal = overdue.reduce((s, i) => s + i.amount, 0);
  const avgJob = ttm.length ? ttm.reduce((s, w) => s + w.total, 0) / ttm.length : 0;
  const data: Account = {
    ...account,
    technicianCount: technicians.filter((t) => t.role !== "service_manager").length,
    vesselCount: vessels.length,
    laborRate: marina.laborRate,
    standardHoursTtm: Math.round(standard * 10) / 10,
    billedHoursTtm: Math.round(billed * 10) / 10,
    vesselsPastInterval: new Set(due.map((d) => d.vessel.id)).size,
    avgIntervalJobValue: Math.round(avgJob),
    arOver45: Math.round(arOver45 * 100) / 100,
    arTotal: Math.round(arTotal * 100) / 100,
  };
  return {
    data,
    queries: {
      standardHoursTtm: "DockMasterClient.listWorkOrders({status:[closed]}) filtered closedAt >= today-365d, sum(hoursStandard)",
      billedHoursTtm: "DockMasterClient.listWorkOrders({status:[closed]}) filtered closedAt >= today-365d, sum(hoursBilled)",
      vesselsPastInterval: "DockMasterClient.listVesselsDueForService(), distinct vessels",
      avgIntervalJobValue: "DockMasterClient.listWorkOrders closed TTM, mean(total)",
      arOver45: "DockMasterClient.listOverdueInvoices() where daysOverdue > 45, sum(amount)",
      arTotal: "DockMasterClient.listOverdueInvoices(), sum(amount)",
      technicianCount: "DockMasterClient.listTechnicians() where role != service_manager",
      laborRate: "DockMasterClient.getMarina().laborRate",
      estimatesTtm: "warehouse: estimates per tenant, trailing 12 months (prototype estimate table holds demo drafts only)",
      estimatesOver3Days: "warehouse: estimates where sent_at - created_at > 3 days, trailing 12 months",
      avgEstimateValue: "warehouse: mean(estimate.total), trailing 12 months",
    },
  };
}

const WAREHOUSE_QUERIES: Record<string, string> = {
  standardHoursTtm: "SELECT SUM(op.standard_hours) FROM work_orders wo JOIN work_order_operations op USING (work_order_id) WHERE wo.tenant_id = :tenant AND wo.closed_at >= now() - interval '12 months'",
  billedHoursTtm: "SELECT SUM(wo.hours_billed) FROM work_orders wo WHERE wo.tenant_id = :tenant AND wo.closed_at >= now() - interval '12 months'",
  estimatesTtm: "SELECT COUNT(*) FROM estimates WHERE tenant_id = :tenant AND created_at >= now() - interval '12 months'",
  estimatesOver3Days: "SELECT COUNT(*) FROM estimates WHERE tenant_id = :tenant AND sent_at - created_at > interval '3 days' AND created_at >= now() - interval '12 months'",
  avgEstimateValue: "SELECT AVG(total) FROM estimates WHERE tenant_id = :tenant AND created_at >= now() - interval '12 months'",
  vesselsPastInterval: "SELECT COUNT(DISTINCT vessel_id) FROM vessel_intervals WHERE tenant_id = :tenant AND months_since_last > interval_months",
  avgIntervalJobValue: "SELECT AVG(total) FROM work_orders WHERE tenant_id = :tenant AND has_interval_operation AND closed_at >= now() - interval '12 months'",
  arOver45: "SELECT SUM(amount) FROM invoices WHERE tenant_id = :tenant AND paid_at IS NULL AND now() - due_at > interval '45 days'",
  arTotal: "SELECT SUM(amount) FROM invoices WHERE tenant_id = :tenant AND paid_at IS NULL AND due_at < now()",
  technicianCount: "SELECT COUNT(*) FROM technicians WHERE tenant_id = :tenant AND active",
  laborRate: "SELECT labor_rate FROM tenants WHERE id = :tenant",
  dsoDays: "SELECT AVG(paid_at - issued_at) FROM invoices WHERE tenant_id = :tenant AND paid_at >= now() - interval '12 months'",
};

const PUBLIC_QUERIES: Record<string, string> = {
  technicianCount: "public signals: technician job postings, website team page, review mentions",
  vesselCount: "public signals: slip count from website and marina directories",
  laborRate: "assumption: regional average, yard rate unknown without consent",
};

/** Pure computation so the seed and the tests can run it without a database. */
export function computeScoutReport(account: Account, opts: { dataSource: DataSource; queries: Record<string, string> }): ScoutReport {
  const consented = account.dataConsent;
  const figures: SourceQuery[] = [];
  const opportunities: Opportunity[] = [];
  const q = (k: string) => opts.queries[k] ?? WAREHOUSE_QUERIES[k] ?? k;

  if (opts.dataSource === "public_signals") {
    const rate = account.laborRate || RECOVERY_ASSUMPTIONS.publicLaborRate.rate;
    const techs = account.technicianCount;
    figures.push(fig("technicianCount", "Technicians (estimated)", techs, "count", q("technicianCount")));
    figures.push(fig("vesselCount", "Vessels (estimated)", account.vesselCount, "count", q("vesselCount")));
    figures.push(fig("laborRate", "Labour rate", rate, "usd", q("laborRate"), account.laborRate ? undefined : RECOVERY_ASSUMPTIONS.publicLaborRate.note));
    const standard = techs * RECOVERY_ASSUMPTIONS.publicHoursPerTech.hours;
    figures.push(fig("standardHoursTtm", "Standard hours a year (estimated)", standard, "hours", `technicians x ${RECOVERY_ASSUMPTIONS.publicHoursPerTech.hours}`, RECOVERY_ASSUMPTIONS.publicHoursPerTech.note));
    const anchor = techs * 48 * rate;
    figures.push(fig("recoveredHourAnchor", "One recovered billable hour per tech per week", anchor, "usd", "technicians x 48 weeks x labour rate"));
    opportunities.push({
      key: "anchor",
      label: "One recovered billable hour per technician per week",
      annualUsd: Math.round(anchor),
      formula: `${techs} technicians x 48 weeks x ${usd(rate)}`,
      assumption: "Sizing anchor used when the yard's own data is not available",
    });
  } else {
    const a = account;
    figures.push(fig("standardHoursTtm", "Standard hours, last 12 months", a.standardHoursTtm, "hours", q("standardHoursTtm")));
    figures.push(fig("billedHoursTtm", "Billed hours, last 12 months", a.billedHoursTtm, "hours", q("billedHoursTtm")));
    const unbilled = Math.max(0, a.standardHoursTtm - a.billedHoursTtm);
    figures.push(fig("unbilledHours", "Unbilled standard hours", unbilled, "hours", "standardHoursTtm - billedHoursTtm"));
    figures.push(fig("laborRate", "Labour rate", a.laborRate, "usd", q("laborRate")));
    figures.push(fig("estimatesTtm", "Estimates, last 12 months", a.estimatesTtm, "count", q("estimatesTtm")));
    figures.push(fig("estimatesOver3Days", "Estimates that took over 3 days", a.estimatesOver3Days, "count", q("estimatesOver3Days")));
    figures.push(fig("avgEstimateValue", "Average estimate value", a.avgEstimateValue, "usd", q("avgEstimateValue")));
    figures.push(fig("vesselsPastInterval", "Vessels past a maintenance interval", a.vesselsPastInterval, "count", q("vesselsPastInterval")));
    figures.push(fig("avgIntervalJobValue", "Average interval job value", a.avgIntervalJobValue, "usd", q("avgIntervalJobValue")));
    figures.push(fig("arOver45", "AR over 45 days", a.arOver45, "usd", q("arOver45")));
    figures.push(fig("arTotal", "AR overdue, total", a.arTotal, "usd", q("arTotal")));
    figures.push(fig("technicianCount", "Technicians", a.technicianCount, "count", q("technicianCount")));
    if (a.dsoDays) figures.push(fig("dsoDays", "Days sales outstanding", a.dsoDays, "days", q("dsoDays")));
    // The thresholds the report quotes ("more than 3 days", "over 45 days") are figures too.
    figures.push(fig("slowEstimateThresholdDays", "Slow estimate threshold", 3, "days", "policy constant: estimate turnaround over 3 days"));
    figures.push(fig("agedArThresholdDays", "Aged AR threshold", 45, "days", "policy constant: invoices over 45 days past due"));

    const unbilledUsd = unbilled * a.laborRate * RECOVERY_ASSUMPTIONS.unbilledLabour.rate;
    opportunities.push({
      key: "unbilled_labour",
      label: "Unbilled labour recovered",
      annualUsd: Math.round(unbilledUsd),
      formula: `${int(unbilled)} unbilled hours x ${usd(a.laborRate)} x ${RECOVERY_ASSUMPTIONS.unbilledLabour.rate}`,
      assumption: RECOVERY_ASSUMPTIONS.unbilledLabour.note,
    });
    const slowUsd = a.estimatesOver3Days * a.avgEstimateValue * RECOVERY_ASSUMPTIONS.slowEstimates.rate;
    opportunities.push({
      key: "slow_estimates",
      label: "Estimates saved by same-day drafting",
      annualUsd: Math.round(slowUsd),
      formula: `${int(a.estimatesOver3Days)} slow estimates x ${usd(a.avgEstimateValue)} x ${RECOVERY_ASSUMPTIONS.slowEstimates.rate}`,
      assumption: RECOVERY_ASSUMPTIONS.slowEstimates.note,
    });
    const dueUsd = a.vesselsPastInterval * a.avgIntervalJobValue * RECOVERY_ASSUMPTIONS.dueForService.rate;
    opportunities.push({
      key: "due_for_service",
      label: "Due-for-service work booked",
      annualUsd: Math.round(dueUsd),
      formula: `${int(a.vesselsPastInterval)} vessels x ${usd(a.avgIntervalJobValue)} x ${RECOVERY_ASSUMPTIONS.dueForService.rate}`,
      assumption: RECOVERY_ASSUMPTIONS.dueForService.note,
    });
    const arUsd = a.arOver45 * RECOVERY_ASSUMPTIONS.agedAr.rate;
    opportunities.push({
      key: "aged_ar",
      label: "Aged AR cost avoided",
      annualUsd: Math.round(arUsd),
      formula: `${usd(a.arOver45)} x ${RECOVERY_ASSUMPTIONS.agedAr.rate}`,
      assumption: RECOVERY_ASSUMPTIONS.agedAr.note,
    });
  }

  const totalAnnualUsd = opportunities.reduce((s, o) => s + o.annualUsd, 0);
  figures.push(fig("totalAnnualUsd", "Revenue left on the dock, a year", totalAnnualUsd, "usd", "sum of opportunities"));
  for (const o of opportunities) figures.push(fig(`opp_${o.key}`, o.label, o.annualUsd, "usd", o.formula, o.assumption));

  const onWebMobile = account.products.includes("web") && account.products.includes("mobile");
  const migrationNeeded = !onWebMobile;
  const fitReasons: string[] = [];
  let recommendedTier: Tier = "service_writer";
  if (account.groupName) {
    recommendedTier = "group";
    fitReasons.push(`Part of ${account.groupName}: sell top-down with a cross-site league table`);
  } else if (account.arOver45 >= 20_000 || account.dsoDays > 45) {
    recommendedTier = "revenue_suite";
    fitReasons.push("Aged AR and DSO justify the collections agent and ValPay attach");
  } else if (account.products.includes("scheduling") || account.products.includes("blu")) {
    recommendedTier = "ai_service_desk";
    fitReasons.push("Already on Scheduling or Blu: bundle at the AI Service Desk price");
  } else {
    fitReasons.push("Start with the Service Writer; upsell on adoption signals");
  }
  if (onWebMobile) fitReasons.push("On Web and Mobile: no migration before go-live");
  else if (account.platform === "dockmaster_desktop") fitReasons.push("Desktop only: the Service Writer is the reason to migrate to Web and Mobile");
  else if (account.platform === "dockmaster_web") fitReasons.push("On Web without Mobile: add Mobile for voice capture");
  else fitReasons.push("New logo: win with the live demo on their own tech notes");

  let confidence: ScoutReport["confidence"];
  let confidenceReason: string;
  if (opts.dataSource === "public_signals") {
    confidence = "low";
    confidenceReason = "No data consent: sized from public signals and the one-hour-per-tech anchor";
  } else if (opts.dataSource === "dockmaster_api_live") {
    confidence = "high";
    confidenceReason = "Read live through the DockMaster API for a consented account";
  } else {
    const zeros = figures.filter((f) => f.value === 0 && !f.key.startsWith("opp_")).length;
    confidence = zeros === 0 ? "high" : "medium";
    confidenceReason = zeros === 0 ? "Full trailing-twelve-month extract for a consented account" : `${zeros} figure(s) are zero in the extract; confirm with the CSM`;
  }

  const score = Math.round(
    Math.min(55, totalAnnualUsd / 2500) +
      (onWebMobile ? 20 : account.platform === "dockmaster_web" ? 10 : 0) +
      (consented ? 10 : 0) +
      (account.designPartner ? 5 : 0) +
      Math.min(10, account.technicianCount),
  );

  const a = account;
  const pitchSentence =
    opts.dataSource === "public_signals"
      ? `${a.name} runs about ${int(a.technicianCount)} technicians. One recovered billable hour per technician per week is worth ${usd(opportunities[0].annualUsd)} a year at ${usd(figures.find((f) => f.key === "laborRate")!.value)} an hour. The free tool shows the draft on your own tech notes in 15 seconds.`
      : `${a.name}, last season you billed ${int(a.billedHoursTtm)} of ${int(a.standardHoursTtm)} standard hours, ${int(a.estimatesOver3Days)} estimates took more than 3 days to reach the customer, ${int(a.vesselsPastInterval)} vessels are past a maintenance interval, and ${usd(a.arOver45)} of AR is over 45 days. Here is what the Service Writer would have recovered: ${usd(totalAnnualUsd)} a year.`;

  return {
    accountId: account.id,
    accountName: account.name,
    dataSource: opts.dataSource,
    consented,
    figures,
    opportunities,
    totalAnnualUsd,
    confidence,
    confidenceReason,
    fit: { onWebMobile, migrationNeeded, recommendedTier, reasons: fitReasons },
    score: Math.max(0, Math.min(100, score)),
    pitchSentence,
  };
}

/** Resolve which data source an account is entitled to and build its report. */
export async function scoutAccount(ctx: Pick<AgentContext, "dockmaster">, account: Account): Promise<ScoutReport> {
  if (!account.dataConsent) {
    return computeScoutReport(account, { dataSource: "public_signals", queries: PUBLIC_QUERIES });
  }
  if (account.id === HARBOURLINE_ACCOUNT_ID) {
    const live = await liveAccountData(ctx.dockmaster, account);
    return computeScoutReport(live.data, { dataSource: "dockmaster_api_live", queries: live.queries });
  }
  return computeScoutReport(account, { dataSource: "warehouse_extract", queries: WAREHOUSE_QUERIES });
}

export const opportunityScout: AgentDefinition<ScoutInput, ScoutReport> = {
  key: "opportunity_scout",
  name: "Opportunity Scout",
  job: 'Compute the "Revenue Left on the Dock" report per account',
  inputs: "Consented account data via the DockMaster API: work orders, standards, invoices, vessel intervals",
  output: "Per-account score and dollar estimate; ranked target list",
  owner: "Head of Sales",
  modelTier: "none",
  needsAccount: true,
  async run(ctx, _input, account): Promise<AgentResult<ScoutReport>> {
    const started = Date.now();
    const report = await scoutAccount(ctx, account!);
    return {
      output: report,
      sourceQueries: report.figures,
      steps: [{ step: "compute_report", latencyMs: Date.now() - started }],
      queue: {
        kind: "scout_report",
        title: `Revenue Left on the Dock: ${report.accountName}`,
        sourceData: { dataSource: report.dataSource, consented: report.consented, figures: report.figures },
      },
      contextLine: `Scout scored ${report.score}/100, ${usd(report.totalAnnualUsd)} a year recoverable (${report.confidence} confidence, ${report.dataSource}), recommended tier ${report.fit.recommendedTier}`,
      notes: report.consented ? [] : ["No data consent on file: report built from public signals only. Ask for consent before quoting the yard's own numbers."],
    };
  },
};
