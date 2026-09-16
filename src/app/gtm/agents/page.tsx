import { Bot, ShieldCheck } from "lucide-react";
import { PartnerRunForm } from "@/components/gtm/desk-forms";
import { RunAgentButton } from "@/components/gtm/run-agent-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODEL_CHEAP, MODEL_STRONG } from "@/lib/ai/anthropic";
import { AGENTS } from "@/lib/gtm/agents/registry";
import { computeWeeklyMetrics } from "@/lib/gtm/metrics";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import { TEAM } from "@/lib/gtm/team";

export const dynamic = "force-dynamic";

const GUARDRAILS = [
  ["Consent first", "The Scout uses an account's own data only after a recorded opt-in. Without it, public signals only and a low-confidence label."],
  ["Human send", "No outbound goes without a named approver. Send buttons refuse until a sequence is approved; call scripts are never sent."],
  ["Compliance", "Emails carry an opt-out line the agent cannot omit. SMS is never drafted without an SMS opt-in. No automated outbound calls."],
  ["Truth in numbers", "Every dollar figure in a pitch links back to the query that produced it, and drafts are linted so they cannot quote a number the agent was not given."],
  ["Discount policy", "Deal Desk refuses discounts above the Finance ceiling and flags anything above the AE limit."],
  ["Brand voice", "One style guide in every prompt, enforced again by a deterministic lint before a human sees the draft."],
  ["Audit", "Every run, including blocked and failed ones, is written to the CRM with inputs, outputs and model."],
  ["Shortlist only", "Signal ids, document ids, objection ids and operation codes the model returns are validated against the list it was shown."],
];

export default async function AgentsPage() {
  const gtm = getGtmClient();
  const [metrics, partners] = await Promise.all([computeWeeklyMetrics(gtm), gtm.listPartners()]);
  const quality = new Map(metrics.agentQuality.map((q) => [q.agent, q]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Bot className="size-5" /> Agent roster
        </h1>
        <p className="text-sm text-muted-foreground">
          Each agent is a Claude-based worker (or a deterministic one) with tools, a defined output and a named human who approves it. Strong model: {MODEL_STRONG}. Cheap model for enrichment and classification: {MODEL_CHEAP}.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {AGENTS.map((a) => {
          const q = quality.get(a.key);
          return (
            <Card key={a.key} className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  {a.name}
                  <Badge variant="outline" className="font-normal">
                    {a.modelTier === "none" ? "deterministic" : `${a.modelTier} model`}
                  </Badge>
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {a.owner}
                  </Badge>
                </CardTitle>
                <CardDescription>{a.job}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 px-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Inputs: </span>
                  {a.inputs}
                </div>
                <div>
                  <span className="text-muted-foreground">Output: </span>
                  {a.output}
                </div>
                {q && (
                  <div className="pt-1 font-mono text-[11px] text-muted-foreground">
                    {q.runs} runs · {q.reviewed} reviewed · edit rate {q.edited ? `${Math.round(q.editRate * 100)}%` : "n/a"} · {q.blocked} blocked
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Agents that run across accounts</CardTitle>
            <CardDescription>Output lands on the review queue like everything else.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="flex flex-wrap gap-2">
              <RunAgentButton agent="voice_of_customer" input={{}} label="Voice of Customer" goToQueue />
              <RunAgentButton agent="conference_concierge" input={{}} label="Conference Concierge" goToQueue />
            </div>
            <PartnerRunForm partners={partners.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))} />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Guardrails
            </CardTitle>
            <CardDescription>Implemented in code, not in prompts alone.</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <ul className="space-y-1.5 text-sm">
              {GUARDRAILS.map(([t, d]) => (
                <li key={t}>
                  <span className="font-medium">{t}. </span>
                  <span className="text-muted-foreground">{d}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">The team that clicks</CardTitle>
          <CardDescription>Small and senior. Agents replace prep work, not judgement.</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((t) => (
              <li key={t.name} className="flex items-baseline gap-2">
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.title}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
