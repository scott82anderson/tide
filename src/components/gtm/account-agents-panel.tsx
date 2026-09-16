"use client";

import { useState } from "react";
import { RunAgentButton } from "@/components/gtm/run-agent-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIER_LABEL } from "@/lib/gtm/labels";
import type { Tier } from "@/lib/gtm/types";

/**
 * The agents that act on one account, in the order a sale runs. Each button
 * runs the agent and lands its output on the review queue.
 */
export function AccountAgentsPanel({
  accountId,
  recommendedTier,
  hasScout,
  hasCodes,
  hasTelemetry,
  aiConfigured,
}: {
  accountId: string;
  recommendedTier: Tier | null;
  hasScout: boolean;
  hasCodes: boolean;
  hasTelemetry: boolean;
  aiConfigured: boolean;
}) {
  const [tier, setTier] = useState<Tier>(recommendedTier ?? "service_writer");
  const [discount, setDiscount] = useState("10");
  const input = { accountId };
  const needsKey = !aiConfigured;

  return (
    <div className="space-y-4 text-sm">
      {needsKey && (
        <p className="rounded-md border border-warning/50 bg-warning-soft p-2 text-xs text-warning-foreground">
          No ANTHROPIC_API_KEY: only the deterministic agents (Scout, Adoption) run. The others will record a blocked run.
        </p>
      )}
      <Row n={1} name="Opportunity Scout" what="Score from the account's own data (no model)">
        <RunAgentButton agent="opportunity_scout" input={input} label="Run Scout" goToQueue />
      </Row>
      <Row n={2} name="Account Researcher" what="Classify public signals into triggers and decision makers (cheap model)">
        <RunAgentButton agent="account_researcher" input={input} label="Run Researcher" goToQueue />
      </Row>
      <Row n={3} name="Sequencer" what="Three touches with the account's numbers, linted before you see them (strong model)">
        <RunAgentButton agent="sequencer" input={input} label="Draft sequence" goToQueue disabled={!hasScout} />
      </Row>
      <Row n={4} name="Demo Builder" what="Sandbox seeded with their world plus a 90 second walkthrough script">
        <RunAgentButton agent="demo_builder" input={input} label="Build sandbox" goToQueue />
      </Row>
      <Row n={5} name="Deal Desk" what="Proposal and ROI from the Scout figures, inside discount policy">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
              <SelectTrigger size="sm" className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIER_LABEL) as Tier[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIER_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Discount %</Label>
            <Input type="number" min={0} max={40} value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-20" />
          </div>
          <RunAgentButton agent="deal_desk" input={{ accountId, tier, discountPct: Number(discount) || 0 }} label="Build proposal" goToQueue disabled={!hasScout} />
        </div>
      </Row>
      <Row n={6} name="Onboarding Agent" what={hasCodes ? "Clean the exported codes, map keywords, plan training" : "Needs the account's exported operation codes"}>
        <RunAgentButton agent="onboarding_agent" input={input} label="Plan onboarding" goToQueue disabled={!hasCodes} />
      </Row>
      <Row n={7} name="Adoption Agent" what={hasTelemetry ? "Health, nudges, expansion triggers from telemetry (no model)" : "Needs product telemetry (beta or live accounts)"}>
        <RunAgentButton agent="adoption_agent" input={input} label="Score health" goToQueue disabled={!hasTelemetry} />
      </Row>
      <Row n={8} name="Proof Agent" what="Case study from before-and-after metrics, with consent">
        <RunAgentButton agent="proof_agent" input={input} label="Draft case study" goToQueue disabled={!hasTelemetry} />
      </Row>
    </div>
  );
}

function Row({ n, name, what, children }: { n: number; name: string; what: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{what}</div>
      </div>
      {children}
    </div>
  );
}
