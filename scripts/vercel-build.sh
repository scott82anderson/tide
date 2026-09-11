#!/usr/bin/env bash
# Vercel build. Local dev runs on SQLite; the deployed app runs on Postgres.
# The schema is written to be provider-neutral, so the switch is the one-line
# datasource change below, then push the schema and reseed the demo data.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Add a Postgres URL in the Vercel project env." >&2
  exit 1
fi

if [[ "$DATABASE_URL" == postgres* ]]; then
  echo "Switching Prisma datasource provider to postgresql for this build"
  sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
  rm -f prisma/schema.prisma.bak
fi

pnpm prisma generate
pnpm prisma db push --accept-data-loss --skip-generate
pnpm tsx prisma/seed.ts
pnpm next build
