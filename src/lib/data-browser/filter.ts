/**
 * Pure filter, sort and URL-state helpers for the data browser. No React, no
 * entity knowledge: the column and facet definitions live in the UI layer.
 */

export type SortDir = "asc" | "desc";
export type SortValue = string | number | null | undefined;

export interface FacetSpec<Row> {
  key: string;
  /** One value, or several when the row belongs to multiple buckets (e.g. skills). */
  value: (row: Row) => string | string[] | null;
}

export interface BrowserState {
  q: string;
  sort: string | null;
  dir: SortDir;
  facets: Record<string, string>;
}

/** Sentinel meaning "no filter" for select facets; Radix Select rejects "". */
export const ALL = "all";

export function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function flatten(values: unknown[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) out.push(...flatten(v));
    else out.push(String(v).toLowerCase());
  }
  return out;
}

/** Every token must appear in at least one field (AND across tokens, OR across fields). */
export function applyQuery<Row>(rows: Row[], q: string, fields: (row: Row) => unknown[]): Row[] {
  const tokens = tokenize(q);
  if (tokens.length === 0) return rows;
  return rows.filter((row) => {
    const haystack = flatten(fields(row));
    return tokens.every((t) => haystack.some((h) => h.includes(t)));
  });
}

function facetActive(selected: string | undefined): selected is string {
  return selected !== undefined && selected !== "" && selected !== ALL;
}

export function applyFacets<Row>(
  rows: Row[],
  selected: Record<string, string>,
  facets: FacetSpec<Row>[],
): Row[] {
  const active = facets.filter((f) => facetActive(selected[f.key]));
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every((f) => {
      const v = f.value(row);
      return Array.isArray(v) ? v.includes(selected[f.key]) : v === selected[f.key];
    }),
  );
}

function compare(a: SortValue, b: SortValue): number {
  const aNull = a === null || a === undefined || a === "";
  const bNull = b === null || b === undefined || b === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Stable sort on a copy. Nulls sort last in both directions. */
export function sortRows<Row>(
  rows: Row[],
  sortValue: ((row: Row) => SortValue) | undefined,
  dir: SortDir,
): Row[] {
  if (!sortValue) return rows.slice();
  const sign = dir === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: sortValue(row) }))
    .sort((x, y) => {
      const xNull = x.value === null || x.value === undefined || x.value === "";
      const yNull = y.value === null || y.value === undefined || y.value === "";
      if (xNull !== yNull) return xNull ? 1 : -1;
      const c = compare(x.value, y.value) * sign;
      return c !== 0 ? c : x.index - y.index;
    })
    .map((x) => x.row);
}

export function distinctOptions<Row>(rows: Row[], value: (row: Row) => string | string[] | null): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = value(row);
    for (const item of Array.isArray(v) ? v : [v]) if (item) set.add(item);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

export function parseBrowserState(params: URLSearchParams, facetKeys: string[]): BrowserState {
  const dirRaw = params.get("dir");
  const facets: Record<string, string> = {};
  for (const key of facetKeys) {
    const v = params.get(key);
    if (v && v !== ALL) facets[key] = v;
  }
  return {
    q: params.get("q") ?? "",
    sort: params.get("sort") || null,
    dir: dirRaw === "desc" ? "desc" : "asc",
    facets,
  };
}

/** Query string including the leading "?", or "" when nothing is set. */
export function serializeBrowserState(state: BrowserState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q);
  if (state.sort) params.set("sort", state.sort);
  if (state.sort && state.dir === "desc") params.set("dir", "desc");
  for (const [key, value] of Object.entries(state.facets)) {
    if (value && value !== ALL) params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(state: Pick<BrowserState, "q" | "facets">): boolean {
  return state.q.trim().length > 0 || Object.values(state.facets).some((v) => v && v !== ALL);
}
