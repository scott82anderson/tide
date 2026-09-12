"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setConsentAction, setStageAction } from "@/app/gtm/actions";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/gtm/labels";
import type { Stage } from "@/lib/gtm/types";

export function ConsentToggle({ accountId, granted, by }: { accountId: string; granted: boolean; by: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch
        checked={granted}
        disabled={pending}
        onCheckedChange={(v) =>
          startTransition(async () => {
            const res = await setConsentAction(accountId, v, by);
            toast[res.ok ? "success" : "error"](res.message);
            router.refresh();
          })
        }
      />
      <span>Data consent recorded</span>
    </label>
  );
}

export function StageSelect({ accountId, stage, by }: { accountId: string; stage: Stage; by: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground">Stage</Label>
      <Select
        value={stage}
        disabled={pending}
        onValueChange={(v) =>
          startTransition(async () => {
            await setStageAction(accountId, v as Stage, by);
            router.refresh();
          })
        }
      >
        <SelectTrigger size="sm" className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STAGE_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {STAGE_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
