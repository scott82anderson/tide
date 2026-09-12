import type { StructuredCaller, StructuredResult, UserContent } from "./anthropic";
import { ExtractionSchema, type Extraction } from "./schemas";

export interface PhotoAttachment {
  path: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

const SYSTEM = `You are the intake step of DockMaster Service Writer, used by full-service marinas and boatyards.

A technician has recorded a quick voice note (or typed one) after looking at a boat. Notes are informal: fragments, slang, brand nicknames, "port" and "starboard", "toast", "chewed up", "weeping", numbers spoken loosely ("about 205", "call it three, maybe three and a half"). Transcripts may contain small speech-to-text errors.

Your job is to structure the note faithfully. Do not diagnose beyond what the technician said, do not add recommendations the technician did not make, and do not guess vessel details that were not spoken. Leave a hint null when it is not in the note.

Guidance:
- One finding per distinct repair recommendation. A symptom and the repair that addresses it belong together. Related but separate repairs (for example replace impeller, replace pump, flush cooling system, inspect heat exchanger) are separate findings so each can be priced from the yard's operation codes.
- If the technician gives one time estimate that covers several findings, attach it to the finding whose repair takes most of that time (a pump replacement over an impeller swap or a flush) and leave the others null. Use the upper figure when a range is given ("three, maybe three and a half" is 3.5).
- quoteSeparately is true only when the technician explicitly says to quote, estimate or price something separately.
- Severity: high when there is an active failure or safety issue, medium for degraded parts that need replacement soon, low for cosmetic or advisory items.
- If the note contains nothing actionable, return an empty findings list and say so in rawSummary.
- HIN suffix: the technician may say "hull number ending 4471"; record "4471".`;

export async function extractFindings(
  ai: StructuredCaller,
  transcript: string,
  photos: PhotoAttachment[] = [],
): Promise<StructuredResult<Extraction>> {
  const content: UserContent = [];
  for (const p of photos) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: p.mediaType, data: p.base64 },
    });
  }
  content.push({
    type: "text",
    text:
      (photos.length ? `The technician attached ${photos.length} photo(s), shown above.\n\n` : "") +
      `Technician note transcript:\n"""\n${transcript.trim()}\n"""`,
  });

  return ai.call({
    name: "record_findings",
    description: "Record the structured findings and vessel hints from a technician note.",
    system: SYSTEM,
    user: content,
    schema: ExtractionSchema,
  });
}
