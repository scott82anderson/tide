/**
 * Every agent reads the CRM record before acting. These helpers fetch the
 * latest output of an upstream agent for an account, preferring what a human
 * has approved over what is still pending.
 */

import type { GtmClient } from "../client";
import type { QueueItem, QueueKind } from "../types";
import type { Research } from "../schemas";
import type { ScoutReport } from "./opportunity-scout";

export async function latestQueueItem(gtm: GtmClient, accountId: string, kind: QueueKind): Promise<QueueItem | null> {
  const items = await gtm.listQueueItems({ accountId, kind });
  if (items.length === 0) return null;
  const reviewed = items.find((i) => i.status === "approved" || i.status === "edited");
  return reviewed ?? items.find((i) => i.status === "pending") ?? null;
}

/** The output a human signed off on, or the draft when nothing is reviewed yet. */
export function effectiveOutput<T>(item: QueueItem): T {
  return (item.status === "edited" && item.editedOutput != null ? item.editedOutput : item.output) as T;
}

export async function latestScout(gtm: GtmClient, accountId: string): Promise<{ report: ScoutReport; item: QueueItem } | null> {
  const item = await latestQueueItem(gtm, accountId, "scout_report");
  return item ? { report: effectiveOutput<ScoutReport>(item), item } : null;
}

export async function latestResearch(gtm: GtmClient, accountId: string): Promise<{ research: Research; item: QueueItem } | null> {
  const item = await latestQueueItem(gtm, accountId, "research");
  if (!item) return null;
  const out = effectiveOutput<{ research: Research }>(item);
  return { research: out.research, item };
}
