"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmVessel } from "@/app/actions";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Button } from "@/components/ui/button";

export interface CandidateLite {
  id: string;
  name: string;
  score: number;
}

export function VesselConfirm({
  estimateId,
  candidates,
  currentVesselId,
}: {
  estimateId: string;
  candidates: CandidateLite[];
  currentVesselId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2 rounded-lg border border-warning/50 bg-warning-soft p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
        <AlertTriangle className="size-4" /> Confirm the vessel
      </div>
      <p className="text-xs text-warning-foreground/90">
        The match confidence is below 70%. Confirm which boat this estimate is for before it goes any further.
      </p>
      <ul className="space-y-1">
        {candidates.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-sm">
            <span className="flex items-center gap-2">
              <span className="font-medium">{c.name}</span>
              <ConfidenceBadge value={c.score} />
              {c.id === currentVesselId && <span className="text-xs text-muted-foreground">(current)</span>}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await confirmVessel(estimateId, c.id);
                    toast.success(`Vessel confirmed: ${c.name}`);
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not confirm vessel");
                  }
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Confirm
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
