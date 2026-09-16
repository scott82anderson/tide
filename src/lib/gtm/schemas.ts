/**
 * Zod schemas for every model-backed GTM agent. As in the Service Writer, each
 * model call is one forced tool call that fills in one of these objects; ids
 * the model returns (signals, docs, objections, codes) are validated against
 * the list it was shown.
 */

import { z } from "zod";

// ---------- Account Researcher ----------

export const TriggerType = z.enum([
  "new_manager",
  "expansion",
  "slow_quotes",
  "hiring_technicians",
  "negative_reviews",
  "new_location",
  "conference_registered",
  "platform_change",
  "other",
]);

export const ResearchSchema = z.object({
  serviceDepartmentSize: z.enum(["small", "medium", "large"]).describe("small under 4 technicians, medium 4 to 9, large 10 or more"),
  estimatedTechnicians: z.number().int().nullable().describe("Best estimate from the signals, or null"),
  techStack: z.array(z.string()).describe("Systems the yard appears to use, as named in the signals"),
  decisionMakers: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      role: z.enum(["decision_maker", "champion", "user", "finance"]),
      sourceSignalId: z.string().describe("Id of the signal the person appears in"),
    }),
  ),
  triggers: z.array(
    z.object({
      type: TriggerType,
      summary: z.string().describe("One line, in plain words"),
      evidenceSignalId: z.string().describe("Id of the signal that supports this trigger"),
      strength: z.enum(["weak", "moderate", "strong"]),
    }),
  ),
  summary: z.string().describe("Three sentences an SDR can read before a call"),
});
export type Research = z.infer<typeof ResearchSchema>;

// ---------- Sequencer ----------

export const TouchSchema = z.object({
  day: z.number().int().min(0).describe("Days after the first touch"),
  channel: z.enum(["email", "linkedin", "call"]),
  subject: z.string().nullable().describe("Email subject, null for other channels"),
  body: z.string().describe("Email body under 140 words, LinkedIn note under 60 words, or a call script under 200 words"),
  goal: z.string().describe("What this touch is trying to get, one line"),
});

export const SequenceSchema = z.object({
  tone: z.string().describe("One line describing the tone chosen for this segment"),
  touches: z.array(TouchSchema).min(3).max(3),
});
export type Sequence = z.infer<typeof SequenceSchema>;
export type Touch = z.infer<typeof TouchSchema>;

// ---------- Demo Builder ----------

export const WalkthroughSchema = z.object({
  title: z.string(),
  sampleTechNote: z
    .string()
    .describe("A realistic 60 to 90 word technician voice note about one of the prospect's vessel types, informal, mentioning a slip and a hull number ending"),
  scenes: z
    .array(
      z.object({
        seconds: z.number().int().min(5).max(40),
        onScreen: z.string().describe("What the viewer sees"),
        narration: z.string().describe("What the narrator says, using the account's own numbers where given"),
      }),
    )
    .min(4)
    .max(6),
});
export type Walkthrough = z.infer<typeof WalkthroughSchema>;

// ---------- Sales Engineer ----------

export const RfpAnswersSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string().describe("Direct answer, under 120 words, no marketing language"),
      citedDocIds: z.array(z.string()).describe("Ids of the knowledge documents the answer relies on"),
      confidence: z.number().min(0).max(1),
      needsHuman: z.boolean().describe("True when the documents do not cover the question"),
      gapNote: z.string().nullable().describe("What a human needs to confirm, when needsHuman is true"),
    }),
  ),
});
export type RfpAnswers = z.infer<typeof RfpAnswersSchema>;

// ---------- Deal Desk ----------

export const ProposalNarrativeSchema = z.object({
  executiveSummary: z.string().describe("Under 120 words, uses only the figures provided"),
  whyNow: z.array(z.string()).min(2).max(4),
  nextSteps: z.array(z.string()).min(2).max(4),
});
export type ProposalNarrative = z.infer<typeof ProposalNarrativeSchema>;

