/**
 * Step 5: deterministic estimate building. No LLM here. Everything priced comes
 * from the DockMasterClient: standard hours, labour rates, kit parts, stock.
 */

import type { DockMasterClient } from "@/lib/dockmaster/client";
import type {
  EstimateInput,
  EstimateLineInput,
  EstimateTotals,
  HistoryFlag,
  Marina,
  Technician,
  Vessel,
  WorkOrderSummary,
} from "@/lib/dockmaster/types";
import { intervalStatus } from "@/lib/due-for-service";
import { formatDate } from "@/lib/demo-date";
import { round2 } from "@/lib/utils";
import allowedCodes from "./allowed-codes.json";
import type { OperationMatchResult } from "./match-operations";

export const MANAGER_APPROVAL_THRESHOLD = 5000;
export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MEDIUM = 0.6;

export type ConfidenceLevel = "high" | "medium" | "low";
export function confidenceLevel(c: number | null | undefined): ConfidenceLevel {
  if (c == null) return "low";
  if (c >= CONFIDENCE_HIGH) return "high";
  if (c >= CONFIDENCE_MEDIUM) return "medium";
  return "low";
}

interface RoleScope {
  allowedCategories: string[] | "*";
  deniedCodes: string[];
}

export function isCodeAllowedForRole(role: string, code: string, category: string): boolean {
  const scope = (allowedCodes.roles as Record<string, RoleScope>)[role];
  if (!scope) return false;
  if (scope.deniedCodes.includes(code)) return false;
  if (scope.allowedCategories === "*") return true;
  return scope.allowedCategories.includes(category);
}

export interface DraftEstimate extends EstimateInput {
  historyFlags: HistoryFlag[];
  /** Which matched findings fed this draft, for the reasoning panel. */
  findingIndexes: number[];
}

/** Kits list parts for several engine brands; keep the ones that fit this vessel. */
export function kitItemsForVessel<T extends { part: { fitsEngineMakes: string[] } }>(
  items: T[],
  vessel: Pick<Vessel, "engineMake">,
): T[] {
  const make = vessel.engineMake.toLowerCase();
  return items.filter(
    (i) => i.part.fitsEngineMakes.length === 0 || i.part.fitsEngineMakes.some((m) => m.toLowerCase() === make),
  );
}

export interface BuildEstimateOptions {
  client: DockMasterClient;
  marina: Marina;
  vessel: Vessel;
  history: WorkOrderSummary[];
  technician: Technician | null;
  matches: OperationMatchResult[];
  techNoteId?: string | null;
  photoPaths?: string[];
  origin?: EstimateInput["origin"];
}

export function computeTotals(lines: EstimateLineInput[], marina: Marina): EstimateTotals {
  const included = lines.filter((l) => l.included !== false);
  const subtotalLabor = round2(
    included.filter((l) => l.kind === "operation" || l.kind === "misc").reduce((s, l) => s + l.lineTotal, 0),
  );
  const subtotalParts = round2(included.filter((l) => l.kind === "part").reduce((s, l) => s + l.lineTotal, 0));
  const shopSupplies = round2(subtotalLabor * (marina.shopSuppliesPct / 100));
  const tax = round2((subtotalParts + shopSupplies) * (marina.taxPct / 100));
  const total = round2(subtotalLabor + subtotalParts + shopSupplies + tax);
  return { subtotalLabor, subtotalParts, shopSupplies, tax, total };
}

function engineMultiplier(match: OperationMatchResult, vessel: Vessel): number {
  if (match.code?.category !== "engine") return 1;
  if (vessel.engineCount <= 1) return 1;
  return match.finding.engine === "both" ? vessel.engineCount : 1;
}

function engineLabel(match: OperationMatchResult, vessel: Vessel): string {
  if (vessel.engineCount <= 1 || match.code?.category !== "engine") return "";
  switch (match.finding.engine) {
    case "port":
      return " (port engine)";
    case "starboard":
      return " (starboard engine)";
    case "both":
      return ` (both engines)`;
    default:
      return "";
  }
}

