import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { AiCallError, AiUnavailableError, getAi, isAiConfigured } from "@/lib/ai/anthropic";
import type { PhotoAttachment } from "@/lib/ai/extract";
import { draftFromTechNote, type PipelineStage } from "@/lib/ai/pipeline";
import { isRecordedTranscript, recordedCallerForNote1 } from "@/lib/ai/recorded";
import { getDockMasterClient } from "@/lib/dockmaster/mock-client";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DraftRequest {
  transcript: string;
  technicianId: string;
  photoPaths?: string[];
  audioPath?: string | null;
  vesselIdOverride?: string | null;
  techNoteId?: string | null;
}

const SAMPLE_DIR = path.join(process.cwd(), "public", "samples");

async function loadPhotos(paths: string[]): Promise<PhotoAttachment[]> {
  const out: PhotoAttachment[] = [];
  for (const p of paths) {
    const name = path.basename(p);
    if (!/\.(jpe?g|png|webp)$/i.test(name)) continue;
    try {
      const buf = await fs.readFile(path.join(SAMPLE_DIR, name));
      const ext = name.toLowerCase().split(".").pop();
      out.push({
        path: `/samples/${name}`,
        mediaType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
        base64: buf.toString("base64"),
      });
    } catch {
      // Unknown photo: skip the bytes but keep the reference on the estimate.
    }
  }
  return out;
}

/**
 * Streams NDJSON progress events, then a final result. The client renders the
 * progress steps (Reading note, Matching vessel, ...) as they arrive.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as DraftRequest;
  if (!body.transcript?.trim()) {
    return Response.json({ error: "Transcript is empty." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // The client may navigate away mid-stream; enqueue then throws. Ignore it.
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      const client = getDockMasterClient();
      try {
        // Without a key, the bundled sample still drafts from recorded model
        // output so the demo never dead-ends. Anything else needs a live key.
        const recorded = !isAiConfigured() && isRecordedTranscript(body.transcript);
        const ai = recorded ? recordedCallerForNote1() : getAi();
        if (recorded) send({ notice: "No ANTHROPIC_API_KEY set: using recorded model output for the sample note." });
        const photoPaths = (body.photoPaths ?? []).map((p) => `/samples/${path.basename(p)}`);
        const photos = await loadPhotos(photoPaths);

        let techNoteId = body.techNoteId ?? null;
        if (!techNoteId) {
          const note = await client.createTechNote({
            transcript: body.transcript,
            technicianId: body.technicianId,
            photoPaths,
            audioPath: body.audioPath ?? null,
          });
          techNoteId = note.id;
          await client.logActivity({
            actor: "staff",
            action: "tech_note.created",
            entityType: "tech_note",
            entityId: note.id,
            payload: { technicianId: body.technicianId, photos: photoPaths.length },
          });
        }

        const { result, estimates } = await draftFromTechNote(client, ai, {
          transcript: body.transcript,
          technicianId: body.technicianId,
          photos,
          photoPaths,
          techNoteId,
          vesselIdOverride: body.vesselIdOverride ?? null,
          onStage: (stage: PipelineStage) => send({ stage }),
        });

        send({
          done: true,
          techNoteId,
          estimateIds: estimates.map((e) => e.id),
          vesselMatch: {
            vesselId: result.vesselMatch.vesselId,
            confidence: result.vesselMatch.confidence,
            reasons: result.vesselMatch.reasons,
            candidates: result.vesselMatch.candidates.map((c) => ({
              id: c.vessel.id,
              name: c.vessel.name,
              detail: `${c.vessel.year} ${c.vessel.make} ${c.vessel.model}, ${c.vessel.location}, ${c.vessel.customer.name}`,
              score: c.score,
              reasons: c.reasons,
            })),
          },
          findings: result.extraction.findings.length,
          notes: result.trace.notes,
          latencyMs: result.totalLatencyMs,
        });
      } catch (err) {
        const message =
          err instanceof AiUnavailableError || err instanceof AiCallError
            ? err.message
            : "Something went wrong while drafting. Nothing was sent to the customer.";
        console.error("[draft]", err);
        send({ error: message, retryable: !(err instanceof AiUnavailableError) });
      } finally {
        if (open) {
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
