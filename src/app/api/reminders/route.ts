import { NextRequest } from "next/server";
import { AiCallError, AiUnavailableError, getAi } from "@/lib/ai/anthropic";
import { draftReminder } from "@/lib/ai/reminders";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST { invoiceId } -> drafts a tone-appropriate reminder with a simulated ValPay link. */
export async function POST(req: NextRequest) {
  const { invoiceId } = (await req.json()) as { invoiceId: string };
  const client = getDockMasterClient();
  const invoice = (await client.listOverdueInvoices()).find((i) => i.id === invoiceId);
  if (!invoice) return Response.json({ error: "Invoice is not overdue or not found." }, { status: 404 });

  try {
    const result = await draftReminder(client, getAi(), invoice);
    return Response.json({
      invoiceId,
      invoiceNumber: invoice.number,
      customer: { name: invoice.customer.name, email: invoice.customer.email, phone: invoice.customer.phone },
      amount: invoice.amount,
      daysOverdue: invoice.daysOverdue,
      ...result,
    });
  } catch (err) {
    const message = err instanceof AiUnavailableError || err instanceof AiCallError ? err.message : "Could not draft the reminder.";
    console.error("[reminders]", err);
    return Response.json({ error: message }, { status: 502 });
  }
}
