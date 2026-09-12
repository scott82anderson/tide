"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TryItResult } from "@/lib/gtm/agents/try-it-concierge";
import { PLATFORM_LABEL } from "@/lib/gtm/labels";
import type { Platform } from "@/lib/gtm/types";
import { cn, formatMoney } from "@/lib/utils";

type Phase = "idle" | "drafting" | "done" | "error";

export function TryItForm({
  accountId,
  accountName,
  sampleNote,
  recordedNote,
  aiConfigured,
}: {
  accountId: string | null;
  accountName: string | null;
  sampleNote: string;
  recordedNote: string;
  aiConfigured: boolean;
}) {
  const [transcript, setTranscript] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TryItResult | null>(null);
  const [lead, setLead] = useState({ name: "", email: "", yardName: accountName ?? "", platform: "molo" as Platform });
  const [leadSent, setLeadSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function post(body: Record<string, unknown>): Promise<TryItResult> {
    const res = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(j.error ?? "Could not draft the estimate.");
    return j as TryItResult;
  }

  async function draft() {
    setPhase("drafting");
    setError(null);
    setResult(null);
    setLeadSent(false);
    try {
      const r = await post({ transcript, accountId });
      setResult(r);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft the estimate.");
      setPhase("error");
    }
  }

  async function sendLead() {
    setSending(true);
    try {
      const r = await post({ transcript, accountId, lead });
      setResult(r);
      setLeadSent(true);
      toast.success("Thanks. Someone will be in touch to run your own notes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setSending(false);
    }
  }

  const ops = result?.lines.filter((l) => l.kind !== "part") ?? [];
  const parts = result?.lines.filter((l) => l.kind === "part") ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Paste a tech note</CardTitle>
          <CardDescription>
            Something like a technician talking into a phone after looking at a boat.
            {!aiConfigured && " No API key on this server: the sample note below drafts from recorded model output."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setTranscript(aiConfigured ? sampleNote : recordedNote)}>
              Use the sample note
            </Button>
            {aiConfigured && sampleNote !== recordedNote && (
              <Button size="sm" variant="ghost" onClick={() => setTranscript(recordedNote)}>
                Use the Sea Ray note
              </Button>
            )}
          </div>
          <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={9} className="font-mono text-sm" placeholder="Hull number ending 4471, that's the Sea Ray in slip C-12..." disabled={phase === "drafting"} />
          <Button className="w-full" disabled={phase === "drafting" || !transcript.trim()} onClick={draft}>
            {phase === "drafting" ? <Loader2 className="animate-spin" /> : <Sparkles />} Draft the estimate
          </Button>
          {phase === "drafting" && <p className="text-xs text-muted-foreground">Reading the note, matching the boat, choosing codes, pricing from the kit. About ten seconds.</p>}
          {phase === "error" && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Could not draft</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className={cn(!result && "opacity-70")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-ai" /> Draft estimate
          </CardTitle>
          <CardDescription>{result ? `Drafted in ${(result.latencyMs / 1000).toFixed(1)} seconds${result.recorded ? " from recorded output" : ""}.` : "Appears here."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {result && (
            <>
              {result.vessel ? (
                <div className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{result.vessel.name}</span>
                    <ConfidenceBadge value={result.vessel.confidence} reason={result.vessel.reasons.join("; ")} className="ml-auto" />
                  </div>
                  <div className="text-xs text-muted-foreground">{result.vessel.detail}</div>
                </div>
              ) : (
                <div className="rounded-md border border-warning/50 bg-warning-soft p-3 text-xs text-warning-foreground">
                  No boat in the sample yard matched this note, so nothing was priced. The findings were still read: {result.findings.map((f) => f.recommendation).join("; ") || "none"}. With your own vessel list this is where the match happens.
                </div>
              )}
              {ops.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {ops.map((l, i) => (
                    <li key={i} className="space-y-0.5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{l.code ?? "unmapped"}</span>
                        <span className="font-medium">{l.description}</span>
                        <span className="ml-auto font-mono text-xs tabular-nums">{formatMoney(l.lineTotal)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {l.hours != null && <span>{l.hours} h at {formatMoney(l.rate ?? 0)}</span>}
                        {l.sourceNote && <span className="truncate">from &ldquo;{l.sourceNote}&rdquo;</span>}
                        <ConfidenceBadge value={l.confidence} className="ml-auto" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {parts.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {parts.length} kit part(s) priced from stock{parts.some((p) => p.stockWarning) ? ", one or more short on hand" : ""}.
                </div>
              )}
              {result.vessel && (
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Total{result.separateDrafts ? `, plus ${result.separateDrafts} separate draft` : ""}</span>
                  <span className="text-xl font-semibold tabular-nums">{formatMoney(result.total)}</span>
                </div>
              )}

              <div className="space-y-3 rounded-md border border-ai/40 bg-ai-soft p-3">
                <div className="font-medium">See it against your own codes</div>
                <p className="text-xs">{result.nextStep}</p>
                {leadSent ? (
                  <p className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-success" /> Thanks, {lead.name.split(" ")[0]}. We will be in touch.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="lead-name" className="text-xs">Your name</Label>
                      <Input id="lead-name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lead-email" className="text-xs">Work email</Label>
                      <Input id="lead-email" type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lead-yard" className="text-xs">Yard</Label>
                      <Input id="lead-yard" value={lead.yardName} onChange={(e) => setLead({ ...lead, yardName: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lead-platform" className="text-xs">What you run today</Label>
                      <Select value={lead.platform} onValueChange={(v) => setLead({ ...lead, platform: v as Platform })}>
                        <SelectTrigger id="lead-platform" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
                            <SelectItem key={p} value={p}>
                              {PLATFORM_LABEL[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="sm:col-span-2" disabled={sending || !lead.name || !lead.email || !lead.yardName} onClick={sendLead}>
                      {sending ? <Loader2 className="animate-spin" /> : null} Send me the accuracy on my notes
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
