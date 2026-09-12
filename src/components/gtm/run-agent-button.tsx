"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { runAgentAction } from "@/app/gtm/actions";
import { Button } from "@/components/ui/button";
import type { AgentKey } from "@/lib/gtm/types";

export function RunAgentButton({
  agent,
  input,
  label,
  variant = "outline",
  size = "sm",
  goToQueue = false,
  disabled,
  className,
}: {
  agent: AgentKey;
  input: Record<string, unknown>;
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default";
  /** Navigate to the queue item after a successful run. */
  goToQueue?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await runAgentAction(agent, input);
      if (res.ok) {
        toast.success(res.message);
        if (goToQueue && res.queueItemId) router.push(`/gtm/queue/${res.queueItemId}`);
        else router.refresh();
      } else if (res.blocked) {
        toast.warning(res.message, { duration: 8000 });
        router.refresh();
      } else {
        toast.error(res.message, { duration: 8000 });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} disabled={busy || disabled} onClick={run} className={className}>
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles className="text-ai" />}
      {label}
    </Button>
  );
}
