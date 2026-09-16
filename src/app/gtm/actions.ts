"use server";

import { revalidatePath } from "next/cache";
import { DEMO_TODAY } from "@/lib/demo-date";
import { effectiveOutput } from "@/lib/gtm/agents/crm-reads";
import type { OnboardingOutput } from "@/lib/gtm/agents/onboarding-agent";
import type { SequenceOutput } from "@/lib/gtm/agents/sequencer";
import type { Research } from "@/lib/gtm/schemas";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import { AgentRunError, createAgentContext, runAgent } from "@/lib/gtm/runner";
import { editRatio } from "@/lib/gtm/style-lint";
import { memberByName } from "@/lib/gtm/team";
import type { AgentKey, QueueStatus, Stage } from "@/lib/gtm/types";

export interface RunAgentResponse {
  ok: boolean;
  blocked?: boolean;
  message: string;
  queueItemId?: string | null;
  runId?: string;
}

/** Runs one agent. Output lands on the review queue; nothing is sent. */
export async function runAgentAction(key: AgentKey, input: Record<string, unknown>): Promise<RunAgentResponse> {
  try {
    const outcome = await runAgent(createAgentContext(), key, input);
    revalidateGtm(outcome.account?.id ?? null);
    return {
      ok: true,
      message: outcome.queueItem ? `${outcome.queueItem.title} is on the review queue for the ${outcome.queueItem.approverRole}.` : "Done.",
      queueItemId: outcome.queueItem?.id ?? null,
      runId: outcome.run.id,
    };
  } catch (err) {
    if (err instanceof AgentRunError) {
      revalidateGtm(typeof input.accountId === "string" ? input.accountId : null);
      return { ok: false, blocked: err.blocked, message: err.message, runId: err.run.id };
    }
    console.error("[gtm]", err);
    return { ok: false, message: err instanceof Error ? err.message : "The agent failed." };
  }
}

/** Human decision on a queue item. Edits are measured so the agent's edit rate can be tracked. */
export async function reviewQueueItemAction(
  id: string,
  decision: Exclude<QueueStatus, "pending">,
  reviewerName: string,
  editedJson?: string | null,
  note?: string | null,
): Promise<{ ok: boolean; message: string }> {
  const gtm = getGtmClient();
  const item = await gtm.getQueueItem(id);
  if (!item) return { ok: false, message: "Queue item not found." };
  if (!memberByName(reviewerName)) return { ok: false, message: "Pick a named reviewer." };
  if (item.status !== "pending") return { ok: false, message: `Already ${item.status} by ${item.reviewerName}.` };

  let editedOutput: unknown = undefined;
  let ratio: number | null = null;
  if (decision === "edited") {
    try {
      editedOutput = JSON.parse(editedJson ?? "");
    } catch {
      return { ok: false, message: "Edited output is not valid JSON." };
    }
    ratio = editRatio(JSON.stringify(item.output), JSON.stringify(editedOutput));
  }
  const reviewed = await gtm.reviewQueueItem(id, { status: decision, reviewerName, editedOutput, editRatio: ratio, reviewNote: note ?? null });
  await applyApprovalSideEffects(reviewed.id);
  if (item.accountId) {
    await gtm.appendContext(item.accountId, `${reviewerName} ${decision} "${item.title}"${ratio != null ? ` (edit ratio ${ratio})` : ""}${note ? `: ${note}` : ""}`);
  }
  revalidateGtm(item.accountId);
  return { ok: true, message: `Marked ${decision} by ${reviewerName}.` };
}

/**
 * What an approval changes in the CRM. Kept deliberately small: stage moves,
 * approved contacts written to the account, and the one DockMaster write
 * (operation code merges) which only happens here, after a CSM approves.
 */
async function applyApprovalSideEffects(queueItemId: string) {
  const gtm = getGtmClient();
  const item = await gtm.getQueueItem(queueItemId);
  if (!item || !item.accountId || item.status === "rejected") return;
  const account = await gtm.getAccount(item.accountId);
  if (!account) return;
  const order: Stage[] = ["target", "contacted", "sandbox", "call", "proposal", "closed_won", "onboarding", "live"];
  const advanceTo = async (stage: Stage) => {
    if (order.indexOf(stage) > order.indexOf(account.stage)) await gtm.updateAccount(account.id, { stage });
  };
  switch (item.kind) {
    case "research": {
      const { research } = effectiveOutput<{ research: Research }>(item);
      await gtm.updateAccount(account.id, { contacts: research.decisionMakers.map((d) => ({ name: d.name, title: d.title, role: d.role, sourceSignalId: d.sourceSignalId })) });
      break;
    }
    case "sandbox":
      await advanceTo("sandbox");
      break;
    case "try_it_lead":
      await advanceTo("sandbox");
      break;
    case "call_notes":
      await advanceTo("call");
      break;
    case "proposal":
      await advanceTo("proposal");
      break;
    case "onboarding_plan": {
      const plan = effectiveOutput<OnboardingOutput>(item);
      const n = await gtm.applyCodeMerges(account.id, plan.merges.map((m) => ({ fromCode: m.fromCode, intoCode: m.intoCode })));
      await gtm.appendContext(account.id, `Onboarding Agent applied ${n} approved code merge(s) to the account's DockMaster (the one agent write)`);
      break;
    }
    default:
      break;
  }
}

