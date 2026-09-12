"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Building2, Headset, Inbox, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/gtm", label: "Console", icon: Target, exact: true },
  { href: "/gtm/accounts", label: "Accounts", icon: Building2 },
  { href: "/gtm/queue", label: "Review queue", icon: Inbox },
  { href: "/gtm/desk", label: "Desk", icon: Headset },
  { href: "/gtm/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/gtm/agents", label: "Agents", icon: Bot },
];

export function GtmNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-2 text-sm">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
            {item.href === "/gtm/queue" && pending > 0 && (
              <span className="rounded-full bg-ai px-1.5 text-[11px] font-medium text-ai-foreground">{pending}</span>
            )}
          </Link>
        );
      })}
      <span className="ml-auto hidden text-xs text-muted-foreground sm:block">Agents draft, people click. No outbound without a named approver.</span>
    </nav>
  );
}
