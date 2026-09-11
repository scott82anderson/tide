# DockMaster Service Writer (prototype)

A clickable prototype of an AI feature for DockMaster: a technician records a voice note and photos about a boat, the Service Writer drafts an estimate from the yard's own operation codes, labour standards, parts catalogue and vessel history, and the service manager reviews, edits and approves before anything reaches the boat owner.

## Run it

```bash
pnpm install
cp .env.example .env      # add ANTHROPIC_API_KEY (OPENAI_API_KEY optional)
pnpm db:reset             # push schema to prisma/dev.db and seed demo data
pnpm dev                  # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the bundled sample note still drafts from recorded model output, so the demo path works end to end. Live drafting of any other note needs the key.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm db:reset` | Recreate and seed the local SQLite database |
| `pnpm demo:draft` | Create the sample note 1 draft from recorded model output (no key needed) |
| `pnpm draft --sample 1` | Run the drafting pipeline on a bundled sample and print JSON (needs key) |
| `pnpm eval` | Run the golden set through the pipeline and write `eval-results.json` (needs key) |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | Quality gates |

The full write-up (architecture, guardrails, demo script, what is simulated) is added in Phase 5.