/**
 * The human-send rule. A touch goes out only from an approved or edited
 * sequence, only by a named person, and only through the channels the account
 * has consented to. The prototype logs the send; production hands it to the
 * sequencing tool.
 */
export async function sendTouchAction(queueItemId: string, touchIndex: number, approvedBy: string): Promise<{ ok: boolean; message: string }> {
  const gtm = getGtmClient();
  const item = await gtm.getQueueItem(queueItemId);
  if (!item || item.kind !== "sequence" || !item.accountId) return { ok: false, message: "Not a sequence." };
  if (item.status !== "approved" && item.status !== "edited") return { ok: false, message: "Approve the sequence before sending. Agents draft, people click." };
  if (!memberByName(approvedBy)) return { ok: false, message: "A named approver is required." };
  const account = await gtm.getAccount(item.accountId);
  if (!account) return { ok: false, message: "Account not found." };
  if (account.emailOptOut) return { ok: false, message: `${account.name} has opted out. Nothing sent.` };
  const seq = effectiveOutput<SequenceOutput>(item);
  const touch = seq.touches[touchIndex];
  if (!touch) return { ok: false, message: "No such touch." };
  if (item.sentTouches.includes(touchIndex)) return { ok: false, message: `Touch ${touchIndex + 1} was already sent.` };
  if (touch.channel === "call") return { ok: false, message: "Call scripts are not sent; the AE makes the call. Logged as a task instead." };

  await gtm.recordOutbound({ accountId: account.id, queueItemId: item.id, touchIndex, channel: touch.channel, subject: touch.subject ?? null, body: touch.body, approvedBy });
  await gtm.updateAccount(account.id, { stage: account.stage === "target" ? "contacted" : account.stage });
  await gtm.appendContext(account.id, `${approvedBy} sent touch ${touchIndex + 1} (${touch.channel}) from the approved sequence`);
  revalidateGtm(account.id);
  return { ok: true, message: `Touch ${touchIndex + 1} logged as sent by ${approvedBy} (prototype does not send).` };
}

/** Consent first: recorded by a human, dated on the demo day. */
export async function setConsentAction(accountId: string, granted: boolean, by: string): Promise<{ ok: boolean; message: string }> {
  const gtm = getGtmClient();
  await gtm.updateAccount(accountId, { dataConsent: granted, consentGrantedAt: granted ? DEMO_TODAY : null });
  await gtm.appendContext(accountId, granted ? `Data consent recorded by ${by}: the Scout may use the account's own DockMaster data` : `Data consent withdrawn by ${by}`);
  revalidateGtm(accountId);
  return { ok: true, message: granted ? "Consent recorded. Re-run the Scout to use the account's own data." : "Consent withdrawn." };
}

export async function setStageAction(accountId: string, stage: Stage, by: string): Promise<{ ok: boolean }> {
  const gtm = getGtmClient();
  await gtm.updateAccount(accountId, { stage });
  await gtm.appendContext(accountId, `${by} moved the account to ${stage.replace("_", " ")}`);
  revalidateGtm(accountId);
  return { ok: true };
}

/** Scores every account that has not been scored on the demo day. Deterministic, no model. */
export async function scoreAllAccountsAction(): Promise<{ ok: boolean; message: string }> {
  const ctx = createAgentContext();
  const accounts = await ctx.gtm.listAccounts();
  let n = 0;
  for (const a of accounts) {
    try {
      await runAgent(ctx, "opportunity_scout", { accountId: a.id });
      n++;
    } catch {
      // recorded on the run
    }
  }
  revalidateGtm(null);
  return { ok: true, message: `Scored ${n} accounts. Reports are on the queue for the Head of Sales.` };
}

function revalidateGtm(accountId: string | null) {
  revalidatePath("/gtm");
  revalidatePath("/gtm/accounts");
  revalidatePath("/gtm/queue");
  revalidatePath("/gtm/metrics");
  revalidatePath("/gtm/agents");
  if (accountId) revalidatePath(`/gtm/accounts/${accountId}`);
}
