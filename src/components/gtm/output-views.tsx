/**
 * One renderer per queue item kind. All pure so they can be used from server
 * pages and from client forms (the desk, the Try-It page).
 */

import { AlertTriangle, CheckCircle2, Mail, MessageSquare, Phone, Sparkles } from "lucide-react";
import { ScoutReportView } from "@/components/gtm/scout-report-view";
import { FiguresTable } from "@/components/gtm/figures-table";
import { Badge } from "@/components/ui/badge";
import type { HealthReport } from "@/lib/gtm/agents/adoption-agent";
import type { ConferencePlan } from "@/lib/gtm/agents/conference-concierge";
import type { Proposal } from "@/lib/gtm/agents/deal-desk";
import type { SandboxSpec } from "@/lib/gtm/agents/demo-builder";
import type { CoachOutput } from "@/lib/gtm/agents/objection-coach";
import type { OnboardingOutput } from "@/lib/gtm/agents/onboarding-agent";
import type { ScoutReport } from "@/lib/gtm/agents/opportunity-scout";
import type { PartnerOutput } from "@/lib/gtm/agents/partner-agent";
import type { ProofOutput } from "@/lib/gtm/agents/proof-agent";
import type { SalesEngineerOutput } from "@/lib/gtm/agents/sales-engineer";
import type { SequenceOutput } from "@/lib/gtm/agents/sequencer";
import type { TryItResult } from "@/lib/gtm/agents/try-it-concierge";
import type { VocReport } from "@/lib/gtm/agents/voice-of-customer";
import type { Research } from "@/lib/gtm/schemas";
import { TIER_LABEL, TONE_CLASS, usd } from "@/lib/gtm/labels";
import type { QueueKind } from "@/lib/gtm/types";
import { cn, formatMoney } from "@/lib/utils";

export function OutputView({ kind, output }: { kind: QueueKind; output: unknown }) {
  if (output == null) return <p className="text-sm text-muted-foreground">No output.</p>;
  switch (kind) {
    case "scout_report":
      return <ScoutReportView report={output as ScoutReport} />;
    case "research":
      return <ResearchView research={(output as { research: Research }).research} />;
    case "sequence":
      return <SequenceView seq={output as SequenceOutput} />;
    case "sandbox":
      return <SandboxView spec={output as SandboxSpec} />;
    case "try_it_lead":
      return <TryItView result={output as TryItResult} />;
    case "rfp_answer":
      return <RfpView out={output as SalesEngineerOutput} />;
    case "proposal":
      return <ProposalView p={output as Proposal} />;
    case "call_notes":
      return <CallNotesView out={output as CoachOutput} />;
    case "onboarding_plan":
      return <OnboardingView plan={output as OnboardingOutput} />;
    case "health_report":
      return <HealthView r={output as HealthReport} />;
    case "case_study":
      return <CaseStudyView cs={output as ProofOutput} />;
    case "voc_report":
      return <VocView r={output as VocReport} />;
    case "conference_plan":
      return <ConferenceView plan={output as ConferencePlan} />;
    case "partner_brief":
      return <PartnerBriefView b={output as PartnerOutput} />;
    default:
      return <JsonView value={output} />;
  }
}

export function JsonView({ value }: { value: unknown }) {
  return <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-[11px] leading-snug">{JSON.stringify(value, null, 2)}</pre>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-sm font-medium">{title}</h4>
      {children}
    </section>
  );
}

const STRENGTH: Record<string, string> = { strong: TONE_CLASS.success, moderate: TONE_CLASS.warning, weak: TONE_CLASS.neutral };

