import { PasteTranscriber } from "./paste";
import type { Transcriber } from "./transcriber";
import { WhisperTranscriber } from "./whisper";

export function getTranscriber(): Transcriber {
  const whisper = new WhisperTranscriber();
  return whisper.isAvailable() ? whisper : new PasteTranscriber();
}

export type { Transcriber, TranscriptionResult } from "./transcriber";
