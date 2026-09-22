import type { Metadata } from "next";
import Link from "next/link";
import {
  Anchor,
  ArrowRight,
  Database,
  ExternalLink,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Presentation,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ONE_LINER } from "@/lib/gtm/brand-voice";

export const metadata: Metadata = {
  title: "Start here | DockMaster Service Writer",
  description: "Entry point for presenting the DockMaster Service Writer case: deck, one-pager and the working prototype.",
};

const DECK = "/docs/DockMaster_AI_Opportunity_Service_Writer.pptx";
const ONE_PAGER_PDF = "/docs/DockMaster_Service_Writer_GTM_OnePager.pdf";
const ONE_PAGER_DOCX = "/docs/DockMaster_Service_Writer_GTM_OnePager.docx";

const PROTOTYPE_ROUTES = [
  {
    href: "/",
    icon: LayoutDashboard,
    label: "Service desk",
    detail: "Draft queue, this week's scheduler, vessels due for service, overdue AR.",
  },
  {
    href: "/jobs/new",
    icon: Sparkles,
    label: "New job from tech note",
    detail: "Play sample note 1, draft the estimate, review, approve, send for eSign.",
  },
  {
    href: "/eval",
    icon: FlaskConical,
    label: "Golden-set evaluation",
    detail: "Fifteen technician notes scored on vessel match and operation recall.",
  },
  {
    href: "/data",
    icon: Database,
    label: "Seeded DockMaster records",
    detail: "Operation codes, kits, vessels, customers, work orders and invoices behind every draft.",
  },
  {
    href: "/gtm",
    icon: Target,
    label: "Go-to-market console",
    detail: "Fourteen selling agents, one review queue, a named human before every send.",
  },
  {
    href: "/try",
    icon: Wrench,
    label: "Free tool: estimate from a tech note",
    detail: "The public, product-led entry outside the back office.",
  },
];

const DEMO_STEPS = [
  "Open the deck. Slides 2 to 6 set the situation, the moat, the market and the opportunity map. Slide 7 lands on the Service Writer.",
  "Switch to the prototype. Draft sample note 1 (the Sea Ray overheat), edit one line, approve, sign as the owner, watch it land on the scheduler.",
  "Show the side panels: due-for-service outreach and an overdue AR reminder. Nothing leaves without a click.",
  "Back to the deck for go-to-market, agents, packaging, roadmap and risks. Open the GTM console if the room wants to see the agents run.",
  "Leave the one-pager behind. It carries the positioning, packaging and the 12-month roadmap on a single page.",
];

const EVAL_ROWS = [
  { metric: "Vessel match", result: "15 / 15", target: "14 / 15" },
  { metric: "Operation recall (mean)", result: "0.96", target: "0.85" },
  { metric: "Operation precision (mean)", result: "1.00", target: "" },
  { metric: "Mean latency, steps 2 to 5", result: "10.4 s", target: "" },
];

export default function StartPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Anchor className="size-5" />
          <span className="font-semibold tracking-tight">DockMaster</span>
          <span className="rounded bg-ai px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ai-foreground">
            Service Writer
          </span>
          <Link href="/" className="ml-auto text-xs text-primary-foreground/70 hover:text-primary-foreground">
            open the prototype
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Valsoft AI Venture Builder case study · Scott Anderson · September 2026
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            AI opportunities at DockMaster
          </h1>
          <p className="max-w-3xl text-lg text-foreground/90">{ONE_LINER}</p>
          <div className="max-w-3xl space-y-3 text-muted-foreground">
            <p>
              DockMaster is the marina and boatyard system of record in the Valsoft portfolio: 40 years of
              operation codes, labour standards, parts usage and vessel histories across 1,000+ sites. The
              estimate is where a yard turns a technician&apos;s observation into revenue, and it is the slowest,
              most manual step in the service workflow.
            </p>
            <p>
              The Service Writer closes that loop inside the system of record. A technician records a voice
              note and photos. The AI matches the vessel, picks operation codes, pulls the parts kit and
              flags history. The service manager reviews and approves, the owner eSigns in the portal, and the
              work order hands off to the AI Scheduling Assistant and Blu that DockMaster already ships.
              Release 2 finds the next job (vessels past interval), release 3 gets it paid (collections via
              ValPay).
            </p>
            <p>
              The go-to-market thesis is to sell every marina its own money: with consent, the pitch is computed
              from each account&apos;s own work orders, invoices and vessel histories, drafted by agents, and
              sent by a named person. The AI assists. Staff stays in control.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">The materials</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="gap-4 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center gap-2">
                  <Presentation className="size-4 text-ai" />
                  The deck
                </CardTitle>
                <CardDescription>
                  Fifteen slides: situation, what DockMaster has, market, ideal customer, opportunity map, the
                  Service Writer, prototype, go-to-market, agents, packaging, roadmap, risks.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto px-5">
                <Button asChild className="w-full">
                  <a href={DECK} download>
                    Download PowerPoint
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="gap-4 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4 text-ai" />
                  The one-pager
                </CardTitle>
                <CardDescription>
                  Positioning, ideal customer, packaging, motions and channels, the selling agents and the
                  12-month roadmap from October 2026 to September 2027. The leave-behind.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-2 px-5">
                <Button asChild className="w-full">
                  <a href={ONE_PAGER_PDF} target="_blank" rel="noopener">
                    Open PDF
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href={ONE_PAGER_DOCX} download>
                    Download Word
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="gap-4 border-ai/40 bg-ai-soft/40 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-ai" />
                  The prototype
                </CardTitle>
                <CardDescription>
                  A working Service Writer on a realistic mock of DockMaster&apos;s data, with the GTM agent
                  workspace alongside it. Live Claude calls, deterministic pricing, a human click before every
                  send.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto px-5">
                <Button asChild className="w-full">
                  <Link href="/">
                    Open the prototype
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Suggested order for the room</h2>
            <ol className="space-y-3">
              {DEMO_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              The demo date is fixed at Monday 14 September 2026, so every screen reads the same on any day.
              Sample note 1 drafts without an API key from recorded model output. Everything else runs live.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">What the prototype proves</h2>
            <Card className="gap-3 py-4">
              <CardHeader className="px-5">
                <CardDescription>
                  Golden set of 15 technician notes, run 12 September 2026 on Claude Sonnet 4.6.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 text-left font-medium">Metric</th>
                      <th className="pb-2 text-right font-medium">Result</th>
                      <th className="pb-2 text-right font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EVAL_ROWS.map((row) => (
                      <tr key={row.metric} className="border-t">
                        <td className="py-2">{row.metric}</td>
                        <td className="py-2 text-right font-medium tabular-nums">{row.result}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">{row.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">
                  The model only selects from candidates the database returned. It never invents a vessel, a
                  code, a part or a price.{" "}
                  <Link href="/eval" className="text-primary underline-offset-2 hover:underline">
                    Full results
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Prototype entry points</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROTOTYPE_ROUTES.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className="group flex gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <route.icon className="mt-0.5 size-4 shrink-0 text-ai" />
                <span className="space-y-1">
                  <span className="block text-sm font-medium group-hover:underline group-hover:underline-offset-2">
                    {route.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{route.detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-primary px-6 py-8 text-primary-foreground">
          <p className="text-xl font-semibold tracking-tight sm:text-2xl">
            Write it faster. Find more of it. Collect it sooner.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-primary-foreground/80">
            The Service Writer turns DockMaster&apos;s 40 years of service data into revenue for its customers,
            migration to Web for the business, and a standalone product for Valsoft.
          </p>
        </section>
      </main>
    </div>
  );
}
