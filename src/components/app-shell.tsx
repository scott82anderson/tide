"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Anchor, ClipboardList, FlaskConical, LayoutDashboard, Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DEMO_TODAY, formatDate } from "@/lib/demo-date";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Drafts", icon: ClipboardList },
  { href: "/eval", label: "Eval", icon: FlaskConical },
  { href: "/gtm", label: "Go-to-market", icon: Target },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The owner portal and the public Try-It tool stand outside the back office.
  const isPortal = pathname.startsWith("/portal") || pathname.startsWith("/try");

  if (isPortal) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Anchor className="size-5" />
            <span>DockMaster</span>
            <span className="rounded bg-ai px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ai-foreground">
              Service Writer
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground",
                    active && "bg-white/15 text-primary-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight text-primary-foreground/80 sm:block">
              <div className="font-medium text-primary-foreground">
                Harbourline Marine &amp; Yacht Yard
              </div>
              <div>Demo date: {formatDate(DEMO_TODAY)}</div>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/jobs/new">
                <Plus className="size-4" />
                New job from tech note
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
