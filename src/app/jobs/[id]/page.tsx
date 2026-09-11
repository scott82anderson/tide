import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Anchor,
  CalendarClock,
  CheckCircle2,
  History,
  Info,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AiMark } from "@/components/ai-mark";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { StatusBadge } from "@/components/status-badge";
import { ActionsBar } from "@/components/review/actions-bar";
import { LinesTable, type LineView } from "@/components/review/lines-table";
import { ReasoningPanel } from "@/components/review/reasoning-panel";
import { VesselConfirm, type CandidateLite } from "@/components/review/vessel-confirm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MANAGER_APPROVAL_THRESHOLD } from "@/lib/ai/build-estimate";
import { VESSEL_CONFIRM_THRESHOLD } from "@/lib/ai/match-vessel";
import { formatDateTime } from "@/lib/demo-date";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import type { HistoryFlag } from "@/lib/dockmaster/types";
import { cn, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "estimate.drafted": "Service Writer drafted the estimate",
  "estimate.edited": "Lines edited",
  "estimate.approved_by_manager": "Draft approved by service manager",
  "estimate.sent_for_esign": "Sent to owner for eSign",
  "estimate.signed": "Owner approved and signed",
  "estimate.declined": "Owner declined",
  "estimate.converted": "Converted to work order",
  "estimate.vessel_confirmed": "Vessel confirmed by service manager",
  "outreach.drafted": "Outreach drafted",
  "outreach.sent": "Outreach sent",
};

