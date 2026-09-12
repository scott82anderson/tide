/**
 * Demo Builder: spins up a personalised sandbox. The catalogue is chosen
 * deterministically from the prospect's vessel mix (their operation codes when
 * they are a customer, the public sample otherwise); the strongest model writes
 * a 90-second walkthrough narrated with their Scout numbers and a sample tech
 * note in their world for the Try-It page.
 */

import { MODEL_STRONG } from "@/lib/ai/anthropic";
import type { OperationCode } from "@/lib/dockmaster/types";
import { BRAND_VOICE } from "../brand-voice";
import { WalkthroughSchema, type Walkthrough } from "../schemas";
import { lintCopy } from "../style-lint";
import type { Account, VesselType } from "../types";
import { latestScout } from "./crm-reads";
import { fig, requireAi, type AgentDefinition, type AgentResult } from "./framework";

const SYSTEM = `${BRAND_VOICE}

You write a 90 second recorded walkthrough of the Service Writer for one prospect, and one sample technician voice note in their world. The walkthrough shows: a technician note, the drafted estimate with the boat matched and the yard's own codes, the manager approving one edit, the owner signing on their phone, and the job landing on the scheduler. Use the account's figures exactly as given and only where they fit. The sample note should sound like a real technician talking: informal, one or two findings, a slip or rack location, a hull number ending, maybe a time estimate.`;

const NORTHERN = new Set(["NY", "CT", "MA", "RI", "ME", "NH", "VT", "MI", "WI", "MN", "IL", "OH", "WA", "OR", "MD", "NJ", "PA"]);

const CATEGORIES_FOR: Record<VesselType, string[]> = {
  sail: ["rigging", "canvas", "hull", "engine", "plumbing"],
  outboard: ["engine", "electrical", "hull", "drive"],
  sterndrive: ["engine", "drive", "hydraulics", "electrical", "hull"],
  inboard: ["engine", "plumbing", "hydraulics", "electrical", "hull"],
};

export function selectCatalogue(codes: OperationCode[], mix: VesselType[], state: string, max = 12): OperationCode[] {
  const wanted = new Set<string>(["haul", "detailing"]);
  for (const m of mix.length ? mix : (["outboard", "sterndrive"] as VesselType[])) CATEGORIES_FOR[m].forEach((c) => wanted.add(c));
  if (NORTHERN.has(state)) wanted.add("winterisation");
  const out: OperationCode[] = [];
  const perCategory = new Map<string, number>();
  for (const c of [...codes].sort((a, b) => a.code.localeCompare(b.code))) {
    if (!wanted.has(c.category)) continue;
    const n = perCategory.get(c.category) ?? 0;
    if (n >= 2) continue;
    perCategory.set(c.category, n + 1);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

export interface DemoInput {
  accountId: string;
}

export interface SandboxSpec {
  sandboxUrl: string;
  seededFrom: "account_codes" | "public_sample";
  vesselMix: VesselType[];
  catalogue: { code: string; description: string; category: string; standardHours: number }[];
  walkthrough: Walkthrough;
  totalSeconds: number;
}

export const demoBuilder: AgentDefinition<DemoInput, SandboxSpec> = {
  key: "demo_builder",
  name: "Demo Builder",
  job: "Spin up a personalised sandbox",
  inputs: "Prospect's operation codes (if a customer) or a public sample; their vessel types",
  output: "A live Service Writer environment seeded with their world, plus a 90-second recorded walkthrough narrated with their numbers",
  owner: "AE",
  modelTier: "strong",
  needsAccount: true,
  async run(ctx, _input, account): Promise<AgentResult<SandboxSpec>> {
    const ai = requireAi(ctx);
    const acct: Account = account!;
    const t0 = Date.now();
    const [codes, scout, ownCodes] = await Promise.all([
      ctx.dockmaster.listOperationCodes(),
      latestScout(ctx.gtm, acct.id),
      ctx.gtm.listAccountCodes(acct.id),
    ]);
    const catalogue = selectCatalogue(codes, acct.vesselMix, acct.state);
    const seededFrom = ownCodes.length > 0 ? "account_codes" : "public_sample";
    const sandboxUrl = `/try?account=${acct.id}`;
    // The walkthrough may quote the Scout figures and the standard hours of the codes in the sandbox.
    const figures = [
      ...(scout?.report.figures ?? []).filter((f) => f.value > 0),
      ...catalogue.map((c) => fig(`std_${c.code}`, `${c.code} standard hours`, c.standardHours, "hours", "DockMasterClient.listOperationCodes().standardHours")),
    ];
    const notes: string[] = [];
    if (!scout) notes.push("No Scout report yet: walkthrough narrated without the account's numbers.");
    if (seededFrom === "public_sample") notes.push("Prospect has no exported codes: sandbox uses the public sample catalogue, labelled as such on the Try-It page.");

    const { output, latencyMs, model } = await ai.call({
      name: "write_walkthrough",
      description: "Write the walkthrough script and a sample technician note.",
      system: SYSTEM,
      model: MODEL_STRONG,
      maxTokens: 2500,
      schema: WalkthroughSchema,
      user: JSON.stringify(
        {
          account: { name: acct.name, city: acct.city, state: acct.state, vesselMix: acct.vesselMix, platform: acct.platform },
          figures: figures.map((f) => ({ label: f.label, value: f.value, unit: f.unit })),
          catalogue: catalogue.map((c) => ({ code: c.code, description: c.description })),
          seededFrom,
          targetSeconds: 90,
        },
        null,
        2,
      ),
    });

    const lint = lintCopy(output.scenes.map((s) => s.narration).join("\n"), { figures });
    if (!lint.ok) notes.push(...lint.issues.map((i) => `Narration lint: ${i.message}`));
    const totalSeconds = output.scenes.reduce((s, x) => s + x.seconds, 0);

    return {
      output: {
        sandboxUrl,
        seededFrom,
        vesselMix: acct.vesselMix,
        catalogue: catalogue.map((c) => ({ code: c.code, description: c.description, category: c.category, standardHours: c.standardHours })),
        walkthrough: output,
        totalSeconds,
      },
      sourceQueries: figures,
      steps: [
        { step: "select_catalogue", latencyMs: Date.now() - t0 - latencyMs },
        { step: "write_walkthrough", latencyMs, model },
      ],
      queue: {
        kind: "sandbox",
        title: `Sandbox: ${acct.name} (${catalogue.length} codes, ${totalSeconds}s walkthrough)`,
        sourceData: { scoutQueueItemId: scout?.item.id ?? null, catalogueCodes: catalogue.map((c) => c.code) },
      },
      contextLine: `Demo Builder seeded a sandbox from the ${seededFrom === "account_codes" ? "account's own codes" : "public sample"} with ${catalogue.length} codes and a ${totalSeconds}s walkthrough`,
      notes,
    };
  },
};
