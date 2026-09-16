/**
 * Packaging and discount policy (GTM doc, section 2). Every number here is an
 * assumption to be sized against Valsoft data; the Deal Desk cannot go outside
 * the policy, anything outside goes to a human.
 */

import type { Tier } from "./types";

export interface TierDef {
  tier: Tier;
  name: string;
  includes: string[];
  perLocationMonthly: number;
  perTechMonthly: number;
  requiresWeb: boolean;
  multiSiteDiscountPct: number;
}

export const TIERS: Record<Tier, TierDef> = {
  service_writer: {
    tier: "service_writer",
    name: "Service Writer",
    includes: ["Drafting from tech notes", "History flags", "eSign handoff"],
    perLocationMonthly: 299,
    perTechMonthly: 95,
    requiresWeb: true,
    multiSiteDiscountPct: 0,
  },
  ai_service_desk: {
    tier: "ai_service_desk",
    name: "AI Service Desk",
    includes: ["Service Writer", "AI Scheduling", "Blu Voice"],
    perLocationMonthly: 649,
    perTechMonthly: 95,
    requiresWeb: true,
    multiSiteDiscountPct: 0,
  },
  revenue_suite: {
    tier: "revenue_suite",
    name: "Revenue Suite",
    includes: ["AI Service Desk", "Due-for-service outreach", "AR collections agent via ValPay"],
    perLocationMonthly: 849,
    perTechMonthly: 95,
    requiresWeb: true,
    multiSiteDiscountPct: 0,
  },
  group: {
    tier: "group",
    name: "Group",
    includes: ["Revenue Suite on every site", "Multi-site benchmarking"],
    perLocationMonthly: 849,
    perTechMonthly: 95,
    requiresWeb: true,
    multiSiteDiscountPct: 10,
  },
};

/** The sizing anchor: one recovered billable hour per technician per week. */
export const RECOVERED_HOURS_PER_TECH_PER_WEEK = 1;
export const BILLING_WEEKS_PER_YEAR = 48;

export const DISCOUNT_POLICY = {
  aeMaxPct: 10,
  financeMaxPct: 20,
} as const;

export type DiscountStatus = "within_policy" | "needs_finance" | "refused";

export function discountStatus(pct: number): DiscountStatus {
  if (pct <= DISCOUNT_POLICY.aeMaxPct) return "within_policy";
  if (pct <= DISCOUNT_POLICY.financeMaxPct) return "needs_finance";
  return "refused";
}

export interface PriceQuote {
  tier: Tier;
  tierName: string;
  locations: number;
  technicians: number;
  perLocationMonthly: number;
  perTechMonthly: number;
  listMonthly: number;
  listAnnual: number;
  discountPct: number;
  discountStatus: DiscountStatus;
  netAnnual: number;
  /** Value of one recovered hour per tech per week at the yard's rate. */
  sizingAnchorAnnual: number;
  priceAsShareOfAnchorPct: number;
}

export function quote(tier: Tier, locations: number, technicians: number, laborRate: number, discountPct = 0): PriceQuote {
  const def = TIERS[tier];
  const listMonthly = def.perLocationMonthly * locations + def.perTechMonthly * technicians;
  const listAnnual = listMonthly * 12;
  const effectiveDiscount = Math.min(discountPct + def.multiSiteDiscountPct, 100);
  const netAnnual = Math.round(listAnnual * (1 - effectiveDiscount / 100));
  const sizingAnchorAnnual = technicians * RECOVERED_HOURS_PER_TECH_PER_WEEK * BILLING_WEEKS_PER_YEAR * laborRate;
  return {
    tier,
    tierName: def.name,
    locations,
    technicians,
    perLocationMonthly: def.perLocationMonthly,
    perTechMonthly: def.perTechMonthly,
    listMonthly,
    listAnnual,
    discountPct,
    discountStatus: discountStatus(discountPct),
    netAnnual,
    sizingAnchorAnnual,
    priceAsShareOfAnchorPct: sizingAnchorAnnual > 0 ? Math.round((netAnnual / sizingAnchorAnnual) * 100) : 0,
  };
}
