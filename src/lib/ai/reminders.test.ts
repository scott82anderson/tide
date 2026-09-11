import { describe, expect, it } from "vitest";
import { FakeStructuredCaller } from "./anthropic";
import { draftReminder, toneFor } from "./reminders";
import { marina } from "@/test/fake-client";
import type { DockMasterClient } from "@/lib/dockmaster/client";
import type { OverdueInvoice } from "@/lib/dockmaster/types";

describe("toneFor", () => {
  it("escalates by age", () => {
    expect(toneFor(9)).toBe("friendly");
    expect(toneFor(29)).toBe("friendly");
    expect(toneFor(30)).toBe("firm");
    expect(toneFor(60)).toBe("firm");
    expect(toneFor(61)).toBe("final");
  });
});

describe("draftReminder", () => {
  it("substitutes the ValPay link the client created and logs the action", async () => {
    const logged: unknown[] = [];
    const client = {
      getMarina: async () => marina,
      createPaymentLink: async (invoiceId: string) => ({
        url: "https://pay.example/valpay/tok123",
        token: "tok123",
        invoiceId,
        amount: 1240,
      }),
      logActivity: async (a: unknown) => {
        logged.push(a);
        return a;
      },
    } as unknown as DockMasterClient;

    const invoice: OverdueInvoice = {
      id: "INV-2026-0301",
      number: "INV-2026-0301",
      customerId: "cus_x",
      customer: { id: "cus_x", name: "Pat Lee", email: "p@example.com", phone: "1", portalEnabled: true, arBalance: 1240 },
      workOrderId: null,
      workOrderNumber: "WO-2026-0007",
      amount: 1240,
      issuedAt: new Date("2026-07-01T00:00:00Z"),
      dueAt: new Date("2026-07-31T00:00:00Z"),
      paidAt: null,
      description: "Bottom paint",
      daysOverdue: 45,
      ageBucket: "firm",
    };

    const ai = new FakeStructuredCaller({
      write_payment_reminder: [
        { subject: "Invoice INV-2026-0301 is past due", body: "Hi Pat, pay here: {{PAYMENT_LINK}}", sms: "Harbourline: {{PAYMENT_LINK}}" },
      ],
    });

    const out = await draftReminder(client, ai, invoice);
    expect(out.tone).toBe("firm");
    expect(out.message.body).toContain("https://pay.example/valpay/tok123");
    expect(out.message.body).not.toContain("{{PAYMENT_LINK}}");
    expect(out.message.sms).toContain("https://pay.example/valpay/tok123");
    expect(logged).toHaveLength(1);
  });
});
