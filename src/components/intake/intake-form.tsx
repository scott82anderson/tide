"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Circle,
  FileAudio,
  Loader2,
  Mic,
  Square,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { cn } from "@/lib/utils";

interface TechnicianOption {
  id: string;
  name: string;
  role: string;
  skills: string[];
}

interface VesselCandidate {
  id: string;
  name: string;
  detail: string;
  score: number;
  reasons: string[];
}

interface DraftDone {
  estimateIds: string[];
  vesselMatch: {
    vesselId: string | null;
    confidence: number;
    reasons: string[];
    candidates: VesselCandidate[];
  };
  findings: number;
  notes: string[];
  latencyMs: number;
}

const SAMPLES = [
  {
    id: "1",
    file: "note-1-sea-ray-overheat.txt",
    audio: "/samples/note-1-sea-ray-overheat.wav",
    title: "Sea Ray overheat",
    blurb: "Port engine running hot, impeller chewed up, pump weeping. Trim tab quoted separately.",
  },
  {
    id: "2",
    file: "note-2-grady-white-electrical.txt",
    audio: null,
    title: "Grady-White electrical",
    blurb: "House bank not holding charge, corroded terminals, bilge float switch stuck.",
  },
  {
    id: "3",
    file: "note-3-catalina-rigging.txt",
    audio: null,
    title: "Catalina rigging",
    blurb: "Cracked swage on the forestay, chafed main halyard after the annual rig check.",
  },
];

const PHOTOS = [
  { path: "/samples/impeller.jpg", label: "impeller.jpg" },
  { path: "/samples/pump-seal.jpg", label: "pump-seal.jpg" },
];

