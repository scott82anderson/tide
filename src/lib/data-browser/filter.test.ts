import { describe, expect, it } from "vitest";
import {
  applyFacets,
  applyQuery,
  distinctOptions,
  hasActiveFilters,
  parseBrowserState,
  serializeBrowserState,
  sortRows,
  tokenize,
} from "./filter";
import { toInvoiceRows, toOperationRows, toWorkOrderRows } from "./rows";
import type { Invoice, OperationCode, PartsKit, Part, Vessel, WorkOrderSummary } from "@/lib/dockmaster/types";

interface Row {
  id: string;
  name: string;
  make: string | null;
  year: number;
  tags: string[];
  vendor: string;
  hours: number | null;
}

const rows: Row[] = [
  { id: "a", name: "Reel Therapy", make: "Sea Ray", year: 2019, tags: ["oil", "mercury"], vendor: "Mercury", hours: 2 },
  { id: "b", name: "Knot Working", make: null, year: 2015, tags: ["impeller"], vendor: "Yamaha", hours: 10 },
  { id: "c", name: "Salt Life", make: "Grady-White", year: 2021, tags: ["oil"], vendor: "Mercury", hours: 1 },
  { id: "d", name: "Aft Hours", make: "Boston Whaler", year: 2010, tags: [], vendor: "Volvo", hours: null },
];

const fields = (r: Row) => [r.name, r.make, r.year, r.tags];

describe("tokenize", () => {
  it("lowercases and splits on whitespace", () => {
    expect(tokenize("  Sea   Ray ")).toEqual(["sea", "ray"]);
    expect(tokenize("")).toEqual([]);
  });
});

