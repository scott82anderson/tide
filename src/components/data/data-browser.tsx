"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENTITY_META, type EntitySlug } from "@/lib/data-browser/entities";
import {
  ALL,
  applyFacets,
  applyQuery,
  distinctOptions,
  hasActiveFilters,
  parseBrowserState,
  serializeBrowserState,
  sortRows,
  type BrowserState,
} from "@/lib/data-browser/filter";
import type { EntityRowMap } from "@/lib/data-browser/rows";
import { cn } from "@/lib/utils";
import { ENTITY_CONFIGS, type EntityConfig } from "./columns";

const SEARCH_DEBOUNCE_MS = 150;

export function DataBrowser<E extends EntitySlug>({ entity, rows }: { entity: E; rows: EntityRowMap[E][] }) {
  type Row = EntityRowMap[E];
  const config = ENTITY_CONFIGS[entity] as unknown as EntityConfig<Row>;
  const meta = ENTITY_META[entity];

  const params = useSearchParams();
  const pathname = usePathname();
  const facetKeys = useMemo(() => config.facets.map((f) => f.key), [config]);

  // The URL is the source of truth for sort and facets. The search box keeps a
  // local copy so typing filters instantly and only the URL write is debounced.
  const state = useMemo<BrowserState>(
    () => parseBrowserState(new URLSearchParams(params.toString()), facetKeys),
    [params, facetKeys],
  );
  const [qInput, setQInput] = useState(state.q);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const writeState = useCallback(
    (next: BrowserState) => {
      // A null state lets Next's patched replaceState sync useSearchParams
      // without an RSC round trip. Passing Next's own history state object
      // would make it treat the call as internal and skip that sync.
      window.history.replaceState(null, "", pathname + serializeBrowserState(next));
    },
    [pathname],
  );

  // Carry the live search text so a facet or sort change inside the debounce
  // window does not resurrect the stale query from the URL.
  const patch = useCallback(
    (delta: Partial<BrowserState>) => writeState({ ...state, q: qInput, ...delta }),
    [state, qInput, writeState],
  );

  // Debounce the search box into the URL.
  useEffect(() => {
    if (qInput === state.q) return;
    const id = window.setTimeout(() => writeState({ ...state, q: qInput }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [qInput, state, writeState]);

  // Follow external URL changes (back/forward, chip navigation).
  useEffect(() => {
    setQInput(state.q);
  }, [state.q]);

  const sortKey = state.sort ?? config.defaultSort.key;
  const sortDir = state.sort ? state.dir : config.defaultSort.dir;
  const sortColumn = config.columns.find((c) => c.key === sortKey);

  const visible = useMemo(() => {
    const searched = applyQuery(rows, qInput, config.searchFields);
    const faceted = applyFacets(searched, state.facets, config.facets);
    return sortRows(faceted, sortColumn?.sortValue, sortDir);
  }, [rows, qInput, state.facets, config, sortColumn, sortDir]);

  const facetOptions = useMemo(
    () =>
      Object.fromEntries(
        config.facets.map((f) => [
          f.key,
          f.options === "distinct" ? distinctOptions(rows, f.value).map((v) => ({ value: v, label: v })) : f.options,
        ]),
      ) as Record<string, { value: string; label: string }[]>,
    [config, rows],
  );

  const active = hasActiveFilters({ q: qInput, facets: state.facets });

  function onSort(key: string) {
    if (key === sortKey) patch({ sort: key, dir: sortDir === "asc" ? "desc" : "asc" });
    else patch({ sort: key, dir: "asc" });
  }

  function setFacet(key: string, value: string) {
    const facets = { ...state.facets };
    if (value && value !== ALL) facets[key] = value;
    else delete facets[key];
    patch({ facets });
  }

  function clearFilters() {
    setQInput("");
    writeState({ ...state, q: "", facets: {} });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const colCount = config.columns.length + (config.detail ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={`Search ${meta.noun}`}
            placeholder={`Search ${meta.noun}…`}
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="pl-8"
          />
        </div>

        {config.facets.map((facet) =>
          facet.kind === "select" ? (
            <Select
              key={facet.key}
              value={state.facets[facet.key] ?? ALL}
              onValueChange={(v) => setFacet(facet.key, v)}
            >
              <SelectTrigger aria-label={facet.label} className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any {facet.label.toLowerCase()}</SelectItem>
                {facetOptions[facet.key].map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Label
              key={facet.key}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-normal"
            >
              <Checkbox
                checked={state.facets[facet.key] === "true"}
                onCheckedChange={(checked) => setFacet(facet.key, checked === true ? "true" : "")}
              />
              {facet.label}
            </Label>
          ),
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite" data-testid="result-count">
            {visible.length} of {rows.length} {meta.noun}
          </span>
          {active && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {config.detail && <TableHead className="w-8" />}
              {config.columns.map((col) => {
                const sortable = Boolean(col.sortValue);
                const isSorted = sortable && col.key === sortKey;
                const Icon = isSorted ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <TableHead
                    key={col.key}
                    className={col.className}
                    aria-sort={isSorted ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
                          isSorted ? "text-foreground" : "text-muted-foreground",
                          col.className?.includes("text-right") && "flex-row-reverse",
                        )}
                      >
                        {col.header}
                        <Icon className={cn("size-3", !isSorted && "opacity-50")} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-10 text-center text-muted-foreground">
                  No {meta.noun} match these filters.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => {
                const key = config.rowKey(row);
                const isOpen = expanded.has(key);
                return (
                  <Fragment key={key}>
                    <TableRow
                      className={cn(config.detail && "cursor-pointer", isOpen && "bg-muted/40")}
                      onClick={config.detail ? () => toggleExpanded(key) : undefined}
                    >
                      {config.detail && (
                        <TableCell className="w-8 pr-0">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={isOpen ? "Collapse row" : "Expand row"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(key);
                            }}
                            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </TableCell>
                      )}
                      {config.columns.map((col) => (
                        <TableCell key={col.key} className={col.className}>
                          {col.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isOpen && config.detail && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={colCount} className="whitespace-normal px-4 py-3">
                          {config.detail(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