const STEPS = [
  { key: "transcribing", label: "Transcribing" },
  { key: "reading_note", label: "Reading note" },
  { key: "matching_vessel", label: "Matching vessel" },
  { key: "matching_operations", label: "Matching operations" },
  { key: "pricing", label: "Pricing" },
  { key: "writing", label: "Writing" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];
const STAGE_TO_STEP: Record<string, StepKey> = {
  reading_note: "reading_note",
  matching_vessel: "matching_vessel",
  matching_operations: "matching_operations",
  pricing: "pricing",
  writing: "writing",
  saving: "writing",
};

type Phase = "idle" | "drafting" | "confirm_vessel" | "no_vessel" | "error";

export function IntakeForm({
  technicians,
  defaultTechnicianId,
}: {
  technicians: TechnicianOption[];
  defaultTechnicianId: string;
}) {
  const router = useRouter();
  const [technicianId, setTechnicianId] = useState(defaultTechnicianId);
  const [transcript, setTranscript] = useState("");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [transcriber, setTranscriber] = useState<{ provider: string; available: boolean } | null>(null);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [currentStep, setCurrentStep] = useState<StepKey | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<StepKey>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DraftDone | null>(null);
  const [chosenVessel, setChosenVessel] = useState<string | null>(null);

  // Recording
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canRecord = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((j) => setTranscriber({ provider: j.provider, available: Boolean(j.available) }))
      .catch(() => setTranscriber({ provider: "paste", available: false }));
  }, []);

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  async function loadSample(sample: (typeof SAMPLES)[number]) {
    setLoadingSample(sample.id);
    try {
      const fd = new FormData();
      fd.set("sample", sample.file);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not load sample");
      setTranscript(j.text);
      setAudioPath(sample.audio);
      setPasteNotice(null);
      if (sample.id === "1") setPhotos(PHOTOS.map((p) => p.path));
      toast.success(`Loaded sample note #${sample.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load sample");
    } finally {
      setLoadingSample(null);
    }
  }

  async function transcribeBlob(blob: Blob, filename: string) {
    setTranscribing(true);
    setPasteNotice(null);
    try {
      const fd = new FormData();
      fd.set("audio", new File([blob], filename, { type: blob.type || "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await res.json();
      if (res.status === 503 && j.pasteMode) {
        setPasteNotice("Transcription is in paste mode: OPENAI_API_KEY is not set. Paste the note below.");
        return;
      }
      if (!res.ok) throw new Error(j.error ?? "Transcription failed");
      setTranscript(j.text);
      setAudioPath(null);
      toast.success(`Transcribed with ${j.provider} in ${(j.durationMs / 1000).toFixed(1)} s`);
    } catch (err) {
      setPasteNotice(err instanceof Error ? err.message : "Transcription failed. Paste the note instead.");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        void transcribeBlob(blob, "recording.webm");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access was refused. Use a sample or paste the note.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const submitDraft = useCallback(
    async (vesselIdOverride?: string | null) => {
      setPhase("drafting");
      setErrorMessage(null);
      setNotice(null);
      setResult(null);
      setDoneSteps(new Set(["transcribing"]));
      setCurrentStep("reading_note");

      try {
        const res = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            technicianId,
            photoPaths: photos,
            audioPath,
            vesselIdOverride: vesselIdOverride ?? null,
          }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        const handle = (line: string) => {
          if (!line.trim()) return;
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(line);
          } catch {
            return;
          }
          if (typeof msg.notice === "string") setNotice(msg.notice);
          if (typeof msg.stage === "string") {
            const step = STAGE_TO_STEP[msg.stage];
            if (step) {
              setDoneSteps((prev) => {
                const next = new Set(prev);
                const idx = STEPS.findIndex((s) => s.key === step);
                STEPS.slice(0, idx).forEach((s) => next.add(s.key));
                return next;
              });
              setCurrentStep(step);
            }
          }
          if (msg.error) {
            finished = true;
            setErrorMessage(String(msg.error));
            setPhase("error");
          }
          if (msg.done) {
            finished = true;
            const done = msg as unknown as DraftDone;
            setDoneSteps(new Set(STEPS.map((s) => s.key)));
            setCurrentStep(null);
            setResult(done);
            if (done.estimateIds.length > 0 && done.vesselMatch.vesselId) {
              toast.success(`Draft ready in ${(done.latencyMs / 1000).toFixed(1)} s`);
              router.push(`/jobs/${done.estimateIds[0]}`);
            } else if (done.vesselMatch.candidates.length > 0) {
              setChosenVessel(done.vesselMatch.candidates[0].id);
              setPhase("confirm_vessel");
            } else {
              setPhase("no_vessel");
            }
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handle);
        }
        if (buffer.trim()) handle(buffer);
        if (!finished) {
          setErrorMessage("The draft did not finish. Nothing was sent to the customer.");
          setPhase("error");
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong while drafting.");
        setPhase("error");
      }
    },
    [transcript, technicianId, photos, audioPath, router],
  );

  const busy = phase === "drafting";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Technician</CardTitle>
            <CardDescription>Who recorded the note. Their role scopes which operation codes the draft may propose.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={technicianId} onValueChange={setTechnicianId} disabled={busy}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.role.replace("_", " ")}, {t.skills.join(", ")}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tech note</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>Load a bundled sample, upload or record audio, or paste text.</span>
              {transcriber && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-medium",
                    transcriber.available ? "bg-success-soft text-foreground" : "bg-warning-soft text-warning-foreground",
                  )}
                >
                  {transcriber.available ? "Whisper ready" : "Paste mode (no OPENAI_API_KEY)"}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="samples">
              <TabsList>
                <TabsTrigger value="samples">Sample notes</TabsTrigger>
                <TabsTrigger value="upload">Upload audio</TabsTrigger>
                <TabsTrigger value="record">Record</TabsTrigger>
                <TabsTrigger value="paste">Paste</TabsTrigger>
              </TabsList>

              <TabsContent value="samples" className="pt-2">
                <div className="grid gap-3 md:grid-cols-3">
                  {SAMPLES.map((s) => (
                    <div key={s.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                      <div className="text-sm font-medium">
                        #{s.id} {s.title}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.blurb}</p>
                      {s.audio ? (
                        <audio controls preload="none" src={s.audio} className="h-8 w-full" />
                      ) : (
                        <div className="text-[11px] text-muted-foreground">Transcript only</div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-auto"
                        disabled={busy || loadingSample !== null}
                        onClick={() => loadSample(s)}
                      >
                        {loadingSample === s.id ? <Loader2 className="animate-spin" /> : <FileAudio />}
                        Use this note
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="upload" className="pt-2">
                <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                  <Label htmlFor="audio-upload" className="text-sm">
                    Audio file (wav, m4a, mp3, webm)
                  </Label>
                  <input
                    id="audio-upload"
                    type="file"
                    accept="audio/*"
                    disabled={busy || transcribing}
                    className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void transcribeBlob(f, f.name);
                    }}
                  />
                  {transcribing && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Transcribing with Whisper
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="record" className="pt-2">
                <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                  {canRecord ? (
                    <div className="flex items-center gap-3">
                      {recording ? (
                        <Button variant="destructive" size="sm" onClick={stopRecording}>
                          <Square /> Stop and transcribe
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={startRecording} disabled={busy || transcribing}>
                          <Mic /> Start recording
                        </Button>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {recording ? "Recording. Speak the note, then stop." : "Uses your microphone, then sends to Whisper."}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Recording is not available in this browser. Use a sample, upload or paste.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="paste" className="pt-2">
                <div className="text-sm text-muted-foreground">Type or paste the technician&apos;s note into the transcript box below.</div>
              </TabsContent>
            </Tabs>

            {pasteNotice && (
              <Alert className="border-warning/50 bg-warning-soft text-warning-foreground">
                <AlertTriangle className="size-4" />
                <AlertTitle>Paste mode</AlertTitle>
                <AlertDescription className="text-warning-foreground/90">{pasteNotice}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="transcript">Transcript</Label>
                <span className="text-xs text-muted-foreground">{wordCount} words</span>
              </div>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Hull number ending 4471, that's the Sea Ray in slip C-12..."
                rows={8}
                disabled={busy}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Attached photos are shown to the model and to the boat owner on the estimate.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {PHOTOS.map((p) => {
                const on = photos.includes(p.path);
                return (
                  <button
                    key={p.path}
                    type="button"
                    disabled={busy}
                    onClick={() => setPhotos((prev) => (on ? prev.filter((x) => x !== p.path) : [...prev, p.path]))}
                    className={cn(
                      "relative flex w-40 flex-col overflow-hidden rounded-lg border text-left transition-colors",
                      on ? "border-ai ring-2 ring-ai/40" : "border-border opacity-70 hover:opacity-100",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.path} alt={p.label} className="aspect-[4/3] w-full object-cover" />
                    <span className="flex items-center gap-1 px-2 py-1 text-xs">
                      {on ? <Check className="size-3 text-ai" /> : <Circle className="size-3 text-muted-foreground" />}
                      {p.label}
                    </span>
                  </button>
                );
              })}
              <div className="flex w-40 items-center justify-center rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                <span className="flex flex-col items-center gap-1">
                  <Upload className="size-4" />
                  Upload photo (mobile app in production)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-ai" /> Draft estimate
            </CardTitle>
            <CardDescription>
              Service Writer reads the note, matches the vessel and operation codes, prices from the kit and writes the owner-facing wording.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" disabled={busy || !transcript.trim() || !technicianId} onClick={() => submitDraft()}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Draft estimate
            </Button>

            {phase !== "idle" && (
              <ol className="space-y-1.5">
                {STEPS.map((s) => {
                  const done = doneSteps.has(s.key);
                  const active = currentStep === s.key && !done;
                  return (
                    <li
                      key={s.key}
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        done ? "text-foreground" : active ? "text-ai" : "text-muted-foreground",
                      )}
                    >
                      {done ? (
                        <Check className="size-4 text-success" />
                      ) : active ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                      {s.label}
                    </li>
                  );
                })}
              </ol>
            )}

            {notice && (
              <div className="flex items-start gap-2 rounded-md bg-ai-soft px-3 py-2 text-xs text-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ai" />
                <span>{notice}</span>
              </div>
            )}

            {phase === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Could not draft</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{errorMessage}</p>
                  <Button size="sm" variant="outline" onClick={() => submitDraft()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {phase === "confirm_vessel" && result && (
              <div className="space-y-3 rounded-md border border-warning/50 bg-warning-soft p-3">
                <div className="text-sm font-medium text-warning-foreground">Confirm the vessel</div>
                <p className="text-xs text-warning-foreground/90">
                  The note did not identify one boat with enough confidence. Pick the right one and draft again.
                </p>
                <div className="space-y-2">
                  {result.vesselMatch.candidates.map((c) => (
                    <label
                      key={c.id}
                      className={cn(
                        "flex cursor-pointer gap-2 rounded-md border bg-card p-2 text-sm",
                        chosenVessel === c.id && "border-primary ring-1 ring-primary/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="vessel"
                        className="mt-1"
                        checked={chosenVessel === c.id}
                        onChange={() => setChosenVessel(c.id)}
                      />
                      <span className="flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{c.name}</span>
                          <ConfidenceBadge value={c.score} />
                        </span>
                        <span className="block text-xs text-muted-foreground">{c.detail}</span>
                        {c.reasons.length > 0 && (
                          <span className="block text-[11px] text-muted-foreground">{c.reasons.join("; ")}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <Button size="sm" className="w-full" disabled={!chosenVessel} onClick={() => submitDraft(chosenVessel)}>
                  Draft with this vessel
                </Button>
              </div>
            )}

            {phase === "no_vessel" && result && (
              <div className="space-y-2 rounded-md border border-warning/50 bg-warning-soft p-3 text-sm text-warning-foreground">
                <div className="font-medium">No vessel in the system matched this note</div>
                <p className="text-xs">
                  {result.vesselMatch.reasons.join("; ") || "No usable vessel hints were found."} Check the note for a HIN, slip or owner name and try again.
                </p>
                <Button size="sm" variant="outline" onClick={() => setPhase("idle")}>
                  Back to the note
                </Button>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Every line is a draft with a confidence badge. Nothing is sent to the owner without a staff click.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