export function ResearchView({ research }: { research: Research }) {
  return (
    <div className="space-y-4 text-sm">
      <p>{research.summary}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">Service department: {research.serviceDepartmentSize}</Badge>
        {research.estimatedTechnicians != null && <Badge variant="outline">{research.estimatedTechnicians} technicians (est.)</Badge>}
        {research.techStack.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
      <Section title={`Triggers (${research.triggers.length})`}>
        <ul className="space-y-1.5">
          {research.triggers.map((t, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <Badge variant="outline" className={cn("capitalize", STRENGTH[t.strength])}>
                {t.type.replace(/_/g, " ")}
              </Badge>
              <span>{t.summary}</span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{t.evidenceSignalId}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Decision makers (${research.decisionMakers.length})`}>
        <ul className="space-y-1">
          {research.decisionMakers.map((d, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{d.name}</span>
              <span className="text-muted-foreground">{d.title}</span>
              <Badge variant="secondary" className="capitalize">
                {d.role.replace("_", " ")}
              </Badge>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{d.sourceSignalId}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

const CHANNEL_ICON = { email: Mail, linkedin: MessageSquare, call: Phone } as const;

export function SequenceView({ seq, sentTouches = [], actions }: { seq: SequenceOutput; sentTouches?: number[]; actions?: (touchIndex: number) => React.ReactNode }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          From {seq.sender.name}, {seq.sender.title}
        </span>
        <span aria-hidden>·</span>
        <span>{seq.tone}</span>
        <span aria-hidden>·</span>
        <span>Sandbox {seq.sandboxUrl}</span>
        {!seq.smsEligible && <Badge variant="outline">No SMS: no opt-in</Badge>}
      </div>
      {seq.touches.map((t, i) => {
        const Icon = CHANNEL_ICON[t.channel] ?? Mail;
        const sent = sentTouches.includes(i);
        return (
          <div key={i} className={cn("rounded-md border", sent && "border-success/40")}>
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <Icon className="size-4" />
              <span className="font-medium">
                Touch {i + 1}: {t.channel}, day {t.day}
              </span>
              <span className="text-xs text-muted-foreground">{t.goal}</span>
              {t.lint.length > 0 && (
                <Badge variant="outline" className={TONE_CLASS.warning}>
                  {t.lint.length} lint
                </Badge>
              )}
              {sent && (
                <Badge variant="outline" className={TONE_CLASS.success}>
                  <CheckCircle2 className="size-3" /> sent
                </Badge>
              )}
              <span className="ml-auto">{actions?.(i)}</span>
            </div>
            <div className="space-y-2 p-3">
              {t.subject && <div className="font-medium">{t.subject}</div>}
              <p className="whitespace-pre-wrap">{t.body}</p>
              {t.lint.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-warning-foreground">
                  {t.lint.map((l, j) => (
                    <li key={j}>{l.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
      <details className="rounded-md border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Figures the sequence may quote ({seq.figuresUsed.length})</summary>
        <div className="border-t p-2">
          <FiguresTable figures={seq.figuresUsed} compact />
        </div>
      </details>
    </div>
  );
}

export function SandboxView({ spec }: { spec: SandboxSpec }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{spec.seededFrom === "account_codes" ? "Seeded from the account's codes" : "Public sample catalogue"}</Badge>
        <Badge variant="outline">{spec.catalogue.length} codes</Badge>
        <Badge variant="outline">{spec.totalSeconds}s walkthrough</Badge>
        <a href={spec.sandboxUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
          Open sandbox {spec.sandboxUrl}
        </a>
      </div>
      <Section title={spec.walkthrough.title}>
        <ol className="space-y-2">
          {spec.walkthrough.scenes.map((s, i) => (
            <li key={i} className="grid gap-1 rounded-md border p-2 md:grid-cols-[60px_1fr_1fr]">
              <span className="font-mono text-xs text-muted-foreground">{s.seconds}s</span>
              <span className="text-xs text-muted-foreground">{s.onScreen}</span>
              <span>{s.narration}</span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Sample technician note for their world">
        <p className="rounded-md border bg-muted/40 p-3 font-mono text-xs">{spec.walkthrough.sampleTechNote}</p>
      </Section>
      <Section title="Catalogue in the sandbox">
        <div className="flex flex-wrap gap-1">
          {spec.catalogue.map((c) => (
            <Badge key={c.code} variant="outline" className="font-normal">
              <span className="font-mono">{c.code}</span> {c.description}
            </Badge>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function TryItView({ result }: { result: TryItResult }) {
  const ops = result.lines.filter((l) => l.kind !== "part");
  return (
    <div className="space-y-4 text-sm">
      {result.lead && (
        <div className="rounded-md border bg-muted/40 p-3">
          <div className="font-medium">
            {result.lead.name}, {result.lead.yardName}
          </div>
          <div className="text-xs text-muted-foreground">
            {result.lead.email} · currently on {result.lead.platform}
          </div>
        </div>
      )}
      <Section title="What they pasted">
        <p className="rounded-md border p-3 font-mono text-xs">{result.transcript}</p>
      </Section>
      <Section title="What the Service Writer drafted">
        {result.vessel ? (
          <p>
            Matched <span className="font-medium">{result.vessel.name}</span> ({result.vessel.detail}) at {Math.round(result.vessel.confidence * 100)}%.
          </p>
        ) : (
          <p className="text-muted-foreground">No vessel in the sample yard matched; the findings were still extracted.</p>
        )}
        <ul className="divide-y rounded-md border">
          {ops.map((l, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-1.5">
              <span className="font-mono text-xs">{l.code ?? "unmapped"}</span>
              <span>{l.description}</span>
              <span className="ml-auto text-xs text-muted-foreground">{l.hours != null ? `${l.hours} h` : ""}</span>
              <span className="font-mono text-xs tabular-nums">{formatMoney(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="text-right font-medium">Total {formatMoney(result.total)}</div>
      </Section>
      <p className="rounded-md border border-ai/40 bg-ai-soft p-3">{result.nextStep}</p>
    </div>
  );
}

export function RfpView({ out }: { out: SalesEngineerOutput }) {
  return (
    <div className="space-y-3 text-sm">
      {out.answers.map((a, i) => (
        <div key={i} className={cn("rounded-md border p-3", a.needsHuman && "border-warning/50 bg-warning-soft/40")}>
          <div className="font-medium">{a.question}</div>
          <p className="mt-1 whitespace-pre-wrap">{a.answer}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
            {a.citedDocs.map((d) => (
              <Badge key={d.id} variant="outline" className="font-normal">
                {d.title}
              </Badge>
            ))}
            <span className="ml-auto text-muted-foreground">confidence {Math.round(a.confidence * 100)}%</span>
          </div>
          {a.needsHuman && (
            <div className="mt-2 flex items-start gap-2 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Needs a human: {a.gapNote}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProposalView({ p }: { p: Proposal }) {
  const q = p.quote;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Tier" value={p.tierName} />
        <Stat label="Net, a year" value={usd(q.netAnnual)} hint={`${q.discountPct}% discount, ${q.discountStatus.replace("_", " ")}`} />
        <Stat label="Recoverable, a year" value={usd(p.roi.recoverableAnnualUsd)} hint="from the Scout report" />
        <Stat label="Payback" value={`${p.roi.paybackMonths} months`} hint={`${p.roi.roiMultiple}x return`} />
      </div>
      {p.financeSignOff && (
        <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning-soft p-2 text-warning-foreground">
          <AlertTriangle className="size-4" /> Discount above the AE limit: Finance sign-off required before this leaves the building.
        </div>
      )}
      <Section title="Executive summary">
        <p className="whitespace-pre-wrap">{p.narrative.executiveSummary}</p>
      </Section>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Why now">
          <ul className="list-disc space-y-0.5 pl-5">
            {p.narrative.whyNow.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Section>
        <Section title="Next steps">
          <ul className="list-disc space-y-0.5 pl-5">
            {p.narrative.nextSteps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Section>
      </div>
      <Section title="Price build">
        <p className="text-xs text-muted-foreground">
          {q.locations} location(s) at {usd(q.perLocationMonthly)}/mo plus {q.technicians} technician(s) at {usd(q.perTechMonthly)}/mo = {usd(q.listMonthly)}/mo list. Sized against one recovered billable hour per technician per week ({usd(q.sizingAnchorAnnual)} a year at this yard): the net price is {q.priceAsShareOfAnchorPct}% of that.
        </p>
        <ul className="text-xs text-muted-foreground">
          {p.includes.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function CallNotesView({ out }: { out: CoachOutput }) {
  return (
    <div className="space-y-4 text-sm">
      {out.detected.map((d, i) => (
        <div key={i} className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs">
            <span className="italic">&ldquo;{d.quote}&rdquo;</span>
            <Badge variant="outline" className={cn("ml-2", d.objectionId === "none" ? TONE_CLASS.warning : TONE_CLASS.neutral)}>
              {d.objectionId === "none" ? "new objection" : d.objectionId.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="space-y-1 p-3">
            <p>{d.suggestedResponse}</p>
            {d.proofPoint && (
              <p className="flex items-start gap-1 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 size-3 shrink-0 text-ai" /> {d.proofPoint}
              </p>
            )}
          </div>
        </div>
      ))}
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Follow-ups">
          <ul className="space-y-1">
            {out.followUps.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <Badge variant="secondary">{f.owner}</Badge>
                <span>{f.task}</span>
                <span className="ml-auto text-xs text-muted-foreground">in {f.dueInDays}d</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="CRM note">
          <p className="rounded-md border bg-muted/40 p-3 text-xs">{out.crmNote}</p>
        </Section>
      </div>
    </div>
  );
}

export function OnboardingView({ plan }: { plan: OnboardingOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Codes exported" value={String(plan.codesRead)} />
        <Stat label="Merges proposed" value={String(plan.merges.length)} hint={`${plan.candidatePairs.length} candidates from similarity`} />
        <Stat label="Codes after cleanup" value={String(plan.survivingCodes)} />
      </div>
      <Section title="Merges (applied to DockMaster only after CSM approval)">
        <ul className="space-y-1">
          {plan.merges.map((m, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{m.fromCode}</span>
              <span className="text-muted-foreground">into</span>
              <span className="font-mono text-xs font-medium">{m.intoCode}</span>
              <span className="text-xs text-muted-foreground">{m.reason}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Technician keywords">
        <ul className="space-y-1">
          {plan.keywordMap.map((k) => (
            <li key={k.code} className="flex flex-wrap items-center gap-1">
              <span className="w-24 font-mono text-xs">{k.code}</span>
              {k.keywords.map((w) => (
                <Badge key={w} variant="outline" className="font-normal">
                  {w}
                </Badge>
              ))}
            </li>
          ))}
        </ul>
      </Section>
      {plan.kitSuggestions.length > 0 && (
        <Section title="Kit suggestions">
          <ul className="space-y-0.5 text-xs">
            {plan.kitSuggestions.map((k) => (
              <li key={k.code}>
                <span className="font-mono">{k.code}</span>: {k.parts.join(", ")}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Migration checklist">
          <ol className="list-decimal space-y-0.5 pl-5">
            {plan.migrationChecklist.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </Section>
        <Section title="Training plan">
          <ul className="space-y-1">
            {plan.trainingPlan.map((t) => (
              <li key={t.role}>
                <span className="font-medium capitalize">{t.role.replace("_", " ")}</span>: {t.sessions.join("; ")}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

export function HealthView({ r }: { r: HealthReport }) {
  const tone = r.band === "healthy" ? "success" : r.band === "watch" ? "warning" : "destructive";
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-3xl font-semibold tabular-nums">{r.health}</span>
        <Badge variant="outline" className={cn("capitalize", TONE_CLASS[tone])}>
          {r.band.replace("_", " ")}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {r.weeks} weeks, {r.periodStart} to {r.periodEnd}
        </span>
        <Badge variant="outline" className={cn("ml-auto capitalize", TONE_CLASS[r.churnRisk.level === "low" ? "success" : r.churnRisk.level === "medium" ? "warning" : "destructive"])}>
          churn risk {r.churnRisk.level}
        </Badge>
      </div>
      <ul className="list-disc space-y-0.5 pl-5">
        {r.reasons.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["editRate", "draftsStarted", "approvalRate", "valpayVolume", "arDays", "activeTechs"] as const).map((k) => {
          const t = r.trends[k];
          const pct = k === "editRate" || k === "approvalRate";
          const f = (v: number) => (pct ? `${Math.round(v * 100)}%` : k === "valpayVolume" ? usd(v) : String(v));
          return <Stat key={k} label={k.replace(/([A-Z])/g, " $1").toLowerCase()} value={f(t.last)} hint={`from ${f(t.first)}, ${t.direction}`} />;
        })}
      </div>
      {r.expansionTriggers.length > 0 && (
        <Section title="Expansion triggers">
          <ul className="space-y-1">
            {r.expansionTriggers.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-ai/40 bg-ai-soft p-2">
                <Badge variant="outline">{TIER_LABEL[e.tier]}</Badge>
                <span className="font-medium">{e.trigger}</span>
                <span className="text-xs text-muted-foreground">{e.evidence}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Nudges (drafts, sent by the CSM)">
        <ul className="space-y-1.5">
          {r.nudges.map((n, i) => (
            <li key={i} className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">
                {n.channel.replace("_", " ")} to {n.audience}
              </div>
              <p>{n.text}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function CaseStudyView({ cs }: { cs: ProofOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-lg font-semibold">{cs.headline}</h3>
      <p className="whitespace-pre-wrap">{cs.summary}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {cs.stats.map((s, i) => (
          <Stat key={i} label={s.label} value={s.value} />
        ))}
      </div>
      <Section title="Quote drafts (customer must edit and sign off)">
        {cs.quoteDrafts.map((q, i) => (
          <blockquote key={i} className="rounded-md bg-muted/50 px-3 py-2 italic">
            &ldquo;{q.text}&rdquo; <span className="not-italic text-xs text-muted-foreground">{q.speaker}, {q.title}</span>
          </blockquote>
        ))}
      </Section>
      <Section title="Slide bullets">
        <ul className="list-disc space-y-0.5 pl-5">
          {cs.slideBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </Section>
      <details className="rounded-md border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Metrics the draft may quote</summary>
        <div className="border-t p-2">
          <FiguresTable figures={cs.metrics} compact />
        </div>
      </details>
    </div>
  );
}

export function VocView({ r }: { r: VocReport }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">
        {r.itemsRead} items read, {r.themes.length} themes, ranked by revenue at stake (sum of Scout totals for the accounts behind each theme).
      </p>
      <ul className="space-y-2">
        {r.themes.map((t, i) => (
          <li key={i} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {t.kind.replace("_", " ")}
              </Badge>
              <span className="font-medium">{t.theme}</span>
              <span className="text-xs text-muted-foreground">{t.count} items</span>
              <span className="ml-auto font-mono text-xs tabular-nums">{usd(t.revenueAtStakeUsd)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.summary}</p>
            {t.accounts.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{t.accounts.join(", ")}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConferenceView({ plan }: { plan: ConferencePlan }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">
        {plan.conference.name}, {plan.conference.dates}. {plan.registered} registered accounts booked into Open Lab slots in Scout score order, each with a sandbox waiting.
      </p>
      <ul className="space-y-2">
        {plan.rows.map((r) => (
          <li key={r.accountId} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-muted-foreground">{r.attendees.map((a) => `${a.name} (${a.title})`).join(", ")}</span>
              <Badge variant="outline">{r.slot}</Badge>
              <Badge variant="outline">score {r.score}</Badge>
              {r.askForConsent && (
                <Badge variant="outline" className={TONE_CLASS.warning}>
                  ask for consent
                </Badge>
              )}
            </div>
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {r.talkingPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{plan.sameDayFollowUp}</p>
    </div>
  );
}

export function PartnerBriefView({ b }: { b: PartnerOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="text-xs text-muted-foreground">
        {b.partner.name} · {b.partner.kind.replace(/_/g, " ")} · {b.partner.focus}
      </div>
      <p className="whitespace-pre-wrap">{b.brief}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Why they care">
          <ul className="list-disc space-y-0.5 pl-5">
            {b.whyTheyCare.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Section>
        <Section title="Asks">
          <ul className="list-disc space-y-0.5 pl-5">
            {b.asks.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Section>
      </div>
      <Section title="Co-marketing">
        <ul className="space-y-1.5">
          {b.coMarketing.map((c, i) => (
            <li key={i} className="rounded-md border p-2">
              <div className="font-medium">
                {c.title} <span className="text-xs font-normal text-muted-foreground">{c.timing}</span>
              </div>
              <p className="text-xs">{c.description}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Lead routing">
        <p>{b.leadRouting}</p>
      </Section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
