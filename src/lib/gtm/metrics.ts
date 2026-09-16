/**
 * The metrics the agents report weekly (GTM doc, section 7): funnel, agent
 * quality, product value, business. Computed from the CRM record and the
 * telemetry so every number on the metrics page is reproducible.
 */

import { DEMO_TODAY, addDays } from "@/lib/demo-date";
import type { GtmClient } from "./client";
import { AGENTS } from "./agents/registry";
import { TIERS } from "./pricing";
import type { Account, AgentKey, AgentRun, QueueItem } from "./types";
import type { ScoutReport } from "./agents/opportunity-scout";

export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: "count" | "usd" | "pct" | "days" | "months" | "seconds";
  hint: string;
  target?: number;
  assumption?: boolean;
}

export interface AgentQuality {
  agent: AgentKey;
  name: string;
  runs: number;
  failed: number;
  blocked: number;
  reviewed: number;
  approved: number;
  edited: number;
  rejected: number;
  /** Mean edit ratio across edited items; 0 when nothing was edited. */
  editRate: number;
  meanLatencyMs: number;
  modelTier: string;
}

export interface WeeklyMetrics {
  asOf: string;
  funnel: Metric[];
  agentQuality: AgentQuality[];
  productValue: Metric[];
  business: Metric[];
}

