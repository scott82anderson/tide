# DockMaster Service Writer (prototype)

A clickable prototype of an AI feature for DockMaster, the marina and boatyard management system in the Valsoft portfolio.

**What it does.** A technician records a voice note and photos about a boat. The Service Writer drafts an estimate from the yard's own operation codes, labour standards, parts catalogue and vessel history. The service manager reviews, edits and approves. The estimate goes to the boat owner for eSign, converts to a work order and lands on the scheduler with a suggested slot from the AI Scheduling Assistant. Two side panels turn the same machinery outward: vessels due for service get a proactive estimate and a short outreach message, and overdue invoices get a tone-appropriate reminder with a ValPay link.

**Design principle (DockMaster's own words): the AI assists, staff stays in control.** Every AI output is a draft with a confidence indicator. Nothing is sent to a customer without a human click.

## Why this opportunity

The estimate is the moment a yard turns a technician's observation into revenue, and it is the slowest, most manual step in the service workflow: the tech scribbles or dictates, a writer looks up codes and parts, someone checks history, someone prices it, and the owner waits. DockMaster already holds every input the writer needs (codes, standards, kits, stock, history, AR). The Service Writer closes the loop inside the system of record instead of bolting a chatbot on the side, and it hands off to the two AI features DockMaster already ships (the Scheduling Assistant and the Blu Voice Agent) rather than duplicating them.

## Run it

```bash
pnpm install
cp .env.example .env      # add ANTHROPIC_API_KEY (OPENAI_API_KEY optional)
pnpm db:reset             # push schema to prisma/dev.db and seed demo data
pnpm dev                  # http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, the bundled sample note still drafts from recorded model output (clearly labelled), so the demo path works end to end. Live drafting of any other note, outreach, reminders and the eval need the key. Without `OPENAI_API_KEY`, transcription falls back to paste mode with a visible notice; the sample notes ship as text so the demo never depends on a microphone.

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm db:reset` | Recreate and seed the local SQLite database |
| `pnpm demo:draft` | Create the sample note 1 draft from recorded model output (no key needed) |
| `pnpm draft --sample 1` | Run the drafting pipeline on a bundled sample (1, 2 or 3) and print JSON |
| `pnpm eval` | Run the 15-case golden set through steps 2 to 5 and write `src/lib/eval/eval-results.json` |
| `pnpm smoke` | Playwright walk-through of the demo storyline against a running dev server, with screenshots |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | Quality gates (tests never call the API) |

## Demo script (five minutes)

The demo date is Monday, 14 September 2026. Every screen uses `DEMO_TODAY`, never the wall clock.

1. Open `/`. The Service Manager dashboard for Harbourline Marine & Yacht Yard: draft queue, this week's scheduler, vessels due for service, overdue invoices, recent activity.
2. Click **New job from tech note**. Technician defaults to Marcus Reyes. Under Sample notes, play note 1 (Sea Ray overheat) and click **Use this note**. The transcript loads into the editable textarea and both bundled photos are attached.
3. Click **Draft estimate**. Progress steps: Transcribing, Reading note, Matching vessel, Matching operations, Pricing, Writing. About ten seconds live.
4. The draft review opens. Matched vessel: Reel Therapy, 2019 Sea Ray 400 Sundancer, HIN ending 4471, owner Dana Patterson, slip C-12, confidence high ("HIN ends in 4471; Location Slip C-12 matches; ..."). Four operation lines with codes, standard hours, rate, the technician words that drove each match, a confidence badge, and the kit parts beneath each with on-hand quantity and an out-of-stock warning on the sea water pump. History flag: last impeller replacement 26 months ago (WO-2024-0311), manufacturer interval 24 months. A banner links to the second, separate draft for the trim tab actuator, "quoted separately per technician". Expand the **AI reasoning** panel to show what was extracted and why each line was chosen.
5. Change the raw water pump line from 3.5 to 3.0 hours, click **Save changes**, then **Approve draft**. Status becomes *Estimate: awaiting customer* and every line flips from AI to Staff.
6. Click **Send for eSign**. The owner's view opens at `/portal/estimates/[id]`: plain-language lines, no jargon, no codes. Type a name, tick the authorisation box, click **Approve & sign**. Status becomes *Work order*.
7. Back on the dashboard the new work order sits on the scheduler with a teal, sparkle-marked suggested slot from the Scheduling Assistant (next open block for a technician with the engine skill). Accept or reject it.
8. **Due for service** panel: seven vessels past an interval. Click **Draft outreach** on one. A priced estimate is created from the operation code and kit, and a short SMS and email are drafted for review. Nothing is sent until you click.
9. **Overdue invoices** panel: six accounts from 9 to 92 days past due. Click **Send payment reminder**. The tone follows the age (friendly under 30 days, firm 30 to 60, final over 60), a simulated ValPay link is generated, and the send is logged.
10. Open `/eval` for the golden set results.
11. Open `/data` to browse the records everything above was drawn from: operation codes with their parts kits, vessels, customers, parts, technicians, work orders and invoices. Search, facet and sort run in the browser; the URL carries the view.

## Architecture

```
                  Technician                         Service manager                 Boat owner
                  voice note + photos                reviews, edits, approves        eSigns in portal
                        |                                   |                             |
                        v                                   v                             v
   +----------------------------------------------------------------------------------------------+
   |  Next.js 15 App Router (server components, server actions, route handlers)                   |
   |                                                                                              |
   |   /jobs/new  ---> POST /api/draft (NDJSON progress) ---> /jobs/[id] ---> /portal/estimates   |
   |   /            dashboard: queue, scheduler strip, due-for-service, overdue AR, activity      |
   |   /eval        golden set results                                                            |
   |   /data        browse and filter the seeded DockMaster records (same client, read-only)      |
   +---------------------------------------+------------------------------------------------------+
                                           |
                     +---------------------+---------------------+
                     |            lib/ai (pure, no Prisma)       |
                     |                                           |
      Whisper -----> | 2 extract findings      (Claude, tool use)|
      or paste       | 3 match vessel          (rules, then Claude on a shortlist)
                     | 4 match operations      (keyword shortlist, then Claude picks from it)
                     | 5 build estimate        (deterministic: hours, rate, kit, stock, history)
                     | 6 narrative             (Claude: plain language per line)
                     |   outreach, reminders   (reuse 5 and 6)                  |
                     +---------------------+---------------------+
                                           |  DockMasterClient (the API boundary)
                                           v
                     +---------------------------------------------+
                     |  PrismaDockMasterClient (mock)              |     production:
                     |  SQLite locally, Postgres on Vercel          | --> HttpDockMasterClient
                     |  marina, technicians, customers, vessels,    |     DockMaster Web 2.0 API
                     |  operation codes, kits, parts, work orders,  |     (mapping in client.ts)
                     |  estimates, invoices, activity, schedule     |
                     +---------------------------------------------+
```

`src/lib/dockmaster/client.ts` is the architectural statement: every read and write goes through `DockMasterClient`, and its header comment maps each method to the DockMaster Web 2.0 endpoint a production implementation would call. Nothing under `src/lib/ai` imports Prisma.

Every model call is one forced tool call with a JSON schema derived from zod (`src/lib/ai/anthropic.ts`). The model fills in a structured object; we validate it; we never parse free text. The model only ever chooses from lists the client returned (candidate vessels, shortlisted codes), so it cannot invent a vessel, a code, a part number or a price.

## Guardrails

- **Source of truth.** Codes, hours, rates, parts, stock and history come from the database. The model selects and explains; it never prices.
- **Shortlist only.** Vessel and operation choices are validated against the shortlist the model was shown. A code outside it is rejected and logged, and the line becomes an unmapped item for the manager to price.
- **Confidence badges.** High (85% and up), medium (60 to 85), low (under 60). Low-confidence lines are unchecked by default and must be explicitly included.
- **AI vs staff ownership.** Every line carries `source: ai` until it is edited or the draft is approved, then `source: staff`. Every AI-generated element shows a sparkle with the tooltip "Drafted by Service Writer, review before sending".
- **Hard rule.** Nothing is sent to a customer without a staff action. Send buttons are disabled while the status is `draft_ai`; the server action refuses too.
- **Role scoping.** `src/lib/ai/allowed-codes.json` mirrors Blu's per-role scoping. Codes outside a technician's scope are drafted but flagged "needs manager review" and left unchecked.
- **Technician hours.** A spoken time estimate is used when it is within 50% of the standard, otherwise the standard is used and the line is flagged.
- **Manager approval.** Any estimate over $5,000 shows a "requires manager approval" banner.
- **Vessel confirmation.** Below 70% confidence the manager confirms from a shortlist before pricing.
- **Errors.** One retry on Anthropic errors and on schema validation misses, then a friendly message with a retry button. Pages never crash.
- **Audit.** Every pipeline step (input, output, latency) and every staff and customer action is written to the activity log; the reasoning panel reads from the same trace.

## Evaluation

`src/lib/eval/golden-set.json` holds 15 technician notes: clear cases, ambiguous vessel hints (two owners with two boats each, six Sea Rays), slang ("the lower unit is toast"), multi-system notes, one note with nothing actionable, and one vessel that is not in the system. `pnpm eval` runs steps 2 to 5 (no transcription, no narrative) and reports vessel match accuracy, operation set precision and recall, separate-estimate accuracy and mean latency. `/eval` renders the last results file. Targets for the demo: vessel match 14 of 15 or better, operation recall 0.85 or better.

Results are written to `src/lib/eval/eval-results.json` and committed so the deployed `/eval` page shows the last run.

Last run (Claude Sonnet 4.6, 12 September 2026):

| Metric | Result | Target |
| --- | --- | --- |
| Vessel match | 15 / 15 | 14 / 15 |
| Operation recall (mean) | 0.96 | 0.85 |
| Operation precision (mean) | 1.00 | |
| Separate-estimate detection | 15 / 15 | |
| Cases passed (vessel right, recall 1.0, precision at least 0.75, separate flag right) | 13 / 15 | |
| Mean latency, steps 2 to 5 | 10.4 s | |

The two misses are both recall, not precision, and both are judgement calls rather than errors: in the Grady-White note the model folded "clean up and re-end the cables" into the battery replacement instead of raising the separate terminal-service code, and in the Catalina note it treated the rig inspection the technician had already performed as context rather than a billable line. Neither invented a code. A production build would add these as explicit extraction rules ("work already performed is a line") and re-run.

## What is simulated vs real

| Real | Simulated |
| --- | --- |
| Claude Sonnet 4.6 calls for extraction, vessel ranking, operation matching, narrative, outreach and reminders | The DockMaster API: `PrismaDockMasterClient` reads a seeded database instead of DockMaster Web 2.0 |
| Whisper transcription when `OPENAI_API_KEY` is set | Sample note 1 audio is text-to-speech; with no key the bundled sample drafts from recorded model output |
| Deterministic pricing, kit lookup, stock warnings, interval flags, role scoping, totals | eSignature: the portal page stands in for DockMaster's eSign flow |
| Activity log of every AI and staff action | ValPay: payment links are `https://pay.example/valpay/{token}` and are logged, not sent |
| Zod-validated structured output on every model call | Scheduling Assistant: `suggest-slot.ts` approximates its answer (next open block for a skilled technician) |
| | Sending: outreach and reminders are logged as sent, no email or SMS leaves the system |
| | Auth, multi-tenancy, billing, production hardening: deliberately out of scope |

## Next steps for a production build

1. **Bind to DockMaster.** Implement `HttpDockMasterClient` against the Web 2.0 API using the mapping in `client.ts`, with OAuth client credentials and tenant scoping. The pipeline and UI do not change.
2. **Mobile capture.** Move intake into the offline-first Mobile app: record, photograph, queue, sync. Transcribe server-side on sync.
3. **Vision.** The extraction call already accepts photos; add a focused prompt so the model cross-checks the transcript against what the photo shows (for example, count missing vanes) and flags disagreements.
4. **Learn from edits.** Log every manager edit against the AI line and use the delta (hours changed, code swapped, line removed) as an evaluation signal and, later, as few-shot examples per yard.
5. **Parts intelligence.** Substitute parts when the kit item is out of stock, using `fitsEngineMakes` and supplier lead times; surface the lead time in the estimate.
6. **Scheduling hand-off.** Replace `suggest-slot.ts` with a call to the real AI Scheduling Assistant and let the owner see the proposed date in the portal.
7. **Evaluation at scale.** Grow the golden set from real closed work orders (tech note in, approved estimate out) and gate deployments on it.
8. **Hardening.** Rate limits, idempotent drafting, prompt caching for the catalogue, per-tenant cost tracking, PII handling in transcripts.

## Layout

```
src/
  app/                 pages, server actions, route handlers (/data browses the seeded records)
  components/          shadcn-based UI (dashboard, intake, review, portal, data browser)
  lib/dockmaster/      client.ts (interface), mock-client.ts (Prisma), types.ts, match-rules.ts
  lib/data-browser/    entity registry, row serialisers, pure filter/sort/URL-state helpers for /data
  lib/ai/              anthropic.ts, schemas.ts, extract, match-vessel, match-operations, build-estimate, narrative, pipeline, outreach, reminders
  lib/transcribe/      Transcriber interface, whisper.ts, paste.ts
  lib/scheduling/      suggest-slot.ts
  lib/eval/            golden-set.json, run.ts, eval-results.json
prisma/                schema.prisma, seed.ts, seed-data/
public/samples/        sample audio, transcripts, photos
scripts/               draft, demo-draft, eval, smoke, vercel-build
```

## Go-to-market workspace

The companion GTM document ("sell every marina its own money") describes fourteen Claude-based agents that do the selling while people own relationships, approvals and sends. The prototype implements that stack under `/gtm`, on the same database and the same architectural rules as the Service Writer: one client boundary, structured model calls, shortlist-only validation, a human click before anything leaves.

**Demo path (five minutes)**

1. `/gtm`: the console. Funnel counts, the ranked target list from the Opportunity Scout, the review queue, the phase plan.
2. `/gtm/accounts/acc_bayhaven`: a design partner. The Scout report is the "Revenue Left on the Dock" sentence built from the account's own numbers, with every figure linked to the query that produced it and every recovery rate labelled as an assumption. Click **Run Researcher**: the cheap model classifies the seeded public signals (a new service manager, two slow-quote reviews) into triggers, each citing its signal id. Click **Draft sequence**: the strong model writes three touches with the account's numbers; a deterministic lint checks brand voice, appends the opt-out line and rejects any number that does not link back to a Scout figure.
3. `/gtm/queue/[id]`: the review queue. Approve, edit (the edit is measured as the agent's edit rate) or reject as a named person. On a sequence, the **Send** buttons stay disabled until it is approved. Call scripts are never sent.
4. `/try`: the free "Estimate from a tech note" tool, outside the back office. Paste a note, get a draft from the product pipeline against the public sample yard, leave your details and a Try-It lead lands on the queue for Marketing. `/try?account=acc_bayhaven` is the sandbox the Demo Builder seeded for that prospect.
5. `/gtm/desk`: paste the sample call transcript and the Objection Coach matches "we tried voice-to-text and it was junk" to the library with the golden-set answer. The Sales Engineer answers RFP questions citing only the knowledge documents and flags what it cannot answer.
6. `/gtm/accounts/acc_northstar` (**Score health**): the Adoption Agent, deterministic, shows the edit rate falling from 40% to 12% and flags the Revenue Suite upsell because AR days are 49. `/gtm/accounts/acc_pelican_point` (**Plan onboarding**): the Onboarding Agent finds the duplicate codes in a messy export; approving the plan is the one write to DockMaster any GTM agent makes. `/gtm/accounts/acc_bh_hilton_head`: the cross-site league table for a PE-backed group.
7. `/gtm/metrics` and `/gtm/agents`: the weekly metrics (funnel, agent quality, product value, business) and the roster with model tier, owner and guardrails.

**Agents** (`src/lib/gtm/agents/`). Each is an `AgentDefinition` with a job, inputs, output, a named approver and a model tier. The runner (`runner.ts`) reads the CRM record first, runs the agent, records the run with inputs and outputs (including blocked and failed runs), puts the output on the queue and appends a line to the account's context file.

| Agent | Model | What it does in the prototype |
| --- | --- | --- |
| Opportunity Scout | none | Computes the report per account. Harbourline reads live through the `DockMasterClient`; other consented accounts read the warehouse extract on the CRM record; accounts without consent get public signals and a low-confidence label. |
| Account Researcher | cheap | Classifies seeded public signals into triggers and decision makers; every claim cites a signal id, unknown ids are dropped. |
| Sequencer | strong | Three touches from the account's numbers and triggers, linted (hype, exclamation marks, length, opt-out line, truth in numbers), one redraft on failure. SMS only with opt-in. |
| Demo Builder | strong | Picks a catalogue from the prospect's vessel mix and writes a 90-second walkthrough plus a sample tech note for the Try-It page. |
| Try-It Concierge | strong | Runs the product pipeline on a pasted note; a lead becomes an account and a queue item. Works without a key on the bundled sample. |
| Sales Engineer | strong | Answers from `knowledge.ts`, cites document ids, flags gaps for a human. |
| Deal Desk | strong | Deterministic pricing and discount policy (`pricing.ts`), ROI from the Scout figures, a linted narrative. Discounts above the Finance ceiling are refused. |
| Objection Coach | strong | Matches transcript objections to `objection-library.ts`; a new objection is routed to Voice of Customer. |
| Onboarding Agent | cheap | Duplicate candidates by token overlap, merges confirmed by the model, keywords, kits, checklist, training plan. Merges apply after CSM approval. |
| Adoption Agent | none | Health score, nudges, expansion triggers and churn risk from weekly telemetry. |
| Proof Agent | strong | Case study from before-and-after telemetry, only with consent, numbers linted. |
| Voice of Customer | cheap | Groups feedback into themes; revenue at stake is the sum of Scout totals behind each theme. |
| Conference Concierge | strong | Ranks registered accounts, books Open Lab slots, writes talking points. |
| Partner Agent | strong | Partner brief, co-marketing ideas, lead routing. |

Model routing: `MODEL_STRONG` is the project's `claude-sonnet-4-6`, `MODEL_CHEAP` is `claude-haiku-4-5` (`src/lib/ai/anthropic.ts`).

**Guardrails**, in code. Consent first (the Scout checks `dataConsent` before touching account data). Human send (`sendTouchAction` refuses unless the queue item is approved and a named person is sending). Compliance (opt-out line appended deterministically, no SMS without opt-in, call scripts never sent). Truth in numbers (`style-lint.ts` extracts every dollar and count in a draft and matches it to a `SourceQuery` the agent was given). Discount policy. Brand voice lint. Audit (every run to `AgentRun`). Shortlist only (signal, document, objection and code ids validated against the list shown).

**Scripts**: `pnpm gtm:scout` scores every account through the runner (no model). `pnpm gtm:smoke` walks the path above in Playwright against a running dev server.

**Simulated**: the CRM, warehouse extract, telemetry and public signals are seeded tables behind `GtmClient` (`src/lib/gtm/client.ts` maps each method to HubSpot or Salesforce, the DockMaster warehouse and the telemetry warehouse). Sending is logged, not sent. Deliverability, sending domains and the real sequencing tool are out of scope.

## Deployment

The project deploys to Vercel with Neon Postgres. `scripts/vercel-build.sh` switches the Prisma datasource provider to `postgresql` (the one-line change the schema was written for), pushes the schema, reseeds the demo data on every deploy, then runs `next build`. Environment: `DATABASE_URL` (from the Neon integration), `ANTHROPIC_API_KEY`, optionally `OPENAI_API_KEY`.
