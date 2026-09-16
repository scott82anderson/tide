"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { runAgentAction } from "@/app/gtm/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE_TRANSCRIPT = `AE: ...so the draft comes from your own codes, not from a transcript.
Ray: We tried voice-to-text three years ago and honestly it was junk. The guys stopped using it in a month.
AE: Understood.
Ray: And the price, Gail is going to ask what we are getting for it. We already pay for Web.
AE: Fair.
Ray: Also, our customers are older. I do not see them signing estimates on a phone.
AE: Let me take those one at a time.`;

const SAMPLE_QUESTIONS = `Does the model train on our customers' data?
What happens to estimates if the AI provider is down?
Is the Service Writer SOC 2 certified?
Which DockMaster API endpoints does it write to?
How accurate is the operation code matching?`;

interface Done {
  queueItemId: string | null;
  message: string;
}

function useRun() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  async function run(agent: "objection_coach" | "sales_engineer" | "partner_agent", input: Record<string, unknown>) {
    setBusy(true);
    setDone(null);
    try {
      const res = await runAgentAction(agent, input);
      if (res.ok) {
        setDone({ queueItemId: res.queueItemId ?? null, message: res.message });
        toast.success(res.message);
      } else toast[res.blocked ? "warning" : "error"](res.message, { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }
  return { busy, done, run };
}

function DoneLink({ done }: { done: Done | null }) {
  if (!done) return null;
  return (
    <p className="text-sm">
      {done.message}{" "}
      {done.queueItemId && (
        <Link href={`/gtm/queue/${done.queueItemId}`} className="text-primary underline-offset-2 hover:underline">
          Open it
        </Link>
      )}
    </p>
  );
}

export function DeskForms({
  accounts,
  objections,
  docs,
}: {
  accounts: { id: string; name: string }[];
  objections: { id: string; objection: string }[];
  docs: { id: string; title: string; kind: string }[];
}) {
  const coach = useRun();
  const se = useRun();
  const [accountId, setAccountId] = useState<string>("acc_bayhaven");
  const [transcript, setTranscript] = useState("");
  const [questions, setQuestions] = useState("");

  return (
    <Tabs defaultValue="coach">
      <TabsList>
        <TabsTrigger value="coach">Objection Coach</TabsTrigger>
        <TabsTrigger value="se">Sales Engineer</TabsTrigger>
      </TabsList>

      <TabsContent value="coach" className="pt-3">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Live call</CardTitle>
              <CardDescription>Paste the transcript so far. The coach matches objections to the library and adapts the answer with the account&apos;s own numbers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
              <div className="space-y-1">
                <Label className="text-xs">Account (for proof points)</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Transcript</Label>
                  <Button size="sm" variant="ghost" onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}>
                    Use the sample call
                  </Button>
                </div>
                <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={9} className="font-mono text-xs" placeholder="Ray: We tried voice-to-text before and it was junk..." />
              </div>
              <Button disabled={coach.busy || !transcript.trim()} onClick={() => coach.run("objection_coach", { accountId, transcript })}>
                {coach.busy ? <Loader2 className="animate-spin" /> : <Sparkles className="text-ai" />} Coach this call
              </Button>
              <DoneLink done={coach.done} />
            </CardContent>
          </Card>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Objection library ({objections.length})</CardTitle>
              <CardDescription>The coach may only cite these ids. A new objection is routed to Voice of Customer.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <ul className="space-y-1 text-xs">
                {objections.map((o) => (
                  <li key={o.id} className="flex gap-2">
                    <span className="w-40 shrink-0 font-mono text-muted-foreground">{o.id}</span>
                    <span>{o.objection}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="se" className="pt-3">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">RFP, security questionnaire, technical questions</CardTitle>
              <CardDescription>One question per line. Answers cite the documents they rely on; a question the documents do not cover is flagged for a human.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Questions</Label>
                  <Button size="sm" variant="ghost" onClick={() => setQuestions(SAMPLE_QUESTIONS)}>
                    Use sample questions
                  </Button>
                </div>
                <Textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={8} className="text-sm" placeholder="Does the model train on our data?" />
              </div>
              <Button disabled={se.busy || !questions.trim()} onClick={() => se.run("sales_engineer", { questions: questions.split("\n").map((q) => q.trim()).filter(Boolean) })}>
                {se.busy ? <Loader2 className="animate-spin" /> : <Sparkles className="text-ai" />} Draft answers
              </Button>
              <DoneLink done={se.done} />
            </CardContent>
          </Card>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Knowledge base ({docs.length})</CardTitle>
              <CardDescription>Product docs, API docs, security policy, consent policy, past RFP answers.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <ul className="space-y-1 text-xs">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="font-normal capitalize">
                      {d.kind}
                    </Badge>
                    <span>{d.title}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function PartnerRunForm({ partners }: { partners: { id: string; name: string; kind: string }[] }) {
  const { busy, done, run } = useRun();
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  return (
    <div className="space-y-2">
      <Label className="text-xs">Partner Agent</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={partnerId} onValueChange={setPartnerId}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {partners.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} <span className="ml-1 text-xs text-muted-foreground">{p.kind.replace(/_/g, " ")}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" disabled={busy || !partnerId} onClick={() => run("partner_agent", { partnerId })}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles className="text-ai" />} Write partner brief
        </Button>
      </div>
      <DoneLink done={done} />
    </div>
  );
}
