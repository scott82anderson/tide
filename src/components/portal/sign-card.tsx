"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { portalDeclineEstimate, portalSignEstimate } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/demo-date";

interface SignedState {
  name: string;
  workOrderNumber: string;
  suggestion: { technician: string; start: string } | null;
}

export function SignCard({ estimateId, total }: { estimateId: string; total: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [signed, setSigned] = useState<SignedState | null>(null);
  const [declined, setDeclined] = useState(false);

  if (signed) {
    return (
      <Card className="border-success/40 bg-success-soft">
        <CardContent className="flex gap-3 pt-6">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Thank you, this estimate is approved.</p>
            <p>
              Signed by {signed.name} on {formatDate(new Date())}. Work order {signed.workOrderNumber} has been
              created; the yard will confirm the schedule.
            </p>
            {signed.suggestion && (
              <p className="text-muted-foreground">
                Proposed slot: {signed.suggestion.technician}, {formatDateTime(signed.suggestion.start)}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (declined) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex gap-3 pt-6 text-sm">
          <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Estimate declined.</p>
            <p>We have let the service team know. They will be in touch if you would like to discuss options.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approve &amp; sign</CardTitle>
        <CardDescription>
          Typing your name below acts as your electronic signature and authorises the yard to carry out the work
          for {total}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sign-name">Full name</Label>
          <Input
            id="sign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dana Patterson"
            disabled={pending}
            className="max-w-sm"
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} disabled={pending} className="mt-0.5" />
          <span>I approve this estimate and authorise the work.</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!name.trim() || !agree || pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const res = await portalSignEstimate(estimateId, name);
                  setSigned({
                    name: name.trim(),
                    workOrderNumber: res.workOrder.number,
                    suggestion: res.suggestion
                      ? { technician: res.suggestion.technician, start: new Date(res.suggestion.start).toISOString() }
                      : null,
                  });
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not sign the estimate");
                }
              })
            }
          >
            {pending && !declining ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Approve &amp; sign
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setDeclining((d) => !d)}>
            Decline
          </Button>
        </div>

        {declining && (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="decline-reason">Tell us why (optional)</Label>
            <Textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="I would like to hold off until the fall haul-out."
              disabled={pending}
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await portalDeclineEstimate(estimateId, reason);
                    setDeclined(true);
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not decline the estimate");
                  }
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Decline estimate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
