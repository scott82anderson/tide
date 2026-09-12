import { describe, expect, it } from "vitest";
import { DISCOUNT_POLICY, discountStatus, quote } from "./pricing";

describe("pricing and discount policy", () => {
  it("prices per location plus per technician and sizes against one recovered hour a week", () => {
    const q = quote("service_writer", 1, 8, 158, 0);
    expect(q.listMonthly).toBe(299 + 8 * 95);
    expect(q.listAnnual).toBe(q.listMonthly * 12);
    expect(q.sizingAnchorAnnual).toBe(8 * 48 * 158);
    expect(q.priceAsShareOfAnchorPct).toBeLessThan(30);
  });

  it("applies the multi-site discount for groups on top of the AE discount", () => {
    const q = quote("group", 3, 18, 152, 5);
    expect(q.netAnnual).toBe(Math.round(q.listAnnual * 0.85));
  });

  it("routes discounts by policy", () => {
    expect(discountStatus(DISCOUNT_POLICY.aeMaxPct)).toBe("within_policy");
    expect(discountStatus(DISCOUNT_POLICY.aeMaxPct + 1)).toBe("needs_finance");
    expect(discountStatus(DISCOUNT_POLICY.financeMaxPct + 1)).toBe("refused");
  });
});
