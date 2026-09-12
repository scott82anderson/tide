"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { scoreAllAccountsAction } from "@/app/gtm/actions";
import { Button } from "@/components/ui/button";

export function ScoreAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await scoreAllAccountsAction();
          toast.success(res.message);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Target />} Score every account
    </Button>
  );
}
