import Link from "next/link";
import { CalendarClock, ClipboardList, FileSignature, Receipt, Sparkles } from "lucide-react";
import { ActivityFeed } from "@/components/activity-feed";
import { DueForServicePanel, type DueVessel } from "@/components/dashboard/due-for-service-panel";
import { EstimatesTable } from "@/components/dashboard/estimates-table";
import { OverdueInvoicesPanel } from "@/components/dashboard/overdue-invoices-panel";
import { SchedulerStrip } from "@/components/dashboard/scheduler-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_TODAY, addDays, demoWeekStart } from "@/lib/demo-date";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const client = getDockMasterClient();
  const weekStart = demoWeekStart();
  const [counts, queue, due, overdue, technicians, blocks, activity] = await Promise.all([
    client.getDashboardCounts(),
    client.listEstimates({ status: ["draft_ai", "draft_reviewed", "awaiting_customer", "approved"] }),
    client.listVesselsDueForService(),
    client.listOverdueInvoices(),
    client.listTechnicians(),
    client.listScheduleBlocks({ start: weekStart, end: addDays(weekStart, 5) }),
    client.listActivity({ limit: 12 }),
  ]);

  const dueVessels: DueVessel[] = [];
  for (const item of due) {
    let v = dueVessels.find((d) => d.vesselId === item.vessel.id);
    if (!v) {
      v = {
        vesselId: item.vessel.id,
        name: item.vessel.name,
        detail: `${item.vessel.year} ${item.vessel.make} ${item.vessel.model}`,
        owner: item.vessel.customer.name,
        operations: [],
      };
      dueVessels.push(v);
    }
    v.operations.push({
      code: item.operation.code,
      description: item.operation.description,
      monthsOverdue: item.monthsOverdue,
      intervalMonths: item.intervalMonths,
      lastWorkOrderNumber: item.lastWorkOrderNumber,
      lastDoneAt: item.lastDoneAt?.toISOString() ?? null,
    });
  }

  const today = DEMO_TODAY.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const handsOn = technicians.filter((t) => t.role !== "service_manager");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service desk</h1>
          <p className="text-sm text-muted-foreground">
            {today} · {handsOn.length} technicians on the floor
          </p>
        </div>
        <Button asChild>
          <Link href="/jobs/new">
            <Sparkles className="size-4" />
            New job from tech note
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          href="#queue"
          icon={<Sparkles className="size-4 text-ai" />}
          label="AI drafts awaiting review"
          value={counts.aiDrafts}
          hint="Drafted by Service Writer"
        />
        <StatCard
          href="/jobs?status=awaiting_customer"
          icon={<FileSignature className="size-4" />}
          label="Awaiting customer"
          value={counts.awaitingCustomer}
          hint="Sent for eSign"
        />
        <StatCard
          href="#due"
          icon={<CalendarClock className="size-4 text-warning" />}
          label="Due for service"
          value={counts.dueForService}
          hint="Vessels past an interval"
        />
        <StatCard
          href="#ar"
          icon={<Receipt className="size-4 text-destructive" />}
          label="Overdue AR"
          value={counts.overdueInvoices}
          hint={`${formatMoney(counts.overdueAmount)} outstanding`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card id="queue" className="scroll-mt-20 gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" />
                Draft queue
              </CardTitle>
              <CardDescription>Estimates in progress. Review and approve before anything reaches a customer.</CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <EstimatesTable
                estimates={queue}
                emptyText={
                  <>
                    No drafts yet.{" "}
                    <Link href="/jobs/new" className="text-primary underline-offset-2 hover:underline">
                      Start one from a tech note
                    </Link>
                    .
                  </>
                }
              />
            </CardContent>
          </Card>

          <Card id="scheduler" className="scroll-mt-20 gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4" />
                Scheduler, this week
              </CardTitle>
              <CardDescription>
                Technician blocks for the demo week. New work orders arrive here with a suggested slot from the AI Scheduling Assistant.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <SchedulerStrip
                weekStart={weekStart.toISOString()}
                technicians={handsOn.map((t) => ({ id: t.id, name: t.name, skills: t.skills }))}
                blocks={blocks.map((b) => ({
                  id: b.id,
                  technicianId: b.technicianId,
                  label: b.label,
                  start: b.start.toISOString(),
                  end: b.end.toISOString(),
                  source: b.source,
                  workOrderNumber: b.workOrderNumber,
                }))}
              />
            </CardContent>
          </Card>

          <Card className="gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Every AI step and staff action is logged.</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <ActivityFeed
                entries={activity.map((a) => ({
                  id: a.id,
                  actor: a.actor,
                  action: a.action,
                  entityType: a.entityType,
                  entityId: a.entityId,
                  createdAt: a.createdAt.toISOString(),
                  payload: a.payload,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card id="due" className="scroll-mt-20 gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-warning" />
                Due for service
              </CardTitle>
              <CardDescription>Predicted from each vessel&apos;s last job and the manufacturer interval.</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <DueForServicePanel vessels={dueVessels} />
            </CardContent>
          </Card>

          <Card id="ar" className="scroll-mt-20 gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-4 text-destructive" />
                Overdue invoices
              </CardTitle>
              <CardDescription>Reminders escalate in tone with age and carry a ValPay link.</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <OverdueInvoicesPanel
                invoices={overdue.map((i) => ({
                  id: i.id,
                  number: i.number,
                  customerName: i.customer.name,
                  amount: i.amount,
                  daysOverdue: i.daysOverdue,
                  ageBucket: i.ageBucket,
                  description: i.description,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link href={href} className="block rounded-xl transition-shadow hover:shadow-md">
      <Card className="h-full gap-2 py-4">
        <CardHeader className="px-4">
          <CardDescription className="flex items-center gap-2">
            {icon}
            {label}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="text-3xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
