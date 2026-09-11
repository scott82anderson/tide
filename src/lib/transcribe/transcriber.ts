export interface TranscriptionResult {
  text: string;
  provider: "whisper" | "paste" | "sample";
  durationMs: number;
}

export interface Transcriber {
  readonly name: string;
  /** Whether this transcriber can actually process audio right now. */
  isAvailable(): boolean;
  transcribe(audio: Blob, filename: string): Promise<TranscriptionResult>;
}
