import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered filter chip driven by the URL. Used by /jobs and /data. */
export function FilterLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 transition-colors hover:bg-accent",
        active ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "border-border",
      )}
    >
      {children}
      {count !== undefined && <span className="ml-1.5 text-xs tabular-nums opacity-70">{count}</span>}
    </Link>
  );
}
