import { NextRequest } from "next/server";
import { AgentRunError, createAgentContext, runAgent } from "@/lib/gtm/runner";
import type { TryItInput, TryItResult } from "@/lib/gtm/agents/try-it-concierge";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The free "Estimate from a tech note" tool. POST { transcript, accountId?, lead? }.
 * Runs the Try-It Concierge, which drafts through the product pipeline against
 * the public sample yard and, when the visitor leaves details, creates the
 * lead and a queue item for Marketing.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as TryItInput;
  if (!body.transcript?.trim()) return Response.json({ error: "Paste a technician note first." }, { status: 400 });
  try {
    const outcome = await runAgent<Record<string, unknown>, TryItResult>(createAgentContext(), "try_it_concierge", {
      transcript: body.transcript,
      accountId: body.accountId ?? null,
      lead: body.lead ?? null,
    });
    return Response.json({ ...outcome.result.output, runId: outcome.run.id, queueItemId: outcome.queueItem?.id ?? null });
  } catch (err) {
    if (err instanceof AgentRunError) return Response.json({ error: err.message, blocked: err.blocked }, { status: err.blocked ? 422 : 502 });
    console.error("[try]", err);
    return Response.json({ error: "Could not draft the estimate. Nothing was saved." }, { status: 502 });
  }
}
