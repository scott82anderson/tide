/**
 * The agent roster (GTM doc, section 3). Order matches the document.
 */

import type { AgentKey } from "../types";
import { accountResearcher } from "./account-researcher";
import { adoptionAgent } from "./adoption-agent";
import { conferenceConcierge } from "./conference-concierge";
import { dealDesk } from "./deal-desk";
import { demoBuilder } from "./demo-builder";
import type { AgentDefinition } from "./framework";
import { objectionCoach } from "./objection-coach";
import { onboardingAgent } from "./onboarding-agent";
import { opportunityScout } from "./opportunity-scout";
import { partnerAgent } from "./partner-agent";
import { proofAgent } from "./proof-agent";
import { salesEngineer } from "./sales-engineer";
import { sequencer } from "./sequencer";
import { tryItConcierge } from "./try-it-concierge";
import { voiceOfCustomer } from "./voice-of-customer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAgent = AgentDefinition<any, any>;

export const AGENTS: AnyAgent[] = [
  opportunityScout,
  accountResearcher,
  sequencer,
  demoBuilder,
  tryItConcierge,
  salesEngineer,
  dealDesk,
  objectionCoach,
  onboardingAgent,
  adoptionAgent,
  proofAgent,
  voiceOfCustomer,
  conferenceConcierge,
  partnerAgent,
];

export const AGENT_BY_KEY: Record<AgentKey, AnyAgent> = Object.fromEntries(AGENTS.map((a) => [a.key, a])) as Record<AgentKey, AnyAgent>;

export function agentName(key: string): string {
  return AGENT_BY_KEY[key as AgentKey]?.name ?? key;
}
