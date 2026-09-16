"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Pencil, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { reviewQueueItemAction, sendTouchAction } from "@/app/gtm/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApproverRole, QueueStatus } from "@/lib/gtm/types";
import type { TeamMember } from "@/lib/gtm/team";

export function QueueReview({
  itemId,
  status,
  approverRole,
  approvers,
  outputJson,
}: {
  itemId: string;
  status: QueueStatus;
  approverRole: ApproverRole;
  approvers: TeamMember[];
  outputJson: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviewer, setReviewer] = useState(approvers[0]?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(outputJson);
  const [note, setNote] = useState("");

  function decide(decision: Exclude<QueueStatus, "pending">) {
    startTransition(async () => {
      const res = await reviewQueueItemAction(itemId, decision, reviewer, decision === "edited" ? edited : null, note || null);
      if (res.ok) {
        toast.success(res.message);
        setEditing(false);
        router.refresh();
      } else toast.error(res.message);
    });
  }

  if (status !== "pending") {
    return <p className="text-sm text-muted-foreground">This item has been reviewed. Decisions are final; run the agent again for a fresh draft.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Reviewing as ({approverRole})</Label>
          <Select value={reviewer} onValueChange={setReviewer}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Pick a named reviewer" />
            </SelectTrigger>
            <SelectContent>
              {approvers.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  {a.name} <span className="ml-1 text-xs text-muted-foreground">{a.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} placeholder="What you changed or why you rejected it" />
        </div>
      </div>

      {editing && (
        <div className="space-y-1">
          <Label className="text-xs">Edit the draft (JSON). The edit ratio is measured and reported as the agent&apos;s edit rate.</Label>
          <Textarea value={edited} onChange={(e) => setEdited(e.target.value)} rows={14} className="font-mono text-xs" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !reviewer} onClick={() => decide("approved")}>
          {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Approve
        </Button>
        {editing ? (
          <Button variant="secondary" disabled={pending || !reviewer} onClick={() => decide("edited")}>
            <Pencil /> Save edits and approve
          </Button>
        ) : (
          <Button variant="outline" disabled={pending} onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
        )}
        <Button variant="outline" disabled={pending || !reviewer} onClick={() => decide("rejected")} className="text-destructive">
          <XCircle /> Reject
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Agents draft, log and schedule. People click. Nothing here has been sent.</p>
    </div>
  );
}

/** Send buttons for an approved sequence: the human-send rule in one component. */
export function SendTouchButton({ itemId, touchIndex, channel, approvers, sent, enabled }: { itemId: string; touchIndex: number; channel: string; approvers: TeamMember[]; sent: boolean; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const by = approvers[0]?.name ?? "";
  if (sent) return null;
  if (channel === "call") return <span className="text-xs text-muted-foreground">AE makes the call</span>;
  return (
    <Button
      size="sm"
      variant={enabled ? "default" : "outline"}
      disabled={!enabled || pending}
      title={enabled ? `Send as ${by}` : "Approve the sequence first"}
      onClick={() =>
        startTransition(async () => {
          const res = await sendTouchAction(itemId, touchIndex, by);
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Send />} Send {channel}
    </Button>
  );
}
