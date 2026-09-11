/**
 * Proactive outreach for a vessel that is past a service interval. Reuses the
 * deterministic estimate builder (step 5) and narrative (step 6), then drafts a
 * short SMS and email. Nothing is sent; the manager reviews and clicks.
 */

import type { DockMasterClient } from "@/lib/dockmaster/client";
import type { DueForServiceItem, Estimate } from "@/lib/dockmaster/types";
import type { StructuredCaller } from "./anthropic";
import { buildEstimates } from "./build-estimate";
import type { OperationMatchResult } from "./match-operations";
import { applyNarrative, writeNarrative } from "./narrative";
import { OutreachSchema, type Outreach } from "./schemas";

const SYSTEM = `You write short, warm, direct service reminders for a marina. The reader is a boat owner who has used this yard before. Mention the boat by name, what is due and why (the interval), and that an estimate is ready to review in their portal. No pressure, no discounts, no exclamation marks. Sign as the yard's service team.`;

export interface OutreachResult {
  estimate: Estimate;
  message: Outreach;
}

export async function draftOutreach(
  client: DockMasterClient,
  ai: StructuredCaller,
  item: DueForServiceItem,
): Promise<OutreachResult> {
  const [marina, history] = await Promise.all([client.getMarina(), client.getVesselHistory(item.vessel.id)]);

  // A synthetic "finding" so the builder can price the recommended operation.
  const match: OperationMatchResult = {
    findingIndex: 0,
    finding: {
      system: item.operation.category as OperationMatchResult["finding"]["system"],
      symptom: `${item.operation.description} interval elapsed`,
      observation: `Last done ${item.monthsSince} months ago, interval ${item.intervalMonths} months`,
      severity: "medium",
      technicianRecommendation: item.operation.description,
      estimatedHours: null,
      engine: item.vessel.engineCount > 1 ? "both" : "single",
      quoteSeparately: false,
    },
    shortlist: [item.operation],
    code: item.operation,
    confidence: 1,
    rationale: `Scheduled maintenance: ${item.monthsOverdue} months past the ${item.intervalMonths} month interval`,
    unmappedDescription: null,
  };

  const [draft] = await buildEstimates({
    client,
    marina,
    vessel: item.vessel,
    history,
    technician: null,
    matches: [match],
    origin: "outreach",
  });
  const transcript = `Proactive reminder: ${item.operation.description} is ${item.monthsOverdue} months past its ${item.intervalMonths} month interval (last ${item.lastWorkOrderNumber}).`;
  const narrative = await writeNarrative(ai, draft, item.vessel, transcript);
  const withWords = applyNarrative(draft, narrative.output);

  const estimate = await client.createEstimate({
    ...withWords,
    title: `${item.vessel.name}: ${item.operation.description} (due)`,
    vesselMatchConfidence: 1,
    vesselMatchReasons: ["Selected from due-for-service list"],
    reasoning: {
      steps: [
        { step: "due_for_service", latencyMs: 0, input: { code: item.operation.code }, output: { monthsOverdue: item.monthsOverdue } },
        { step: "write_narrative", latencyMs: narrative.latencyMs, model: narrative.model, input: {}, output: narrative.output },
      ],
      notes: [],
    },
  });

  const { output: message, latencyMs } = await ai.call({
    name: "write_outreach",
    description: "Write a short SMS and a short email inviting the owner to review a service estimate.",
    system: SYSTEM,
    user: JSON.stringify(
      {
        ownerFirstName: item.vessel.customer.name.split(" ")[0],
        boatName: item.vessel.name,
        boat: `${item.vessel.year} ${item.vessel.make} ${item.vessel.model}`,
        service: item.operation.description,
        intervalMonths: item.intervalMonths,
        monthsSinceLast: item.monthsSince,
        estimateTotal: estimate.totals.total,
        yard: marina.name,
      },
      null,
      2,
    ),
    schema: OutreachSchema,
    maxTokens: 1024,
  });

  await client.logActivity({
    actor: "ai",
    action: "outreach.drafted",
    entityType: "estimate",
    entityId: estimate.id,
    payload: { vessel: item.vessel.name, code: item.operation.code, latencyMs, message },
  });

  return { estimate, message };
}
