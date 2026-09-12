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
  app/                 pages, server actions, route handlers
  components/          shadcn-based UI (dashboard, intake, review, portal)
  lib/dockmaster/      client.ts (interface), mock-client.ts (Prisma), types.ts, match-rules.ts
  lib/ai/              anthropic.ts, schemas.ts, extract, match-vessel, match-operations, build-estimate, narrative, pipeline, outreach, reminders
  lib/transcribe/      Transcriber interface, whisper.ts, paste.ts
  lib/scheduling/      suggest-slot.ts
  lib/eval/            golden-set.json, run.ts, eval-results.json
prisma/                schema.prisma, seed.ts, seed-data/
public/samples/        sample audio, transcripts, photos
scripts/               draft, demo-draft, eval, smoke, vercel-build
```

## Deployment

The project deploys to Vercel with Neon Postgres. `scripts/vercel-build.sh` switches the Prisma datasource provider to `postgresql` (the one-line change the schema was written for), pushes the schema, reseeds the demo data on every deploy, then runs `next build`. Environment: `DATABASE_URL` (from the Neon integration), `ANTHROPIC_API_KEY`, optionally `OPENAI_API_KEY`.
