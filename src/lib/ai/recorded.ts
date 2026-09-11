/**
 * Recorded model outputs for the bundled sample note. Used when no
 * ANTHROPIC_API_KEY is configured so the demo path still produces a realistic
 * draft, and by `pnpm demo:draft` to seed a reviewable estimate. The UI labels
 * these drafts as recorded so nobody mistakes them for a live call.
 */

import { FakeStructuredCaller, type StructuredCaller } from "./anthropic";
import {
  NOTE_1_TRANSCRIPT,
  extractionFixture,
  narrativeFixtureMain,
  narrativeFixtureSeparate,
  operationMatchFixture,
} from "./fixtures/note-1";

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isRecordedTranscript(transcript: string): boolean {
  return normalise(transcript) === normalise(NOTE_1_TRANSCRIPT);
}

export function recordedCallerForNote1(): StructuredCaller {
  return new FakeStructuredCaller({
    record_findings: [structuredClone(extractionFixture)],
    choose_operations: [structuredClone(operationMatchFixture)],
    write_estimate_wording: [structuredClone(narrativeFixtureMain), structuredClone(narrativeFixtureSeparate)],
  });
}
