/**
 * Conference Concierge: maximises the October user conference (Oct 19 to 23).
 * Ranks registered accounts by Scout score, books each into an Open Lab slot
 * with its own sandbox waiting, and has the strongest model write per-attendee
 * talking points from that account's figures. Consent asks are flagged for
 * accounts that have not opted in.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import { BRAND_VOICE } from "../brand-voice";
import { TalkingPointsSchema } from "../schemas";
import { lintCopy } from "../style-lint";
import type { Account, SourceQuery } from "../types";
import { requireAi, type AgentDefinition, type AgentResult } from "./framework";
import { scoutAccount, type ScoutReport } from "./opportunity-scout";

const SYSTEM = `${BRAND_VOICE}

You prepare talking points for a 30 minute Open Lab meeting at a user conference, one set per attending account. Each point is one sentence an account manager can say. Use the account's figures exactly as given; for accounts without consent, ask for consent first and do not quote figures.`;

export const CONFERENCE = {
  name: "DockMaster User Conference",
  dates: "Oct 19 to 23, 2026",
  sessions: [
    { day: "Tue Oct 20", time: "10:00", title: "Service and Inventory: the Service Writer" },
    { day: "Wed Oct 21", time: "11:00", title: "AI at DockMaster: Scheduling, Blu and the Service Writer" },
    { day: "Thu Oct 22", time: "09:00", title: "2027 roadmap dot-vote" },
  ],
  openLab: { days: ["Tue Oct 20", "Wed Oct 21", "Thu Oct 22"], start: 14, end: 17, slotMinutes: 30 },
};

export function openLabSlots(): string[] {
  const out: string[] = [];
  for (const day of CONFERENCE.openLab.days) {
    for (let h = CONFERENCE.openLab.start; h < CONFERENCE.openLab.end; h++) {
      for (const m of [0, 30]) out.push(`${day} ${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
    }
  }
  return out;
}

export interface ConferencePlanRow {
  accountId: string;
  name: string;
  attendees: { name: string; title: string }[];
  score: number;
  totalAnnualUsd: number;
  consent: boolean;
  slot: string;
  sandboxUrl: string;
  talkingPoints: string[];
  askForConsent: boolean;
}

export interface ConferencePlan {
  conference: typeof CONFERENCE;
  registered: number;
  rows: ConferencePlanRow[];
  sameDayFollowUp: string;
}

export const conferenceConcierge: AgentDefinition<Record<string, never>, ConferencePlan> = {
  key: "conference_concierge",
  name: "Conference Concierge",
  job: "Maximise the October user conference",
  inputs: "Registrant list, Scout scores, session schedule",
  output: "Pre-booked meetings, per-attendee agenda and talking points, same-day follow-ups",
  owner: "Events lead",
  modelTier: "strong",
  needsAccount: false,
  async run(ctx): Promise<AgentResult<ConferencePlan>> {
    const ai = requireAi(ctx);
    const t0 = Date.now();
    const accounts = (await ctx.gtm.listAccounts()).filter((a: Account) => a.conferenceAttendees.length > 0);
    const reports = new Map<string, ScoutReport>();
    for (const a of accounts) reports.set(a.id, await scoutAccount(ctx, a));
    const ranked = [...accounts].sort((a, b) => reports.get(b.id)!.score - reports.get(a.id)!.score);
    const slots = openLabSlots();
    const prep = Date.now() - t0;

    const { output, latencyMs, model } = await ai.call({
      name: "write_talking_points",
      description: "Write talking points per attending account.",
      system: SYSTEM,
      model: MODEL_STRONG,
      maxTokens: 4000,
      schema: TalkingPointsSchema,
      user: JSON.stringify(
        {
          accounts: ranked.map((a) => {
            const r = reports.get(a.id)!;
            return {
              accountId: a.id,
              name: a.name,
              segment: a.segment,
              platform: a.platform,
              consent: a.dataConsent,
              attendees: a.conferenceAttendees,
              figures: a.dataConsent ? r.figures.filter((f) => f.value > 0).map((f) => ({ label: f.label, value: f.value, unit: f.unit })) : [],
              recommendedTier: r.fit.recommendedTier,
            };
          }),
        },
        null,
        2,
      ),
    });

    const notes: string[] = [];
    const byId = new Map(output.attendees.map((x) => [x.accountId, x]));
    const allFigures: SourceQuery[] = ranked.flatMap((a) => reports.get(a.id)!.figures);
    const rows: ConferencePlanRow[] = ranked.map((a, i) => {
      const r = reports.get(a.id)!;
      const tp = byId.get(a.id);
      if (!tp) notes.push(`No talking points returned for ${a.name}.`);
      const points = tp?.talkingPoints ?? [];
      const lint = lintCopy(points.join("\n"), { figures: allFigures });
      if (!lint.ok) notes.push(...lint.issues.map((x) => `${a.name}: ${x.message}`));
      return {
        accountId: a.id,
        name: a.name,
        attendees: a.conferenceAttendees,
        score: r.score,
        totalAnnualUsd: r.totalAnnualUsd,
        consent: a.dataConsent,
        slot: slots[i] ?? "waitlist",
        sandboxUrl: `/try?account=${a.id}`,
        talkingPoints: points,
        askForConsent: tp?.askForConsent ?? !a.dataConsent,
      };
    });

    const plan: ConferencePlan = {
      conference: CONFERENCE,
      registered: accounts.length,
      rows,
      sameDayFollowUp: "Same day, from the CSM: thanks for the Open Lab session, here is your sandbox link and the one number we discussed. Nothing sends without a named approver.",
    };

    return {
      output: plan,
      sourceQueries: allFigures,
      steps: [
        { step: "rank_and_book", latencyMs: prep },
        { step: "write_talking_points", latencyMs, model },
      ],
      queue: { kind: "conference_plan", title: `Conference plan: ${rows.length} accounts booked into Open Lab`, sourceData: { slots: slots.length, registered: accounts.map((a) => a.name) } },
      contextLine: `Conference Concierge booked ${rows.length} accounts into Open Lab slots`,
      notes,
    };
  },
};