// ---------- Objection Coach ----------

export const CallCoachSchema = z.object({
  detected: z.array(
    z.object({
      quote: z.string().describe("The prospect's words from the transcript"),
      objectionId: z.string().describe("Id from the objection library, or 'none' when it is new"),
      suggestedResponse: z.string().describe("Two to four sentences the AE can say, adapted to this account"),
      proofPoint: z.string().nullable().describe("A specific number or fact from the account data or library, or null"),
    }),
  ),
  followUps: z.array(
    z.object({
      task: z.string(),
      owner: z.enum(["AE", "SDR", "Solutions lead", "CSM"]),
      dueInDays: z.number().int().min(0).max(30),
    }),
  ),
  crmNote: z.string().describe("Three to five sentences for the CRM record"),
});
export type CallCoach = z.infer<typeof CallCoachSchema>;

// ---------- Onboarding Agent ----------

export const OnboardingSchema = z.object({
  merges: z.array(
    z.object({
      fromCode: z.string(),
      intoCode: z.string(),
      reason: z.string(),
    }),
  ),
  keywordMap: z.array(
    z.object({
      code: z.string(),
      keywords: z.array(z.string()).describe("Words a technician would say for this operation"),
    }),
  ),
  kitSuggestions: z.array(
    z.object({
      code: z.string(),
      parts: z.array(z.string()).describe("Part descriptions, not numbers, that a kit for this code would carry"),
    }),
  ),
  migrationChecklist: z.array(z.string()).min(4).max(8),
  trainingPlan: z.array(
    z.object({
      role: z.enum(["technician", "service_writer", "service_manager", "accounts"]),
      sessions: z.array(z.string()),
    }),
  ),
});
export type OnboardingPlan = z.infer<typeof OnboardingSchema>;

// ---------- Proof Agent ----------

export const CaseStudySchema = z.object({
  headline: z.string().describe("Under 12 words, contains one number"),
  summary: z.string().describe("Under 150 words"),
  stats: z
    .array(
      z.object({
        label: z.string(),
        value: z.string().describe("The figure exactly as provided, with unit"),
      }),
    )
    .min(3)
    .max(4),
  quoteDrafts: z.array(
    z.object({
      speaker: z.string(),
      title: z.string(),
      text: z.string().describe("A plausible quote for the customer to edit and sign off, under 40 words"),
    }),
  ),
  slideBullets: z.array(z.string()).min(3).max(5),
});
export type CaseStudy = z.infer<typeof CaseStudySchema>;

// ---------- Voice of Customer ----------

export const VocSchema = z.object({
  themes: z.array(
    z.object({
      theme: z.string(),
      kind: z.enum(["objection", "feature_request", "praise", "bug"]),
      itemIds: z.array(z.string()).describe("Ids of the feedback items in this theme"),
      summary: z.string(),
    }),
  ),
});
export type Voc = z.infer<typeof VocSchema>;

// ---------- Conference Concierge ----------

export const TalkingPointsSchema = z.object({
  attendees: z.array(
    z.object({
      accountId: z.string(),
      talkingPoints: z.array(z.string()).min(2).max(4),
      askForConsent: z.boolean().describe("True when the account has not granted data consent yet"),
    }),
  ),
});
export type TalkingPoints = z.infer<typeof TalkingPointsSchema>;

// ---------- Partner Agent ----------

export const PartnerBriefSchema = z.object({
  brief: z.string().describe("Under 150 words on why this partner should care"),
  whyTheyCare: z.array(z.string()).min(2).max(4),
  coMarketing: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      timing: z.string(),
    }),
  ),
  leadRouting: z.string().describe("One or two sentences on how leads from this partner reach an AE"),
  asks: z.array(z.string()).min(1).max(3),
});
export type PartnerBrief = z.infer<typeof PartnerBriefSchema>;
