/**
 * Sequencer: drafts a three-touch outreach sequence personalised with the
 * account's own numbers (from the Scout) and triggers (from the Researcher).
 * Strongest model. The draft is linted against the brand voice and the truth
 * in numbers rule before it reaches the SDR or AE, who approves each send.
 * Compliance: emails carry the opt-out line, SMS is never drafted without an
 * opt-in, and no touch is ever sent by the agent.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import { BRAND_VOICE, ONE_LINER, OPT_OUT_LINE } from "../brand-voice";
import { SequenceSchema, type Sequence, type Touch } from "../schemas";
import { lintCopy, type LintIssue } from "../style-lint";
import { TEAM } from "../team";
import type { Account, SourceQuery } from "../types";
import { latestResearch, latestScout } from "./crm-reads";
import { AgentBlockedError, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `${BRAND_VOICE}

You draft a three-touch outreach sequence for one account. Touch one is an email from the named sender with the account's own numbers and a link to a sandbox seeded with their world. Touch two, a few days later, is a short email or LinkedIn note that adds one new fact (a trigger) and repeats the ask. Touch three is a call script. Each touch has one ask: open the sandbox and paste a real tech note, or book a 20 minute call.

Use only the figures listed under "figures". Quote them exactly as given. If a figure is zero or missing, do not mention it. Do not add an unsubscribe line; it is appended for you. One-line description of the product if you need it: ${ONE_LINER}`;

export interface SequencerInput {
  accountId: string;
}

export interface TouchDraft extends Touch {
  lint: LintIssue[];
}

export interface SequenceOutput {
  sender: { name: string; title: string };
  sandboxUrl: string;
  tone: string;
  touches: TouchDraft[];
  smsEligible: boolean;
  figuresUsed: SourceQuery[];
}

function senderFor(account: Account): { name: string; title: string } {
  const owner = account.ownerName ? TEAM.find((t) => t.name === account.ownerName) : undefined;
  if (owner) return { name: owner.name, title: owner.title };
  const fallback = account.segment === "install_base" ? TEAM.find((t) => t.role === "CSM")! : TEAM.find((t) => t.name === "Casey Morgan")!;
  return { name: fallback.name, title: fallback.title };
}

/** Caps include the appended opt-out line on emails. */
const MAX_WORDS: Record<Touch["channel"], number> = { email: 190, linkedin: 80, call: 280 };

function lintTouch(t: Touch, figures: SourceQuery[]): LintIssue[] {
  return lintCopy(`${t.subject ?? ""}\n${t.body}`, {
    figures,
    maxWords: MAX_WORDS[t.channel],
    requireOptOut: t.channel === "email",
    channel: t.channel,
  }).issues;
}

export const sequencer: AgentDefinition<SequencerInput, SequenceOutput> = {
  key: "sequencer",
  name: "Sequencer",
  job: "Draft multi-touch outreach personalised with the account's numbers",
  inputs: "Scout and Researcher output, brand voice guide, past replies",
  output: "Email, LinkedIn and call scripts, tone by segment",
  owner: "SDR",
  modelTier: "strong",
  needsAccount: true,
  async run(ctx, _input, account): Promise<AgentResult<SequenceOutput>> {
    const ai = requireAi(ctx);
    const acct = account!;
    if (acct.emailOptOut) throw new AgentBlockedError(`${acct.name} has opted out of email. No sequence drafted.`);
    const scout = await latestScout(ctx.gtm, acct.id);
    if (!scout) throw new AgentBlockedError("Run the Opportunity Scout first so the sequence can use the account's own numbers.");
    const research = await latestResearch(ctx.gtm, acct.id);
    const sender = senderFor(acct);
    const sandboxUrl = `/try?account=${acct.id}`;
    const figures = scout.report.figures.filter((f) => f.value > 0);
    const notes: string[] = [];
    if (!research) notes.push("No Researcher output yet: sequence drafted without triggers.");
    if (!acct.dataConsent) notes.push("No data consent: the Scout figures are public-signal estimates and the sequence must say so.");

    const segmentGuide =
      acct.segment === "install_base"
        ? "Existing DockMaster customer. Warm, CSM voice: we already work together, here is what your own data says."
        : acct.segment === "group"
          ? "Multi-site group. Operating-partner voice: standardisation plus recovered revenue per site."
          : "New logo on another platform. Specific and brief, AE voice, lead with the free tool: paste a tech note, get an estimate.";

    const ask = async (feedback?: LintIssue[]) =>
      ai.call({
        name: "draft_sequence",
        description: "Draft a three-touch outreach sequence.",
        system: SYSTEM,
        model: MODEL_STRONG,
        maxTokens: 3000,
        schema: SequenceSchema,
        user: JSON.stringify(
          {
            segmentGuide,
            sender,
            account: { name: acct.name, city: acct.city, state: acct.state, platform: acct.platform, products: acct.products },
            figures: figures.map((f) => ({ label: f.label, value: f.value, unit: f.unit, assumption: f.assumption ?? null })),
            pitchSentence: scout.report.pitchSentence,
            recommendedTier: scout.report.fit.recommendedTier,
            triggers: research?.research.triggers.map((t) => ({ type: t.type, summary: t.summary })) ?? [],
            decisionMakers: research?.research.decisionMakers.map((d) => ({ name: d.name, title: d.title })) ?? [],
            sandboxUrl,
            previousAttemptIssues: feedback?.map((i) => i.message) ?? null,
          },
          null,
          2,
        ),
      });

    const steps: AgentResult<SequenceOutput>["steps"] = [];
    let seq: Sequence;
    let first = await ask();
    steps.push({ step: "draft_sequence", latencyMs: first.latencyMs, model: first.model });
    seq = first.output;
    let touches = finalise(seq.touches);
    let issues = touches.flatMap((t) => lintTouch(t, figures));

    // One retry with the lint feedback, then the reviewer sees what is left.
    if (issues.length > 0) {
      first = await ask(issues);
      steps.push({ step: "redraft_after_lint", latencyMs: first.latencyMs, model: first.model });
      seq = first.output;
      touches = finalise(seq.touches);
      issues = touches.flatMap((t) => lintTouch(t, figures));
      if (issues.length > 0) notes.push(`Style lint still flags ${issues.length} issue(s) after one redraft; review before sending.`);
    }

    const drafts: TouchDraft[] = touches.map((t) => ({ ...t, lint: lintTouch(t, figures) }));
    if (!acct.smsOptIn) notes.push("SMS not drafted: no SMS opt-in on the account (TCPA).");

    return {
      output: { sender, sandboxUrl, tone: seq.tone, touches: drafts, smsEligible: acct.smsOptIn, figuresUsed: figures },
      sourceQueries: figures,
      steps,
      queue: {
        kind: "sequence",
        title: `Sequence: ${acct.name} (${drafts.length} touches)`,
        sourceData: { scoutQueueItemId: scout.item.id, researchQueueItemId: research?.item.id ?? null, figures },
        approverRole: acct.segment === "install_base" ? "AE" : "SDR",
      },
      contextLine: `Sequencer drafted ${drafts.length} touches from ${sender.name}; ${issues.length} lint issue(s) outstanding`,
      notes,
    };
  },
};

function finalise(touches: Touch[]): Touch[] {
  return touches.map((t) => (t.channel === "email" ? { ...t, body: `${t.body.trim()}\n\n${OPT_OUT_LINE}` } : t));
}