describe("applyQuery", () => {
  it("returns the same rows for an empty or whitespace query", () => {
    expect(applyQuery(rows, "", fields)).toBe(rows);
    expect(applyQuery(rows, "   ", fields)).toBe(rows);
  });

  it("matches case-insensitive substrings", () => {
    expect(applyQuery(rows, "reel", fields).map((r) => r.id)).toEqual(["a"]);
    expect(applyQuery(rows, "SEA", fields).map((r) => r.id)).toEqual(["a"]);
  });

  it("ANDs tokens across fields", () => {
    expect(applyQuery(rows, "oil mercury", fields).map((r) => r.id)).toEqual(["a"]);
    expect(applyQuery(rows, "oil grady", fields).map((r) => r.id)).toEqual(["c"]);
  });

  it("matches array and numeric fields, skips nulls", () => {
    expect(applyQuery(rows, "impeller", fields).map((r) => r.id)).toEqual(["b"]);
    expect(applyQuery(rows, "2019", fields).map((r) => r.id)).toEqual(["a"]);
    expect(applyQuery(rows, "null", fields)).toEqual([]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(applyQuery(rows, "zzz", fields)).toEqual([]);
  });
});

describe("applyFacets", () => {
  const facets = [
    { key: "vendor", value: (r: Row) => r.vendor },
    { key: "recent", value: (r: Row) => (r.year >= 2019 ? "true" : "false") },
  ];

  it("treats 'all', empty and missing keys as no filter", () => {
    expect(applyFacets(rows, {}, facets)).toBe(rows);
    expect(applyFacets(rows, { vendor: "all" }, facets)).toBe(rows);
    expect(applyFacets(rows, { vendor: "" }, facets)).toBe(rows);
  });

  it("filters by a select facet and ANDs facets together", () => {
    expect(applyFacets(rows, { vendor: "Mercury" }, facets).map((r) => r.id)).toEqual(["a", "c"]);
    expect(applyFacets(rows, { vendor: "Mercury", recent: "true" }, facets).map((r) => r.id)).toEqual(["a", "c"]);
    expect(applyFacets(rows, { vendor: "Yamaha", recent: "true" }, facets)).toEqual([]);
  });

  it("supports toggle facets keyed on 'true'", () => {
    expect(applyFacets(rows, { recent: "true" }, facets).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("matches array-valued facets by membership", () => {
    const tagFacet = [{ key: "tag", value: (r: Row) => r.tags }];
    expect(applyFacets(rows, { tag: "oil" }, tagFacet).map((r) => r.id)).toEqual(["a", "c"]);
    expect(applyFacets(rows, { tag: "impeller" }, tagFacet).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("sortRows", () => {
  it("sorts numbers numerically, not lexically", () => {
    const sorted = sortRows(rows, (r) => r.hours, "asc");
    expect(sorted.map((r) => r.hours)).toEqual([1, 2, 10, null]);
  });

  it("uses numeric-aware string comparison", () => {
    const wos = [{ n: "WO-2026-0010" }, { n: "WO-2026-0009" }, { n: "WO-2026-0100" }];
    expect(sortRows(wos, (r) => r.n, "asc").map((r) => r.n)).toEqual(["WO-2026-0009", "WO-2026-0010", "WO-2026-0100"]);
  });

  it("keeps nulls last in both directions", () => {
    expect(sortRows(rows, (r) => r.hours, "asc").at(-1)?.id).toBe("d");
    expect(sortRows(rows, (r) => r.hours, "desc").at(-1)?.id).toBe("d");
    expect(sortRows(rows, (r) => r.hours, "desc").map((r) => r.hours)).toEqual([10, 2, 1, null]);
    expect(sortRows(rows, (r) => r.make, "desc").at(-1)?.id).toBe("b");
  });

  it("is stable for ties and does not mutate the input", () => {
    const copy = rows.slice();
    const sorted = sortRows(rows, (r) => r.vendor, "asc");
    expect(sorted.map((r) => r.id)).toEqual(["a", "c", "d", "b"]);
    expect(rows).toEqual(copy);
    expect(sorted).not.toBe(rows);
  });

  it("returns the input order (as a copy) when there is no sort value", () => {
    const out = sortRows(rows, undefined, "asc");
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows);
  });
});

describe("distinctOptions", () => {
  it("dedupes, drops empties and sorts", () => {
    expect(distinctOptions(rows, (r) => r.vendor)).toEqual(["Mercury", "Volvo", "Yamaha"]);
    expect(distinctOptions(rows, (r) => r.make)).toEqual(["Boston Whaler", "Grady-White", "Sea Ray"]);
    expect(distinctOptions(rows, (r) => r.tags)).toEqual(["impeller", "mercury", "oil"]);
  });
});

describe("browser state", () => {
  const keys = ["vendor", "low"];

  it("round-trips through the URL", () => {
    const state = { q: "oil filter", sort: "cost", dir: "desc" as const, facets: { vendor: "Mercury", low: "true" } };
    const qs = serializeBrowserState(state);
    expect(qs.startsWith("?")).toBe(true);
    expect(parseBrowserState(new URLSearchParams(qs), keys)).toEqual(state);
  });

  it("omits defaults and sentinels", () => {
    expect(serializeBrowserState({ q: "", sort: null, dir: "asc", facets: {} })).toBe("");
    expect(serializeBrowserState({ q: "  ", sort: null, dir: "desc", facets: { vendor: "all" } })).toBe("");
    expect(serializeBrowserState({ q: "", sort: "name", dir: "asc", facets: {} })).toBe("?sort=name");
  });

  it("falls back to asc for an invalid dir and drops unknown facet keys", () => {
    const state = parseBrowserState(new URLSearchParams("?dir=sideways&colour=red&vendor=all"), keys);
    expect(state.dir).toBe("asc");
    expect(state.facets).toEqual({});
  });

  it("reports whether any filter is active", () => {
    expect(hasActiveFilters({ q: "", facets: {} })).toBe(false);
    expect(hasActiveFilters({ q: "", facets: { vendor: "all" } })).toBe(false);
    expect(hasActiveFilters({ q: "x", facets: {} })).toBe(true);
    expect(hasActiveFilters({ q: "", facets: { vendor: "Mercury" } })).toBe(true);
  });
});

describe("row mappers", () => {
  const part: Part = {
    id: "47-1",
    partNumber: "47-1",
    description: "Impeller",
    vendor: "Mercury",
    cost: 10,
    sellPrice: 15,
    onHand: 1,
    reorderPoint: 2,
    binLocation: "A1",
    fitsEngineMakes: ["Mercury"],
  };
  const op = (code: string, kitId: string | null): OperationCode => ({
    id: code,
    code,
    description: code,
    category: "engine",
    standardHours: 1,
    laborRate: null,
    keywords: [],
    maintenanceIntervalMonths: null,
    kitId,
  });
  const kits: PartsKit[] = [
    { id: "kit_A", name: "Kit A", operationCode: "A", items: [{ part, qty: 2 }] },
    { id: "kit_B", name: "Kit B", operationCode: "", items: [] },
  ];

  it("joins kits onto operation codes by code, falling back to kitId", () => {
    const out = toOperationRows([op("A", "kit_A"), op("B", "kit_B"), op("C", null)], kits);
    expect(out[0].kit?.name).toBe("Kit A");
    expect(out[0].kit?.items).toEqual([{ partNumber: "47-1", description: "Impeller", qty: 2, onHand: 1 }]);
    expect(out[1].kit?.name).toBe("Kit B");
    expect(out[2].kit).toBeNull();
  });

  it("classifies invoices against a fixed today", () => {
    const today = new Date("2026-09-14T00:00:00.000Z");
    const base = { id: "", customerId: "c", workOrderId: null, workOrderNumber: null, amount: 1, description: "" };
    const customer = { id: "c", name: "Dana", email: "", phone: "", portalEnabled: true, arBalance: 0 };
    const invoices: Invoice[] = [
      { ...base, number: "1", customer, issuedAt: today, dueAt: new Date("2026-08-01T00:00:00.000Z"), paidAt: today },
      { ...base, number: "2", customer, issuedAt: today, dueAt: new Date("2026-08-01T00:00:00.000Z"), paidAt: null },
      { ...base, number: "3", customer, issuedAt: today, dueAt: new Date("2026-10-01T00:00:00.000Z"), paidAt: null },
    ];
    const out = toInvoiceRows(invoices, today);
    expect(out.map((i) => i.payment)).toEqual(["paid", "overdue", "unpaid"]);
    expect(out[1].daysOverdue).toBe(44);
    expect(out[0].daysOverdue).toBe(0);
    expect(out[0].customerName).toBe("Dana");
    expect(out[0].issuedAt).toBe("2026-09-14T00:00:00.000Z");
  });

  it("serialises work order dates and resolves vessel names", () => {
    const vessel = { id: "v1", name: "Reel Therapy" } as Vessel;
    const wo: WorkOrderSummary = {
      id: "w1",
      number: "WO-1",
      vesselId: "v1",
      status: "closed",
      description: "",
      openedAt: new Date("2026-01-01T00:00:00.000Z"),
      closedAt: null,
      technicianName: null,
      hoursBilled: 0,
      total: 0,
      operations: [],
      parts: [],
    };
    const out = toWorkOrderRows([wo, { ...wo, id: "w2", vesselId: "nope" }], [vessel]);
    expect(out[0].openedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(out[0].closedAt).toBeNull();
    expect(out[0].vesselName).toBe("Reel Therapy");
    expect(out[1].vesselName).toBe("Unknown vessel");
  });
});
