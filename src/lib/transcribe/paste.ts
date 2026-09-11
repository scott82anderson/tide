import type { Transcriber, TranscriptionResult } from "./transcriber";

/**
 * Fallback when no speech-to-text key is configured. It never processes audio;
 * the intake UI shows a notice and the technician pastes or types the note.
 */
export class PasteTranscriber implements Transcriber {
  readonly name = "paste";

  isAvailable(): boolean {
    return false;
  }

  async transcribe(): Promise<TranscriptionResult> {
    throw new Error("Transcription is in paste mode. Add OPENAI_API_KEY to enable Whisper.");
  }
}
