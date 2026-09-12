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
  /** Non-fatal notes produced while building (hours reassignment, etc). */
  buildNotes: string[];
}

/**
 * Kits list parts for several engine brands and models. Keep the ones that fit
 * this vessel: first by make, then, where a kit carries several variants of the
 * same part (same description before the comma), prefer the variant whose
 * description mentions a token of the vessel's engine model ("8.2 MAG" for an
 * "8.2 MAG ECT"). If no variant mentions the model, all variants are kept and
 * the manager picks.
 */
export function kitItemsForVessel<T extends { part: { description: string; fitsEngineMakes: string[] } }>(
  items: T[],
  vessel: Pick<Vessel, "engineMake" | "engineModel">,
): T[] {
  const make = vessel.engineMake.toLowerCase();
  const byMake = items.filter(
    (i) => i.part.fitsEngineMakes.length === 0 || i.part.fitsEngineMakes.some((m) => m.toLowerCase() === make),
  );

  const modelTokens = vessel.engineModel
    .toLowerCase()
    .split(/[\s/]+/)
    .filter((t) => t.length >= 2);
  const mentionsModel = (description: string) => {
    const words = description.toLowerCase().split(/[\s,/()]+/);
    return modelTokens.some((t) => words.includes(t));
  };
  const role = (description: string) => description.split(",")[0].trim().toLowerCase();

  const groups = new Map<string, T[]>();
  for (const item of byMake) {
    const key = role(item.part.description);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const keep = new Set<T>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      keep.add(group[0]);
      continue;
    }
    const matching = group.filter((i) => mentionsModel(i.part.description));
    for (const i of matching.length ? matching : group) keep.add(i);
  }
  return byMake.filter((i) => keep.has(i));
}

/**
 * A technician often quotes one time for a whole job ("call it three, maybe
 * three and a half hours"). Extraction attaches it to one finding; if it does
 * not fit that line's standard but fits the largest line in the job, move it
 * there. Returns the matches with hours reassigned plus a note for the trace.
 */
export function reassignJobLevelHours(
  matches: OperationMatchResult[],
  vessel: Vessel,
): { matches: OperationMatchResult[]; notes: string[] } {
  const notes: string[] = [];
  const withHours = matches.filter((m) => m.finding.estimatedHours != null && m.code);
  if (withHours.length !== 1 || matches.filter((m) => m.code).length < 2) return { matches, notes };

  const source = withHours[0];
  const hours = source.finding.estimatedHours as number;
  const standardOf = (m: OperationMatchResult) => (m.code!.standardHours * engineMultiplier(m, vessel));
  const fits = (std: number) => hours / std >= 0.5 && hours / std <= 1.5;
  if (fits(standardOf(source))) return { matches, notes };

  const target = matches
    .filter((m) => m.code && m.finding.estimatedHours == null)
    .sort((a, b) => standardOf(b) - standardOf(a))[0];
  if (!target || !fits(standardOf(target))) return { matches, notes };

  notes.push(
    `Technician's ${hours} h does not fit ${source.code!.code} (standard ${standardOf(source)} h); applied to the largest line ${target.code!.code} (standard ${standardOf(target)} h) as a job-level estimate.`,
  );
  const out = matches.map((m) => {
    if (m === source) return { ...m, finding: { ...m.finding, estimatedHours: null } };
    if (m === target) return { ...m, finding: { ...m.finding, estimatedHours: hours } };
    return m;
  });
  return { matches: out, notes };
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
    const reassigned = reassignJobLevelHours(group.matches, vessel);
    let sort = 0;
    for (const m of reassigned.matches) {
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
      buildNotes: reassigned.notes,
    });
  }
  return drafts;
}
