/**
 * Payment reminders for overdue invoices. Tone escalates with age. The ValPay
 * link is created through the DockMasterClient and substituted into the text
 * after generation, so the model never sees or invents a URL.
 */

import type { DockMasterClient } from "@/lib/dockmaster/client";
import type { OverdueInvoice, PaymentLink } from "@/lib/dockmaster/types";
import { formatDate } from "@/lib/demo-date";
import type { StructuredCaller } from "./anthropic";
import { ReminderSchema, type Reminder } from "./schemas";

export type ReminderTone = OverdueInvoice["ageBucket"];

export function toneFor(daysOverdue: number): ReminderTone {
  if (daysOverdue < 30) return "friendly";
  if (daysOverdue <= 60) return "firm";
  return "final";
}

const TONE_GUIDE: Record<ReminderTone, string> = {
  friendly:
    "Friendly and light. Assume it slipped their mind. One short paragraph, thank them for their business, make paying easy.",
  firm: "Polite but firm. State the amount and how many days past due. Ask for payment within 7 days or a call to arrange terms.",
  final:
    "Final notice. Courteous, no threats, but clear: the account is seriously past due, payment is required within 5 days, and the yard will place a hold on further service and slip privileges if not resolved. Offer a direct phone contact.",
};

const SYSTEM = `You write accounts receivable reminders for a marina. Keep them short and human. Use the tone guidance you are given. Never invent amounts, dates, or links: use exactly the figures provided and insert the literal placeholder {{PAYMENT_LINK}} where the payment link belongs (exactly once in the email body and once in the SMS). Sign as the yard's accounts team. No exclamation marks in firm or final tone.`;

export interface ReminderResult {
  tone: ReminderTone;
  message: Reminder;
  link: PaymentLink;
}

export async function draftReminder(
  client: DockMasterClient,
  ai: StructuredCaller,
  invoice: OverdueInvoice,
): Promise<ReminderResult> {
  const marina = await client.getMarina();
  const tone = toneFor(invoice.daysOverdue);
  const link = await client.createPaymentLink(invoice.id);

  const { output, latencyMs } = await ai.call({
    name: "write_payment_reminder",
    description: "Write an email and SMS payment reminder.",
    system: SYSTEM,
    user: JSON.stringify(
      {
        tone,
        toneGuidance: TONE_GUIDE[tone],
        customerName: invoice.customer.name,
        invoiceNumber: invoice.number,
        description: invoice.description,
        amountDue: invoice.amount.toFixed(2),
        dueDate: formatDate(invoice.dueAt),
        daysPastDue: invoice.daysOverdue,
        yard: marina.name,
        phone: "(772) 555-0148",
      },
      null,
      2,
    ),
    schema: ReminderSchema,
    maxTokens: 1024,
  });

  const message: Reminder = {
    subject: output.subject,
    body: output.body.split("{{PAYMENT_LINK}}").join(link.url),
    sms: output.sms.split("{{PAYMENT_LINK}}").join(link.url),
  };
  if (!message.body.includes(link.url)) message.body += `\n\nPay online: ${link.url}`;
  if (!message.sms.includes(link.url)) message.sms = `${message.sms} ${link.url}`.slice(0, 300);

  await client.logActivity({
    actor: "ai",
    action: "reminder.drafted",
    entityType: "invoice",
    entityId: invoice.id,
    payload: { tone, daysOverdue: invoice.daysOverdue, amount: invoice.amount, link: link.url, latencyMs },
  });

  return { tone, message, link };
}
