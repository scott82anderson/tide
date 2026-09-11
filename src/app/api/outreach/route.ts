import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { AiCallError, AiUnavailableError, getAi } from "@/lib/ai/anthropic";
import { draftOutreach } from "@/lib/ai/outreach";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST { vesselId, code } -> drafts a proactive estimate plus SMS and email. */
export async function POST(req: NextRequest) {
  const { vesselId, code } = (await req.json()) as { vesselId: string; code: string };
  const client = getDockMasterClient();
  const item = (await client.listVesselsDueForService()).find(
    (d) => d.vessel.id === vesselId && d.operation.code === code,
  );
  if (!item) return Response.json({ error: "That vessel is not on the due list." }, { status: 404 });

  try {
    const { estimate, message } = await draftOutreach(client, getAi(), item);
    revalidatePath("/");
    return Response.json({
      estimateId: estimate.id,
      estimateNumber: estimate.number,
      total: estimate.totals.total,
      requiresManagerApproval: estimate.requiresManagerApproval,
      customerSummary: estimate.customerSummary,
      message,
      customer: { name: item.vessel.customer.name, email: item.vessel.customer.email, phone: item.vessel.customer.phone },
    });
  } catch (err) {
    const message = err instanceof AiUnavailableError || err instanceof AiCallError ? err.message : "Could not draft outreach.";
    console.error("[outreach]", err);
    return Response.json({ error: message }, { status: 502 });
  }
}
