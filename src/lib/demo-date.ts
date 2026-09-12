/**
 * The demo runs against a fixed "today" so seeded intervals, overdue invoices and
 * the scheduler week are stable. Nothing in business logic should call new Date().
 */
export const DEMO_TODAY = new Date("2026-09-14T13:00:00.000Z");

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Activity log timestamps: the demo day, with the real time of day so entries
 * made during a session still order correctly.
 */
export function demoNow(): Date {
  // Take the wall clock in the yard's time zone (EDT, UTC-4 in September) so the
  // entry displays on the demo day regardless of where the demo is run.
  const local = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = new Date(DEMO_TODAY);
  d.setUTCHours(local.getHours() + 4, local.getMinutes(), local.getSeconds(), 0);
  return d;
}

export function daysBetween(from: Date, to: Date = DEMO_TODAY): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function monthsBetween(from: Date, to: Date = DEMO_TODAY): number {
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const months = to.getUTCMonth() - from.getUTCMonth();
  return years * 12 + months;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

/** Monday 00:00 UTC of the demo week. */
export function demoWeekStart(): Date {
  const d = new Date(DEMO_TODAY);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  return addDays(d, -diff);
}
