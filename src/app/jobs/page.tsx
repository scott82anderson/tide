import Link from "next/link";
import { Sparkles } from "lucide-react";
import { EstimatesTable } from "@/components/dashboard/estimates-table";
import { FilterLink } from "@/components/filter-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import type { EstimateStatus } from "@/lib/dockmaster/types";
import { STATUS_LABEL } from "@/lib/estimate-status";

export const dynamic = "force-dynamic";

const STATUSES = Object.keys(STATUS_LABEL) as EstimateStatus[];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = STATUSES.includes(status as EstimateStatus) ? (status as EstimateStatus) : null;
  const client = getDockMasterClient();
  const estimates = await client.listEstimates(active ? { status: [active] } : undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drafts and estimates</h1>
          <p className="text-sm text-muted-foreground">Everything the Service Writer has drafted, plus outreach estimates.</p>
        </div>
        <Button asChild>
          <Link href="/jobs/new">
            <Sparkles className="size-4" />
            New job from tech note
          </Link>
        </Button>
      </div>

      <nav className="flex flex-wrap gap-1 text-sm">
        <FilterLink href="/jobs" active={active === null}>
          All
        </FilterLink>
        {STATUSES.map((s) => (
          <FilterLink key={s} href={`/jobs?status=${s}`} active={active === s}>
            {STATUS_LABEL[s]}
          </FilterLink>
        ))}
      </nav>

      <Card className="py-2">
        <CardContent className="px-2">
          <EstimatesTable
            estimates={estimates}
            showOrigin
            emptyText={active ? `No estimates with status "${STATUS_LABEL[active]}".` : "No estimates yet."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
