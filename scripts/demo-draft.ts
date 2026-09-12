/**
 * pnpm demo:draft
 * Creates the sample note 1 draft in the database from recorded model output.
 * No API key needed. Handy for reviewing the draft screen without drafting live.
 */
import "./env";
import { draftFromTechNote } from "../src/lib/ai/pipeline";
import { recordedCallerForNote1 } from "../src/lib/ai/recorded";
import { NOTE_1_TRANSCRIPT } from "../src/lib/ai/fixtures/note-1";
import { PrismaDockMasterClient } from "../src/lib/dockmaster/mock-client";

async function main() {
  const client = new PrismaDockMasterClient();
  const note = await client.createTechNote({
    transcript: NOTE_1_TRANSCRIPT,
    technicianId: "tech_marcus_reyes",
    photoPaths: ["/samples/impeller.jpg", "/samples/pump-seal.jpg"],
    audioPath: "/samples/note-1-sea-ray-overheat.wav",
  });
  const { estimates } = await draftFromTechNote(client, recordedCallerForNote1(), {
    transcript: NOTE_1_TRANSCRIPT,
    technicianId: "tech_marcus_reyes",
    photoPaths: ["/samples/impeller.jpg", "/samples/pump-seal.jpg"],
    techNoteId: note.id,
  });
  for (const e of estimates) {
    console.log(`${e.number}  ${e.title}  $${e.totals.total.toFixed(2)}  /jobs/${e.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
