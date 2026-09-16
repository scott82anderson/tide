import Link from "next/link";
import { Anchor } from "lucide-react";
import { TryItForm } from "@/components/gtm/try-it-form";
import { isAiConfigured } from "@/lib/ai/anthropic";
import { NOTE_1_TRANSCRIPT } from "@/lib/ai/fixtures/note-1";
import { ONE_LINER } from "@/lib/gtm/brand-voice";
import { getGtmClient } from "@/lib/gtm/prisma-client";
import { latestQueueItem, effectiveOutput } from "@/lib/gtm/agents/crm-reads";
import type { SandboxSpec } from "@/lib/gtm/agents/demo-builder";

export const dynamic = "force-dynamic";

/**
 * The product-led entry: the free "Estimate from a tech note" tool. Public,
 * outside the back-office shell. With ?account=, the page is the sandbox the
 * Demo Builder seeded for that prospect.
 */
export default async function TryPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account: accountId } = await searchParams;
  const gtm = getGtmClient();
  const account = accountId ? await gtm.getAccount(accountId) : null;
  const sandboxItem = account ? await latestQueueItem(gtm, account.id, "sandbox") : null;
  const sandbox = sandboxItem ? effectiveOutput<SandboxSpec>(sandboxItem) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Anchor className="size-5" />
          <span className="font-semibold tracking-tight">DockMaster</span>
          <span className="rounded bg-ai px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ai-foreground">Service Writer</span>
          <Link href="/gtm" className="ml-auto text-xs text-primary-foreground/70 hover:text-primary-foreground">
            back office
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{ONE_LINER}</h1>
          <p className="max-w-2xl text-muted-foreground">
            Paste a technician&apos;s note the way they actually talk. In about fifteen seconds you get a draft estimate: the boat matched, operation codes chosen from the catalogue, hours from the labour standards, parts from the kit. Then see it against your own codes.
          </p>
          {account && (
            <p className="rounded-md border border-ai/40 bg-ai-soft px-3 py-2 text-sm">
              This sandbox was set up for <span className="font-medium">{account.name}</span>
              {sandbox ? ` with ${sandbox.catalogue.length} operation codes seeded from ${sandbox.seededFrom === "account_codes" ? "your own catalogue" : "the public sample yard"}.` : ". The catalogue is the public sample yard until your codes are loaded."}
            </p>
          )}
        </div>
        <TryItForm accountId={account?.id ?? null} accountName={account?.name ?? null} sampleNote={sandbox?.walkthrough.sampleTechNote ?? NOTE_1_TRANSCRIPT} recordedNote={NOTE_1_TRANSCRIPT} aiConfigured={isAiConfigured()} />
        <p className="text-xs text-muted-foreground">
          The sample yard is fictional. Notes you paste are used to draft the estimate you see and, if you leave your details, to prepare for a call. Nothing is sent to anyone without a person choosing to send it.
        </p>
      </main>
    </div>
  );
}
