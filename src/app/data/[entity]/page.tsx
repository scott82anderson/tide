import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Database } from "lucide-react";
import { DataBrowser } from "@/components/data/data-browser";
import { FilterLink } from "@/components/filter-link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ENTITY_META, ENTITY_SLUGS, isEntitySlug } from "@/lib/data-browser/entities";
import { loadDataPayload } from "@/lib/data-browser/load";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ entity: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { entity } = await params;
  const label = isEntitySlug(entity) ? ENTITY_META[entity].label : "Data";
  return { title: `Data · ${label}` };
}

export default async function DataEntityPage({ params }: Params) {
  const { entity } = await params;
  if (!isEntitySlug(entity)) notFound();

  const payload = await loadDataPayload(getDockMasterClient());
  const meta = ENTITY_META[entity];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Database className="size-5 text-muted-foreground" />
          Data
        </h1>
        <p className="text-sm text-muted-foreground">
          The seeded DockMaster records behind the Service Writer. Filtering runs in the browser; share the URL to
          share a view.
        </p>
      </div>

      <nav aria-label="Entity" className="flex flex-wrap gap-1 text-sm">
        {ENTITY_SLUGS.map((slug) => (
          <FilterLink key={slug} href={`/data/${slug}`} active={slug === entity} count={payload.counts[slug]}>
            {ENTITY_META[slug].label}
          </FilterLink>
        ))}
      </nav>

      <Card className="gap-3 py-4">
        <CardContent className="space-y-3 px-4">
          <p className="text-sm text-muted-foreground">{meta.description}</p>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <DataBrowser entity={entity} rows={payload.rows[entity]} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
