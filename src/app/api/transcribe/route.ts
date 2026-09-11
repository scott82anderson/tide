import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { getTranscriber } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST multipart/form-data with `audio` (a file) or `sample` (a bundled sample id).
 * Bundled samples return their shipped transcript so the demo never depends on
 * a microphone or a speech-to-text key.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const sample = form.get("sample");
  if (typeof sample === "string" && sample) {
    const file = path.join(process.cwd(), "public", "samples", path.basename(sample));
    try {
      const text = await fs.readFile(file, "utf8");
      return Response.json({ text: text.trim(), provider: "sample", durationMs: 0 });
    } catch {
      return Response.json({ error: "Sample not found." }, { status: 404 });
    }
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return Response.json({ error: "No audio provided." }, { status: 400 });
  }

  const transcriber = getTranscriber();
  if (!transcriber.isAvailable()) {
    return Response.json(
      { error: "Transcription is in paste mode: OPENAI_API_KEY is not set.", pasteMode: true },
      { status: 503 },
    );
  }
  try {
    const name = audio instanceof File ? audio.name : "note.webm";
    const result = await transcriber.transcribe(audio, name);
    return Response.json(result);
  } catch (err) {
    console.error("[transcribe]", err);
    return Response.json({ error: "Transcription failed. Paste the note instead." }, { status: 502 });
  }
}

export async function GET() {
  return Response.json({ provider: getTranscriber().name, available: getTranscriber().isAvailable() });
}
