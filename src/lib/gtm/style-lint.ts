/**
 * Deterministic guardrails applied to every draft before a human sees it.
 *
 *   - Brand voice: no hype words, no exclamation marks, no dashes, length caps.
 *   - Truth in numbers: every dollar figure and every hour count in a draft
 *     must match a figure the agent was given (a SourceQuery), so a pitch can
 *     never contain a number that does not link back to a query.
 *   - Compliance: email carries an opt-out line; SMS only with opt-in.
 */

import { HYPE_WORDS, OPT_OUT_LINE } from "./brand-voice";
import type { SourceQuery } from "./types";

export interface LintIssue {
  rule: "hype" | "exclamation" | "dash" | "length" | "number" | "opt_out" | "sms_consent";
  message: string;
}

export interface LintResult {
  ok: boolean;
  issues: LintIssue[];
}

const NUMBER_RE = /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|K|m|M|thousand|million)?\b|(\d[\d,]*(?:\.\d+)?)\s*(?:standard\s+|billable\s+)?(hours|hrs|vessels|boats|estimates|days|technicians|techs)\b/g;

function toNumber(raw: string, suffix?: string): number {
  let n = Number(raw.replace(/,/g, ""));
  if (suffix) {
    const s = suffix.toLowerCase();
    if (s === "k" || s === "thousand") n *= 1000;
    if (s === "m" || s === "million") n *= 1_000_000;
  }
  return n;
}

/** A drafted figure is acceptable if it equals a known figure or a sensible rounding of one. */
export function matchesKnownFigure(value: number, known: number[]): boolean {
  for (const k of known) {
    if (k === 0) continue;
    if (Math.abs(value - k) <= Math.max(1, Math.abs(k) * 0.015)) return true;
    for (const unit of [10, 100, 1000, 10_000]) {
      if (Math.round(k / unit) * unit === value) return true;
    }
  }
  return false;
}

/** Numbers that appear in the text and do not link back to a provided figure. */
export function unlinkedNumbers(text: string, figures: SourceQuery[]): string[] {
  const known = figures.map((f) => f.value);
  const bad: string[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const [whole, dollars, suffix, count] = m;
    const value = dollars ? toNumber(dollars, suffix) : toNumber(count);
    if (!matchesKnownFigure(value, known)) bad.push(whole.trim());
  }
  return [...new Set(bad)];
}

export interface LintOptions {
  /** Figures the draft may quote. When given, every number must match one. */
  figures?: SourceQuery[];
  maxWords?: number;
  /** Emails must carry the opt-out line. */
  requireOptOut?: boolean;
  channel?: "email" | "sms" | "linkedin" | "call" | "other";
  smsOptIn?: boolean;
}

export function lintCopy(text: string, opts: LintOptions = {}): LintResult {
  const issues: LintIssue[] = [];
  const lower = text.toLowerCase();

  for (const w of HYPE_WORDS) {
    if (lower.includes(w)) issues.push({ rule: "hype", message: `Contains "${w}"` });
  }
  if (text.includes("!")) issues.push({ rule: "exclamation", message: "Contains an exclamation mark" });
  if (/[–—]/.test(text)) issues.push({ rule: "dash", message: "Contains an em or en dash" });

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (opts.maxWords && words > opts.maxWords) {
    issues.push({ rule: "length", message: `${words} words, limit ${opts.maxWords}` });
  }
  if (opts.channel === "sms" && text.length > 300) {
    issues.push({ rule: "length", message: `${text.length} characters, SMS limit 300` });
  }
  if (opts.channel === "sms" && opts.smsOptIn === false) {
    issues.push({ rule: "sms_consent", message: "SMS drafted without an SMS opt-in on the account" });
  }
  if (opts.requireOptOut && !text.includes(OPT_OUT_LINE)) {
    issues.push({ rule: "opt_out", message: "Email is missing the opt-out line" });
  }
  if (opts.figures) {
    for (const n of unlinkedNumbers(text, opts.figures)) {
      issues.push({ rule: "number", message: `"${n}" does not link back to a provided figure` });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Character-level edit ratio between an agent draft and the human's version. */
export function editRatio(original: string, edited: string): number {
  if (original.length === 0) return edited.length === 0 ? 0 : 1;
  // Prefix and suffix are usually preserved; count the differing middle.
  let start = 0;
  while (start < original.length && start < edited.length && original[start] === edited[start]) start++;
  let endA = original.length - 1;
  let endB = edited.length - 1;
  while (endA >= start && endB >= start && original[endA] === edited[endB]) {
    endA--;
    endB--;
  }
  const changed = Math.max(endA - start + 1, endB - start + 1);
  return Math.min(1, Math.round((changed / original.length) * 1000) / 1000);
}
