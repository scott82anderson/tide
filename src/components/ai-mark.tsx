import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Small sparkle shown next to every AI-generated element. */
export function AiMark({ className, label }: { className?: string; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-ai",
            className,
          )}
          aria-label="Drafted by Service Writer, review before sending"
        >
          <Sparkles className="size-3.5" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>Drafted by Service Writer, review before sending</TooltipContent>
    </Tooltip>
  );
}
