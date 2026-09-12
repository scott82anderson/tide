/**
 * Voice of Customer: feeds the roadmap and messaging. The cheaper model groups
 * support tickets, call snippets, dot-votes and reviews into themes; the
 * ranking by revenue at stake is deterministic (sum of the Scout figure for
 * the accounts behind each theme). Item ids are validated against the list.
 */

import { MODEL_CHEAP } from "@/lib/ai/anthropic";
import { VocSchema } from "../schemas";
import type { FeedbackItem } from "../types";
import type { ScoutReport } from "./opportunity-scout";
import { AgentBlockedError, fig, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `You group customer feedback for a marina software product into themes. Each theme is an objection, a feature request, praise or a bug. Aim for five to eight themes: merge items that ask for the same thing in different words, and only leave an item on its own when nothing else resembles it. Put every item into at most one theme, cite item ids, and write a one-line summary per theme in plain words. Do not invent items.`;

export interface VocTheme {
  theme: string;
  kind: "objection" | "feature_request" | "praise" | "bug";
  summary: string;
  count: number;
  itemIds: string[];
  accounts: string[];
  revenueAtStakeUsd: number;
}

export interface VocReport {
  itemsRead: number;
  themes: VocTheme[];
  objectionFrequency: { theme: string; count: number }[];
  requestsByRevenue: { theme: string; revenueAtStakeUsd: number; count: number }[];
}

export const voiceOfCustomer: AgentDefinition<Record<string, never>, VocReport> = {
  key: "voice_of_customer",
  name: "Voice of Customer",
  job: "Feed the roadmap and messaging",
  inputs: "Support tickets, conference dot-votes, reviews, sales call transcripts",
  output: "Theme reports, objection frequency, feature requests ranked by revenue at stake",
  owner: "Product",
  modelTier: "cheap",
  needsAccount: false,
  async run(ctx): Promise<AgentResult<VocReport>> {
    const ai = requireAi(ctx);
    const items: FeedbackItem[] = await ctx.gtm.listFeedback();
    if (items.length === 0) throw new AgentBlockedError("No feedback items to read.");
    const byId = new Map(items.map((i) => [i.id, i]));

    const { output, latencyMs, model } = await ai.call({
      name: "group_feedback",
      description: "Group feedback items into themes.",
      system: SYSTEM,
      model: MODEL_CHEAP,
      maxTokens: 3000,
      schema: VocSchema,
      user: JSON.stringify({ items: items.map((i) => ({ id: i.id, source: i.source, account: i.accountName, text: i.text })) }, null, 2),
    });

    // Revenue at stake: the latest Scout total for every account behind a theme.
    const scoutRuns = await ctx.gtm.listRuns({ agent: "opportunity_scout", limit: 500 });
    const stake = new Map<string, number>();
    for (const r of scoutRuns) {
      if (r.accountId && r.status === "succeeded" && !stake.has(r.accountId)) stake.set(r.accountId, (r.output as ScoutReport).totalAnnualUsd);
    }

    const notes: string[] = [];
    const themes: VocTheme[] = output.themes.map((t) => {
      const ids = t.itemIds.filter((id) => {
        if (byId.has(id)) return true;
        notes.push(`Theme "${t.theme}" cited unknown item ${id}; dropped.`);
        return false;
      });
      const accountIds = [...new Set(ids.map((id) => byId.get(id)!.accountId).filter((a): a is string => Boolean(a)))];
      return {
        theme: t.theme,
        kind: t.kind,
        summary: t.summary,
        count: ids.length,
        itemIds: ids,
        accounts: accountIds.map((a) => items.find((i) => i.accountId === a)?.accountName ?? a),
        revenueAtStakeUsd: accountIds.reduce((s, a) => s + (stake.get(a) ?? 0), 0),
      };
    });
    const covered = new Set(themes.flatMap((t) => t.itemIds));
    const uncovered = items.filter((i) => !covered.has(i.id)).length;
    if (uncovered > 0) notes.push(`${uncovered} item(s) were not placed in any theme.`);

    const report: VocReport = {
      itemsRead: items.length,
      themes: [...themes].sort((a, b) => b.revenueAtStakeUsd - a.revenueAtStakeUsd || b.count - a.count),
      objectionFrequency: themes.filter((t) => t.kind === "objection").sort((a, b) => b.count - a.count).map((t) => ({ theme: t.theme, count: t.count })),
      requestsByRevenue: themes.filter((t) => t.kind === "feature_request").sort((a, b) => b.revenueAtStakeUsd - a.revenueAtStakeUsd).map((t) => ({ theme: t.theme, revenueAtStakeUsd: t.revenueAtStakeUsd, count: t.count })),
    };

    return {
      output: report,
      sourceQueries: report.themes.map((t) => fig(`stake_${t.theme}`, `Revenue at stake: ${t.theme}`, t.revenueAtStakeUsd, "usd", "sum of latest Scout totalAnnualUsd for accounts behind the theme")),
      steps: [{ step: "group_feedback", latencyMs, model }],
      queue: { kind: "voc_report", title: `Voice of Customer: ${items.length} items, ${themes.length} themes`, sourceData: { items: items.map((i) => ({ id: i.id, source: i.source, account: i.accountName })) } },
      contextLine: `Voice of Customer grouped ${items.length} items into ${themes.length} themes`,
      notes,
    };
  },
};
