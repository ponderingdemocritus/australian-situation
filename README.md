# Australian Situation Dashboard

Australian Situation Dashboard is a situational awareness platform for Australia focused on economic, housing, and industry data.

Current V1 implementation is housing + energy (as the first industry domain), delivered as:

- a shared data contract layer,
- ingestion jobs,
- read APIs,
- and a single dashboard UI.

## Vision

Build one trusted operational view for Australia that answers:

1. What is happening now across housing and industry cost pressure?
2. Which regions are improving or deteriorating?
3. How fresh and reliable is each metric?

The product is API-first: dashboards consume internal APIs so the same data can later power partner integrations.

## Current Scope (Implemented)

- Geography: `AU`, states, and selected capital city support in contracts
- Housing: index, lending, and mortgage rate series
- Energy: live wholesale signal, retail average, benchmark, and CPI context
- Platform metadata: source registry and freshness endpoints

## How It Works

- Ingestion (`apps/ingest`): pulls source data (currently scaffolded with fixture-backed jobs), maps payloads into canonical shapes, and produces normalized outputs.
- Data contracts (`packages/data-contract`): defines canonical region/series identifiers shared by ingestion, API, and UI.
- Data model (`packages/db`): defines Drizzle/Postgres tables for `regions`, `series`, `observations`, and enforces idempotent uniqueness on observation writes.
- API layer (`apps/api`): serves `/api/*` routes with validation, region filtering, response shaping, and metadata endpoints.
- Dashboard UI (`apps/web`): fetches API data by region and updates housing + energy panels from a single selector.
- Shared UI primitives (`packages/ui`): reusable components consumed from `@aus-dash/ui`.

## Repo Layout

```text
apps/
  web/       Next.js dashboard
  api/       Hono API
  ingest/    ingestion jobs + mappers
packages/
  ui/            shared UI components
  data-contract/ canonical series + region contracts
  db/            Drizzle schema/config
  shared/        shared helpers/types
tests/
  e2e/       Playwright end-to-end tests
docs/        PRDs, roadmap, and TDD plans
```

## Run Locally

```bash
bun install
```

Start all apps:

```bash
bun run dev:all
```

One command to start infra + migrate + backfill + build + run all services:

```bash
bun run up:all
```

Useful infra commands:

```bash
bun run infra:status
bun run infra:down
```

Default local Postgres host port for the one-command stack is `5433` (to avoid common `5432` conflicts). Override with `POSTGRES_PORT`.

Or start individually:

```bash
bun run dev:web
bun run dev:api
bun run dev:ingest
```

Run tests:

```bash
bun run test:all
bun run test:all:e2e
```

## API Surface (Current)

- `GET /api/health`
- `GET /api/housing/overview?region=AU|STATE`
- `GET /api/series/:id?region=&from=&to=`
- `GET /api/energy/live-wholesale?region=&window=5m|1h|24h`
- `GET /api/energy/retail-average?region=&customer_type=residential`
- `GET /api/energy/overview?region=AU|STATE`
- `GET /api/energy/household-estimate?region=&usage_profile=default` (feature-flagged)
- `GET /api/metadata/sources`
- `GET /api/metadata/freshness`

## How To Add More Data

Use this workflow whenever you add a new economic/housing/industry metric.

1. **Add/extend canonical contract IDs:** Update series/region definitions in `packages/data-contract/src/*`; keep names stable and domain-scoped (for example `energy.wholesale.*`, `housing.*`, `macro.*`).
2. **Add ingestion logic:** Create a job in `apps/ingest/src/jobs`, add mappers/parsers in `apps/ingest/src/mappers`, and write ingestion tests in `apps/ingest/tests`.
3. **Persist with schema support:** If new storage fields are required, update `packages/db/src/schema.ts` and run `@aus-dash/db` schema generation/migration scripts.
4. **Expose through API:** Add or extend handlers in `apps/api/src/app.ts` (or `apps/api/src/domain`), validate inputs, and add/adjust tests in `apps/api/tests`.
5. **Render in dashboard:** Wire new fields into `apps/web/features/...`, keep app composition in `apps/web`, and use shared primitives from `@aus-dash/ui`.
6. **Update metadata + freshness:** Add source attribution in `/api/metadata/sources` and freshness expectations in `/api/metadata/freshness`.

7. **Verify end-to-end:**

```bash
bun --filter @aus-dash/ingest test
bun --filter @aus-dash/api test
bun --filter @aus-dash/web test
bun --filter @aus-dash/web build
```

## Environment Notes

- Web API base URL: `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3001`)
- Optional modeled energy estimate flag: `ENABLE_ENERGY_HOUSEHOLD_ESTIMATE=true` (API)

## Planning Docs

Read these for roadmap and implementation detail:

1. `docs/roadmap-housing-energy.md`
2. `docs/prd-housing-energy-v1.md`
3. `docs/tdd-plan-housing-energy-v1.md`
4. `docs/prd-live-ingestion-v1.md`
5. `docs/tdd-plan-live-ingestion-v1.md`
6. `docs/prd-postgres-drizzle-migration-v1.md`
7. `docs/tdd-plan-postgres-drizzle-migration-v1.md`
8. `docs/postgres-drizzle-implementation-checklist.md`
