# Australian Situation Dashboard

Monorepo for AUS Dash ingestion, API, and dashboard apps.

```text
    _   _ _   _ ____ _____ ____      _    _     ___    _   _
   / \ | | | | / ___|_   _|  _ \    / \  | |   |_ _|  / \ | |
  / _ \| | | | \___ \ | | | |_) |  / _ \ | |    | |  / _ \| |
 / ___ \ | |_| |___) || | |  _ <  / ___ \| |___ | | / ___ \ |
/_/   \_\_\\___/|____/ |_| |_| \_\/_/   \_\_____|___/_/   \_\_|
 ____ ___ _____ _   _    _  _____ ___ ___  _   _
/ ___|_ _|_   _| | | |  / \|_   _|_ _/ _ \| \ | |
\___ \| |  | | | | | | / _ \ | |  | | | | |  \| |
 ___) | |  | | | |_| |/ ___ \| |  | | |_| | |\  |
|____/___| |_|  \___//_/   \_\_| |___\___/|_| \_|
```

## Table of Contents

- [Scope](#scope)
- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Quickstart](#quickstart)
- [Common Commands](#common-commands)
- [API Docs](#api-docs)
- [Data Backends](#data-backends)
- [Environment Notes](#environment-notes)
- [Repo Layout](#repo-layout)
- [Contributing](#contributing)
- [Planning Docs](#planning-docs)

## Scope

- Housing + energy metrics
- Source metadata + freshness metadata
- Internal API-first architecture (`apps/api`) used by the dashboard (`apps/web`)

## How It Works

```text
[External Data Sources]
        |
        v
[apps/ingest source clients]
        |
        v
[apps/ingest sync jobs]
        |
        v
[Storage Backend]
  - JSON live store (default)
  - Postgres (optional)
        |
        v
[apps/api repositories + routes]
        |
        v
[apps/web dashboard]
        |
        v
[Tests + E2E validation]
```

## Prerequisites

- Bun (workspace package manager/runtime)
- Docker (for Postgres + Redis when using `up:all`)

## Quickstart

```bash
bun install
```

Run everything:

```bash
bun run dev:all
```

Ingest defaults to BullMQ runtime (`scheduler` upsert + `worker` processing) via `apps/ingest/src/index.ts`.

## Common Commands

Bring up infra + migrate + backfill + build + run:

```bash
bun run up:all
```

`up:all` starts both Postgres and Redis before launching API + ingest services.

Run tests:

```bash
bun run test:all
bun run test:all:e2e
bun run validate
```

Client validation (web tests + build + Playwright):

```bash
bun run test:client
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/aus_dash bun run test:postgres
bun run test:e2e:real
bun run validate:full
```

Reuse an existing web server for Playwright:

```bash
bun run test:client:e2e:existing
```

## API Docs

The generated contract is the source of truth:

- `/api/docs` serves ReDoc for the current API.
- `/api/openapi.json` serves the generated OpenAPI document.
- `bun run docs:check` validates the generated docs in CI and local validation.

Use the generated docs instead of maintaining endpoint tables by hand in `README.md`.

## Data Backends

API backend is selected via `AUS_DASH_DATA_BACKEND`:

- `store` (default): reads local JSON live store (`AUS_DASH_STORE_PATH` or `data/live-store.json` from process cwd).
- `postgres`: reads `observations` and `sources` tables from Postgres (`DATABASE_URL` required).

Ingest backend is selected via `AUS_DASH_INGEST_BACKEND` with the same values (`store` or `postgres`).

## Environment Notes

- `NEXT_PUBLIC_API_BASE_URL` (web): defaults to `http://localhost:3001`
- `ENABLE_ENERGY_HOUSEHOLD_ESTIMATE=true` (api): enables `/api/energy/household-estimate`
- `AUS_DASH_STORE_PATH=/abs/path/to/live-store.json`: shared JSON store override
- `AUS_DASH_REDIS_URL=redis://127.0.0.1:6379/0`: BullMQ Redis connection for ingest runtime
- `AUS_DASH_BULLMQ_QUEUE_NAME=ingest-jobs`: queue name override for ingest runtime
- `AUS_DASH_INGEST_RUNTIME=bullmq|legacy`: ingest runtime selector (`bullmq` default; `legacy` is non-production burn-in fallback)

## Repo Layout

```text
apps/
  web/       Next.js dashboard
  api/       Hono API
  ingest/    ingestion jobs + source clients
packages/
  ui/            shared UI components
  data-contract/ canonical series + region contracts
  db/            Drizzle schema/config
  shared/        shared helpers/types + live-store utilities
tests/
  e2e/       Playwright tests
```

## Contributing

- Source-of-truth contributor workflow is in `AGENTS.md`.
- If you add or modify endpoints, update the route contracts and keep `bun run docs:check` green.

## Planning Docs

- `docs/prd-electricity-prices-aus-vs-global-v1.md`
- `docs/implementation-roadmap-electricity-prices-aus-global.md`
- `docs/tdd-plan-electricity-prices-aus-global-v1.md`
- `docs/kpi-definitions-electricity-prices-aus-global-v1.md`
- `docs/api-energy-comparison-v1.md`
- `docs/postgres-api-abstraction-prd-tdd.md`
- `research_electricity_prices_api_scope/research_report.md`
