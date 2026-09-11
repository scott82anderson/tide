import OpenAI, { toFile } from "openai";
import type { Transcriber, TranscriptionResult } from "./transcriber";

export class WhisperTranscriber implements Transcriber {
  readonly name = "whisper";
  private client: OpenAI | null;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.client = apiKey ? new OpenAI({ apiKey, maxRetries: 1 }) : null;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async transcribe(audio: Blob, filename: string): Promise<TranscriptionResult> {
    if (!this.client) throw new Error("OPENAI_API_KEY is not set");
    const started = Date.now();
    const file = await toFile(audio, filename);
    const res = await this.client.audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "en",
      prompt:
        "Marine service technician note. Terms: impeller, raw water pump, heat exchanger, outdrive, lower unit, gelcoat, HIN, slip, trim tab, actuator, Sea Ray, Grady-White, MerCruiser, Yamaha, Volvo Penta.",
    });
    return { text: res.text.trim(), provider: "whisper", durationMs: Date.now() - started };
  }
}
