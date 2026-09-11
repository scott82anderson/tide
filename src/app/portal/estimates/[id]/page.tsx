import { notFound } from "next/navigation";
import { Anchor, CheckCircle2, Clock, XCircle } from "lucide-react";
import { SignCard } from "@/components/portal/sign-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/demo-date";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import { formatMoney, round2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getDockMasterClient();
  const [estimate, marina] = await Promise.all([client.getEstimate(id), client.getMarina()]);
  if (!estimate) notFound();

  const v = estimate.vessel;
  const ops = estimate.lines.filter((l) => l.kind !== "part" && l.included);
  const jobs = ops.map((op) => {
    const parts = estimate.lines.filter((p) => p.kind === "part" && p.included && p.parentLineId === op.id);
    const partsTotal = parts.reduce((s, p) => s + p.lineTotal, 0);
    return {
      id: op.id,
      title: op.description.replace(/^[A-Z]{2,4}-[A-Z0-9]{2,4}-\d{2}:\s*/, ""),
      plain: op.customerDescription ?? null,
      parts: parts.map((p) => p.description.replace(/^\S+\s/, "")),
      amount: round2(op.lineTotal + partsTotal),
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2 border-b pb-5">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Anchor className="size-4" /> {marina.name}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Estimate {estimate.number} for {v.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {v.year} {v.make} {v.model} · {v.location} · Prepared {formatDate(estimate.createdAt)} for{" "}
          {estimate.customer.name}
        </p>
      </header>

      {estimate.photoPaths.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {estimate.photoPaths.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={p} alt="Technician photo" className="aspect-[4/3] w-full rounded-lg border object-cover" />
          ))}
        </div>
      )}

      {estimate.customerSummary && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What we found</h2>
          <p className="text-sm leading-relaxed">{estimate.customerSummary}</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recommended work</h2>
        <div className="divide-y rounded-lg border bg-card">
          {jobs.map((j) => (
            <div key={j.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="space-y-1">
                <div className="font-medium">{j.title}</div>
                {j.plain && <p className="text-sm text-muted-foreground">{j.plain}</p>}
                {j.parts.length > 0 && (
                  <p className="text-xs text-muted-foreground">Includes: {j.parts.join(", ")}</p>
                )}
              </div>
              <div className="shrink-0 font-medium tabular-nums">{formatMoney(j.amount)}</div>
            </div>
          ))}
          {jobs.length === 0 && <div className="p-4 text-sm text-muted-foreground">No work is currently included.</div>}
        </div>
      </section>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <dl className="space-y-1 text-sm">
            <Row label="Labour" value={estimate.totals.subtotalLabor} />
            <Row label="Parts" value={estimate.totals.subtotalParts} />
            <Row label="Shop supplies" value={estimate.totals.shopSupplies} />
            <Row label="Tax" value={estimate.totals.tax} />
            <div className="my-2 border-t" />
            <Row label="Total" value={estimate.totals.total} strong />
          </dl>
        </CardContent>
      </Card>

      {estimate.status === "awaiting_customer" && (
        <SignCard estimateId={estimate.id} total={formatMoney(estimate.totals.total)} />
      )}
      {(estimate.status === "draft_ai" || estimate.status === "draft_reviewed") && (
        <StateCard icon={Clock} tone="muted" title="This estimate is still being prepared">
          Your service manager is reviewing it. You will receive a link when it is ready to approve.
        </StateCard>
      )}
      {(estimate.status === "approved" || estimate.status === "converted") && (
        <StateCard icon={CheckCircle2} tone="success" title="Approved">
          Signed by {estimate.signedByName ?? estimate.customer.name}
          {estimate.signedAt && <> on {formatDate(estimate.signedAt)}</>}.
          {estimate.workOrderNumber && <> Work order {estimate.workOrderNumber} has been created; the yard will confirm the schedule.</>}
        </StateCard>
      )}
      {estimate.status === "declined" && (
        <StateCard icon={XCircle} tone="destructive" title="Declined">
          {estimate.declinedReason ? `Reason given: ${estimate.declinedReason}` : "No reason given."} The service team will be in touch.
        </StateCard>
      )}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Prepared with the help of DockMaster Service Writer and reviewed by your service manager. Questions? Call the
        service desk at (772) 555-0148.
      </footer>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between text-base font-semibold" : "flex justify-between"}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

function StateCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Clock;
  tone: "muted" | "success" | "destructive";
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-success/40 bg-success-soft"
      : tone === "destructive"
        ? "border-destructive/40 bg-destructive/5"
        : "bg-muted/40";
  return (
    <Card className={cls}>
      <CardContent className="flex gap-3 pt-6 text-sm">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">{title}</p>
          <p>{children}</p>
        </div>
      </CardContent>
    </Card>
  );
}