const FLAG_STYLE: Record<HistoryFlag["kind"], { icon: typeof Info; className: string }> = {
  interval_overdue: { icon: AlertTriangle, className: "border-warning/50 bg-warning-soft text-warning-foreground" },
  interval_ok: { icon: CheckCircle2, className: "border-success/40 bg-success-soft text-foreground" },
  repeat_issue: { icon: History, className: "border-border bg-muted text-muted-foreground" },
  info: { icon: Info, className: "border-border bg-muted text-muted-foreground" },
};

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getDockMasterClient();
  const estimate = await client.getEstimate(id);
  if (!estimate) notFound();

  const [all, activity, marina] = await Promise.all([
    client.listEstimates(),
    client.listActivity({ entityType: "estimate", entityId: id, limit: 30 }),
    client.getMarina(),
  ]);
  const parent = estimate.parentEstimateId ? all.find((e) => e.id === estimate.parentEstimateId) : null;
  const children = all.filter((e) => e.parentEstimateId === estimate.id);

  const v = estimate.vessel;
  const hasAi = estimate.lines.some((l) => l.source === "ai");
  const editable = estimate.status === "draft_ai" || estimate.status === "draft_reviewed";
  const lowConfidence =
    estimate.vesselMatchConfidence != null && estimate.vesselMatchConfidence < VESSEL_CONFIRM_THRESHOLD;
  const matchStep = estimate.reasoning.steps.find((s) => s.step === "match_vessel");
  const candidates: CandidateLite[] =
    matchStep && typeof matchStep.output === "object" && matchStep.output !== null
      ? ((matchStep.output as { candidates?: CandidateLite[] }).candidates ?? [])
      : [];

  const lines: LineView[] = estimate.lines.map((l) => ({
    id: l.id,
    kind: l.kind,
    parentLineId: l.parentLineId,
    description: l.description,
    qty: l.qty,
    hours: l.hours ?? null,
    standardHours: l.standardHours ?? null,
    technicianHours: l.technicianHours ?? null,
    hoursFlag: l.hoursFlag ?? null,
    rate: l.rate ?? null,
    unitPrice: l.unitPrice ?? null,
    lineTotal: l.lineTotal,
    included: l.included,
    confidence: l.confidence ?? null,
    source: l.source,
    rationale: l.rationale ?? null,
    sourceNote: l.sourceNote ?? null,
    stockWarning: l.stockWarning ?? null,
    needsManagerReview: l.needsManagerReview,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{estimate.number}</h1>
            <StatusBadge status={estimate.status} />
            {hasAi && <AiMark label="AI draft" className="bg-ai-soft" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {estimate.title}
            {estimate.technicianName && <> · from a note by {estimate.technicianName}</>}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Estimate total</div>
          <div className="text-2xl font-semibold tabular-nums">{formatMoney(estimate.totals.total)}</div>
        </div>
      </div>

      {(estimate.requiresManagerApproval || estimate.quoteSeparately || parent || children.length > 0) && (
        <div className="space-y-2">
          {estimate.requiresManagerApproval && (
            <Banner tone="warning" icon={ShieldAlert}>
              Requires manager approval: total is above {formatMoney(MANAGER_APPROVAL_THRESHOLD)}.
            </Banner>
          )}
          {estimate.quoteSeparately && (
            <Banner tone="ai" icon={Sparkles}>
              Quoted separately per technician.
              {parent && (
                <>
                  {" "}
                  Part of{" "}
                  <Link href={`/jobs/${parent.id}`} className="font-medium underline underline-offset-2">
                    {parent.number}
                  </Link>
                  .
                </>
              )}
            </Banner>
          )}
          {children.map((c) => (
            <Banner key={c.id} tone="ai" icon={Sparkles}>
              Also drafted:{" "}
              <Link href={`/jobs/${c.id}`} className="font-medium underline underline-offset-2">
                {c.number}
              </Link>{" "}
              (quoted separately), {formatMoney(c.totals.total)}.
            </Banner>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Anchor className="size-4" /> Matched vessel
              <ConfidenceBadge value={estimate.vesselMatchConfidence} className="ml-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div>
              <div className="text-lg font-semibold">{v.name}</div>
              <div className="text-sm text-muted-foreground">
                {v.year} {v.make} {v.model}, {v.lengthFt} ft · HIN ending {v.hin.slice(-4)}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Owner</dt>
              <dd>{estimate.customer.name}</dd>
              <dt className="text-muted-foreground">Location</dt>
              <dd>{v.location}</dd>
              <dt className="text-muted-foreground">Engines</dt>
              <dd>
                {v.engineCount} x {v.engineMake} {v.engineModel}, {v.engineHours} h
              </dd>
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="truncate">{estimate.customer.email}</dd>
            </dl>
            {estimate.vesselMatchReasons.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {estimate.vesselMatchReasons.map((r, i) => (
                  <li key={i} className="flex gap-1">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" /> {r}
                  </li>
                ))}
              </ul>
            )}
            {lowConfidence && candidates.length > 0 && (
              <VesselConfirm estimateId={estimate.id} candidates={candidates} currentVesselId={v.id} />
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" /> History flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            {estimate.historyFlags.length === 0 && (
              <p className="text-sm text-muted-foreground">No history flags for the lines on this estimate.</p>
            )}
            {estimate.historyFlags.map((f, i) => {
              const style = FLAG_STYLE[f.kind] ?? FLAG_STYLE.info;
              const Icon = style.icon;
              return (
                <div key={i} className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", style.className)}>
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <span>{f.message}</span>
                </div>
              );
            })}
            {estimate.photoPaths.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {estimate.photoPaths.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p} src={p} alt={p.split("/").pop() ?? "photo"} className="h-24 rounded-md border object-cover" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LinesTable estimateId={estimate.id} lines={lines} marina={marina} editable={editable} />

      {(estimate.customerSummary || estimate.internalSummary) && (
        <div className="grid gap-4 md:grid-cols-2">
          {estimate.customerSummary && (
            <Card className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  For the owner <AiMark />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-sm">{estimate.customerSummary}</CardContent>
            </Card>
          )}
          {estimate.internalSummary && (
            <Card className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  Internal tech summary <AiMark />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 font-mono text-xs">{estimate.internalSummary}</CardContent>
            </Card>
          )}
        </div>
      )}

      <ReasoningPanel trace={estimate.reasoning} />

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <ActionsBar
            estimateId={estimate.id}
            status={estimate.status}
            workOrderNumber={estimate.workOrderNumber}
            requiresManagerApproval={estimate.requiresManagerApproval}
          />
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-20 justify-center capitalize",
                      a.actor === "ai" && "border-ai/40 bg-ai-soft",
                      a.actor === "customer" && "border-success/40 bg-success-soft",
                    )}
                  >
                    {a.actor}
                  </Badge>
                  <span>{ACTION_LABEL[a.action] ?? a.action}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "warning" | "ai";
  icon: typeof Info;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        tone === "warning" && "border-warning/50 bg-warning-soft text-warning-foreground",
        tone === "ai" && "border-ai/40 bg-ai-soft text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