async function buildLinesForMatch(
  opts: BuildEstimateOptions,
  match: OperationMatchResult,
  sortStart: number,
): Promise<{ lines: EstimateLineInput[]; flags: HistoryFlag[] }> {
  const { client, marina, vessel, history, technician } = opts;
  const lines: EstimateLineInput[] = [];
  const flags: HistoryFlag[] = [];
  const key = `f${match.findingIndex}`;
  const quoted = `matched from "${match.finding.technicianRecommendation}"`;

  if (!match.code) {
    lines.push({
      key,
      kind: "misc",
      description: `Unmapped: ${match.unmappedDescription ?? match.finding.technicianRecommendation}`,
      hours: null,
      rate: marina.laborRate,
      lineTotal: 0,
      included: false,
      confidence: match.confidence,
      source: "ai",
      rationale: match.rationale,
      sourceNote: `no operation code fits "${match.finding.technicianRecommendation}"`,
      needsManagerReview: true,
      sortOrder: sortStart,
    });
    return { lines, flags };
  }

  const op = match.code;
  const rate = op.laborRate ?? marina.laborRate;
  const multiplier = engineMultiplier(match, vessel);
  const standardHours = round2(op.standardHours * multiplier);

  // Technician hours override: accepted when within 50% of standard, otherwise flagged.
  let hours = standardHours;
  let hoursFlag: string | null = null;
  const techHours = match.finding.estimatedHours;
  if (techHours != null && techHours > 0) {
    const ratio = techHours / standardHours;
    if (ratio >= 0.5 && ratio <= 1.5) {
      hours = techHours;
    } else {
      hoursFlag = `Technician estimated ${techHours} h, standard is ${standardHours} h. Standard used, review.`;
    }
  }

  const allowed = technician ? isCodeAllowedForRole(technician.role, op.code, op.category) : true;
  const included = match.confidence >= CONFIDENCE_MEDIUM && allowed;

  lines.push({
    key,
    kind: "operation",
    operationCodeId: op.id,
    description: `${op.code}: ${op.description}${engineLabel(match, vessel)}`,
    hours,
    standardHours,
    technicianHours: techHours ?? null,
    hoursFlag,
    rate,
    lineTotal: round2(hours * rate),
    included,
    confidence: match.confidence,
    source: "ai",
    rationale: match.rationale,
    sourceNote: quoted,
    needsManagerReview: !allowed,
    sortOrder: sortStart,
  });

  // Kit parts, with live stock check.
  const kit = await client.getPartsKit(op.code);
  if (kit) {
    let i = 1;
    for (const item of kitItemsForVessel(kit.items, vessel)) {
      const qty = round2(item.qty * multiplier);
      const short = item.part.onHand < qty;
      const stockWarning = short
        ? item.part.onHand === 0
          ? `Out of stock (0 on hand), order required`
          : `Only ${item.part.onHand} on hand, ${qty} needed`
        : item.part.onHand <= item.part.reorderPoint
          ? `At reorder point (${item.part.onHand} on hand)`
          : null;
      lines.push({
        key: `${key}p${i}`,
        parentLineKey: key,
        kind: "part",
        partId: item.part.id,
        description: `${item.part.partNumber} ${item.part.description}`,
        qty,
        unitCost: item.part.cost,
        unitPrice: item.part.sellPrice,
        lineTotal: round2(qty * item.part.sellPrice),
        included,
        confidence: match.confidence,
        source: "ai",
        sourceNote: `from kit "${kit.name}" for ${op.code}`,
        stockWarning,
        needsManagerReview: !allowed,
        sortOrder: sortStart + i,
      });
      i++;
    }
  }

  // History flags from this vessel's closed work orders.
  if (op.maintenanceIntervalMonths) {
    const status = intervalStatus(history, op);
    if (status.lastDoneAt) {
      const overdue = (status.monthsSince ?? 0) > op.maintenanceIntervalMonths;
      flags.push({
        kind: overdue ? "interval_overdue" : "interval_ok",
        message: `Last ${op.description.toLowerCase()} ${status.monthsSince} months ago (${status.workOrderNumber}, ${formatDate(status.lastDoneAt)}). Manufacturer interval ${op.maintenanceIntervalMonths} months.`,
        workOrderNumber: status.workOrderNumber ?? undefined,
        operationCode: op.code,
      });
    } else {
      flags.push({
        kind: "info",
        message: `No prior ${op.description.toLowerCase()} on file for this vessel. Interval ${op.maintenanceIntervalMonths} months.`,
        operationCode: op.code,
      });
    }
  } else {
    const repeat = history.find((wo) => wo.status === "closed" && wo.operations.some((o) => o.code === op.code));
    if (repeat?.closedAt) {
      flags.push({
        kind: "repeat_issue",
        message: `${op.description} was last done on ${repeat.number} (${formatDate(repeat.closedAt)}).`,
        workOrderNumber: repeat.number,
        operationCode: op.code,
      });
    }
  }

  return { lines, flags };
}

function titleFor(matches: OperationMatchResult[], vessel: Vessel, separate: boolean): string {
  const systems = Array.from(new Set(matches.map((m) => m.code?.category ?? m.finding.system)));
  const label = systems.slice(0, 2).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" and ");
  return `${vessel.name}: ${label} service${separate ? " (quoted separately)" : ""}`;
}

/**
 * Turns matched findings into one or more estimate drafts. Findings flagged
 * quoteSeparately by the technician become their own draft.
 */
export async function buildEstimates(opts: BuildEstimateOptions): Promise<DraftEstimate[]> {
  const { marina, vessel, technician, matches } = opts;
  const groups: { separate: boolean; matches: OperationMatchResult[] }[] = [];
  const main = matches.filter((m) => !m.finding.quoteSeparately);
  const separate = matches.filter((m) => m.finding.quoteSeparately);
  if (main.length) groups.push({ separate: false, matches: main });
  for (const m of separate) groups.push({ separate: true, matches: [m] });

  const drafts: DraftEstimate[] = [];
  for (const group of groups) {
    const lines: EstimateLineInput[] = [];
    const flags: HistoryFlag[] = [];
    let sort = 0;
    for (const m of group.matches) {
      const built = await buildLinesForMatch(opts, m, sort);
      lines.push(...built.lines);
      flags.push(...built.flags);
      sort += 20;
    }
    const totals = computeTotals(lines, marina);
    drafts.push({
      status: "draft_ai",
      title: titleFor(group.matches, vessel, group.separate),
      vesselId: vessel.id,
      customerId: vessel.customerId,
      technicianId: technician?.id ?? null,
      techNoteId: opts.techNoteId ?? null,
      origin: opts.origin ?? "tech_note",
      quoteSeparately: group.separate,
      totals,
      requiresManagerApproval: totals.total > MANAGER_APPROVAL_THRESHOLD,
      historyFlags: flags,
      photoPaths: opts.photoPaths ?? [],
      lines,
      findingIndexes: group.matches.map((m) => m.findingIndex),
    });
  }
  return drafts;
}