export async function computeWeeklyMetrics(gtm: GtmClient): Promise<WeeklyMetrics> {
  const [accounts, runs, queue, outbound] = await Promise.all([gtm.listAccounts(), gtm.listRuns({ limit: 1000 }), gtm.listQueueItems(), gtm.listOutbound()]);
  const weekAgo = addDays(DEMO_TODAY, -7);

  // ---- funnel
  const scored = new Set(runs.filter((r) => r.agent === "opportunity_scout" && r.status === "succeeded").map((r) => r.accountId)).size;
  const sequencesApproved = queue.filter((q) => q.kind === "sequence" && (q.status === "approved" || q.status === "edited")).length;
  const sequencesSent = new Set(outbound.map((m) => m.accountId)).size;
  const replies = outbound.filter((m) => m.status === "replied").length;
  const sandbox = runs.filter((r) => r.agent === "try_it_concierge" && r.status === "succeeded").length;
  const calls = accounts.filter((a) => ["call", "proposal", "closed_won", "onboarding", "live"].includes(a.stage)).length;
  const proposals = queue.filter((q) => q.kind === "proposal").length;
  const closed = accounts.filter((a) => ["closed_won", "onboarding", "live"].includes(a.stage)).length;
  const funnel: Metric[] = [
    { key: "scored", label: "Accounts scored", value: scored, unit: "count", hint: `of ${accounts.length} accounts in the CRM` },
    { key: "sequences_approved", label: "Sequences approved", value: sequencesApproved, unit: "count", hint: "a human approved or edited the draft" },
    { key: "sequences_sent", label: "Sequences sent", value: sequencesSent, unit: "count", hint: `${outbound.length} touches, each sent by a named person` },
    { key: "reply_rate", label: "Reply rate", value: outbound.length ? Math.round((replies / outbound.length) * 100) : 0, unit: "pct", hint: `${replies} replies on ${outbound.length} touches` },
    { key: "sandbox", label: "Sandbox sessions", value: sandbox, unit: "count", hint: "Try-It runs, anonymous or with a lead" },
    { key: "calls", label: "Calls booked", value: calls, unit: "count", hint: "accounts at call stage or later" },
    { key: "proposals", label: "Proposals", value: proposals, unit: "count", hint: "built by the Deal Desk" },
    { key: "closed", label: "Closed", value: closed, unit: "count", hint: "won, onboarding or live", target: 120 },
  ];

  // ---- agent quality
  const agentQuality: AgentQuality[] = AGENTS.map((a) => {
    const rs = runs.filter((r) => r.agent === a.key);
    const qs = queue.filter((q) => q.agent === a.key);
    const reviewed = qs.filter((q) => q.status !== "pending");
    const edited = qs.filter((q) => q.status === "edited");
    const ok = rs.filter((r) => r.status === "succeeded");
    return {
      agent: a.key,
      name: a.name,
      runs: rs.length,
      failed: rs.filter((r) => r.status === "failed").length,
      blocked: rs.filter((r) => r.status === "blocked").length,
      reviewed: reviewed.length,
      approved: qs.filter((q) => q.status === "approved").length,
      edited: edited.length,
      rejected: qs.filter((q) => q.status === "rejected").length,
      editRate: edited.length ? Math.round((edited.reduce((s, q) => s + (q.editRatio ?? 0), 0) / edited.length) * 100) / 100 : 0,
      meanLatencyMs: ok.length ? Math.round(ok.reduce((s, r) => s + r.latencyMs, 0) / ok.length) : 0,
      modelTier: a.modelTier,
    };
  });

  // ---- product value (from telemetry of live accounts)
  const live = accounts.filter((a) => a.stage === "live" || a.stage === "onboarding");
  const editRates: number[] = [];
  const approvalRates: number[] = [];
  let drafts = 0;
  let valpay = 0;
  const arDays: number[] = [];
  for (const a of live) {
    const weeks = await gtm.listAccountWeeks(a.id);
    const last = weeks.slice(-2);
    if (last.length === 0) continue;
    editRates.push(last.reduce((s, w) => s + w.editRate, 0) / last.length);
    approvalRates.push(last.reduce((s, w) => s + w.approvalRate, 0) / last.length);
    drafts += last.reduce((s, w) => s + w.draftsStarted, 0) / last.length;
    valpay += last.reduce((s, w) => s + w.valpayVolume, 0) / last.length;
    arDays.push(last[last.length - 1].arDays);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const scoutTotals = new Map<string, ScoutReport>();
  for (const r of runs.filter((r) => r.agent === "opportunity_scout" && r.status === "succeeded" && r.accountId)) {
    if (!scoutTotals.has(r.accountId!)) scoutTotals.set(r.accountId!, r.output as ScoutReport);
  }
  const unbilledRecovered = live.reduce((s, a) => s + (scoutTotals.get(a.id)?.opportunities.find((o) => o.key === "unbilled_labour")?.annualUsd ?? 0), 0);
  const productValue: Metric[] = [
    { key: "edit_rate", label: "Human edit rate on drafts", value: Math.round(mean(editRates) * 100), unit: "pct", hint: `mean of last two weeks across ${editRates.length} live accounts` },
    { key: "approval_rate", label: "Estimate approval rate", value: Math.round(mean(approvalRates) * 100), unit: "pct", hint: "customer approvals over estimates sent" },
    { key: "drafts_week", label: "Drafts a week", value: Math.round(drafts), unit: "count", hint: "across live accounts" },
    { key: "draft_to_approval", label: "Draft to approval time", value: 1.4, unit: "days", hint: "assumption until telemetry carries timestamps", assumption: true },
    { key: "unbilled_recovered", label: "Unbilled work recoverable", value: unbilledRecovered, unit: "usd", hint: "Scout unbilled-labour opportunity, live accounts, a year" },
    { key: "dso", label: "DSO, live accounts", value: Math.round(mean(arDays)), unit: "days", hint: "last telemetry week" },
  ];

  // ---- business
  const arr = accounts.filter((a) => a.tier).reduce((s, a) => {
    const t = TIERS[a.tier!];
    return s + (t.perLocationMonthly + t.perTechMonthly * Math.max(1, a.technicianCount)) * 12;
  }, 0);
  const onWeb = accounts.filter((a) => a.products.includes("web")).length;
  const valpayAttach = live.length ? Math.round((live.filter((a) => a.products.includes("valpay")).length / live.length) * 100) : 0;
  const business: Metric[] = [
    { key: "arr", label: "Service Writer ARR", value: arr, unit: "usd", hint: `${accounts.filter((a) => a.tier).length} paying accounts at list (assumption)`, assumption: true },
    { key: "web_attach", label: "Attach rate to Web", value: accounts.length ? Math.round((onWeb / accounts.length) * 100) : 0, unit: "pct", hint: `${onWeb} of ${accounts.length} accounts on DockMaster Web` },
    { key: "valpay_attach", label: "ValPay attach, live accounts", value: valpayAttach, unit: "pct", hint: "target +15 points in Revenue Suite accounts", target: 15 },
    { key: "valpay_volume", label: "ValPay volume a week", value: Math.round(valpay), unit: "usd", hint: "live accounts, mean of last two weeks" },
    { key: "nrr", label: "Net revenue retention", value: 108, unit: "pct", hint: "assumption until a full quarter of billing", assumption: true },
    { key: "cac_payback", label: "CAC payback", value: 7, unit: "months", hint: "target under 9 months (assumption)", target: 9, assumption: true },
  ];

  const recentRuns = runs.filter((r) => r.createdAt >= weekAgo).length;
  funnel.push({ key: "runs_week", label: "Agent runs this week", value: recentRuns, unit: "count", hint: "all agents, including blocked and failed" });

  return { asOf: DEMO_TODAY.toISOString(), funnel, agentQuality, productValue, business };
}

/** Per-account rollup used by the console and the accounts list. */
export interface AccountRollup {
  account: Account;
  scout: ScoutReport | null;
  pendingReviews: number;
  lastRun: AgentRun | null;
  touchesSent: number;
}

export function rollupAccounts(accounts: Account[], runs: AgentRun[], queue: QueueItem[], outboundByAccount: Map<string, number>): AccountRollup[] {
  return accounts.map((account) => {
    const scoutRun = runs.find((r) => r.accountId === account.id && r.agent === "opportunity_scout" && r.status === "succeeded");
    return {
      account,
      scout: scoutRun ? (scoutRun.output as ScoutReport) : null,
      pendingReviews: queue.filter((q) => q.accountId === account.id && q.status === "pending").length,
      lastRun: runs.find((r) => r.accountId === account.id) ?? null,
      touchesSent: outboundByAccount.get(account.id) ?? 0,
    };
  });
}
