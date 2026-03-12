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
- [Major Goods Price Index](#major-goods-price-index)
- [Data Backends](#data-backends)
- [Environment Notes](#environment-notes)
- [Repo Layout](#repo-layout)
- [Contributing](#contributing)
- [Planning Docs](#planning-docs)

## Scope

- Housing, energy, and major-goods price index metrics
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

Comparison semantics:

- Energy comparison ranks are ascending by price. Rank `1` is the cheapest observation in the comparison set.
- China comparison entries are proxy-based. Retail uses a Beijing residential tariff proxy and wholesale uses an NEA annual market-price proxy.

## Major Goods Price Index

The price index implementation uses a two-layer model:

1. Raw warehouse tables in Postgres keep canonical product, merchant, offer, and price history.
2. Curated public series are published back into the existing `series` and `observations` API layer.

Core schema:

- `product_categories`, `products`, `product_aliases`
- `merchants`, `merchant_locations`, `offers`
- `price_observations`, `price_rollups_daily`
- `index_definitions`, `index_basket_versions`, `index_weights`

Current pipeline:

1. `apps/ingest/src/jobs/sync-major-goods-price-index.ts` builds canonical major-goods fixture records.
2. For Postgres, `apps/ingest/src/repositories/postgres-price-warehouse.ts` upserts the raw warehouse tables and links facts to `raw_snapshots`.
3. The job computes daily product rollups using median prices and unit-price aggregates.
4. The job applies versioned basket weights to publish curated observations such as:
   - `prices.major_goods.overall.index`
   - `prices.major_goods.food.index`
   - `prices.major_goods.household_supplies.index`
5. The API serves the latest snapshot at `/api/prices/major-goods`.

Public API shape:

- `/api/prices/major-goods?region=AU` returns the latest major-goods index rows for the requested region.
- `/api/prices/ai-deflation?region=AU` returns the latest Australian-made / AI-exposed cohort snapshot.
- The response includes `methodologyVersion`, `methodSummary`, `sourceRefs`, `indexes`, and `freshness`.
- The route reads from curated `observations`, not directly from raw warehouse tables.

Price endpoint auth:

- `/api/prices/major-goods` is password protected with HTTP Basic Auth.
- `/api/prices/intake/batches` is password protected with HTTP Basic Auth.
- `/api/prices/ai-deflation` is password protected with HTTP Basic Auth.
- `/api/prices/unresolved-items` is password protected with HTTP Basic Auth.
- `/api/prices/unresolved-items/:id/reconcile` is password protected with HTTP Basic Auth.
- The hardcoded password is `buildaustralia`.
- The current implementation accepts any username paired with that password.
- Requests without valid Basic Auth receive `401` and `WWW-Authenticate: Basic realm="AUS Dash Prices"`.

Example:

```bash
curl -u agent:buildaustralia "http://localhost:3001/api/prices/major-goods?region=AU"
```

Agent intake flow:

1. Scraper agents submit discovered offers in bulk to `POST /api/prices/intake/batches`.
2. The API stages the batch payload in `rawSnapshots` and creates queue entries in `unresolvedPriceItems`.
3. Reconciliation agents read open items from `GET /api/prices/unresolved-items`.
4. A reconciliation agent resolves an item with `POST /api/prices/unresolved-items/:id/reconcile`.
5. The promotion job moves reconciled items into `promoted` state for downstream ingestion handoff.
6. Promoted items still do not automatically change the published index until a downstream warehouse/index publication step consumes them.

Queue transition rules:

- `classify` only works for items already in `reconciled` state.
- `promote` only works for items already in `reconciled` state.
- Invalid transition attempts return `409 INVALID_ITEM_STATE`.

Current batch intake contract:

- each item includes `observedAt`, merchant fields, region, title, offer id, and price fields
- intake is append-only and does not publish directly into the index
- reconciliation is the gate before a discovered item should affect canonical product mapping or basket weights
- `status=promoted` can be queried once the promotion job has run

AI-deflation cohort scope:

- `prices.au_made.all.index`
- `prices.au_made.ai_exposed.index`
- `prices.au_made.control.index`
- `prices.imported.matched_control.index`
- `prices.ai_deflation.spread.au_made_vs_control.index`

How the index is calculated:

1. Raw offer prices are grouped by `region + product + day`.
2. The daily rollup stores `sample_size`, `distinct_offer_count`, `min`, `max`, `mean`, `median`, and unit-price aggregates.
3. The base period is fixed in `index_definitions.base_period`.
4. Each basket version defines product weights in `index_weights`.
5. Published index points are weighted price relatives rebased to `100`.

How to add another price source:

1. Add a stable `sourceId` to `packages/shared/src/live-store.ts`.
2. Add any new public series ids to `packages/data-contract/src/series.ts`.
3. Implement fetch/parse in `apps/ingest/src/sources/live-source-clients.ts`.
4. Extend or add a sync job in `apps/ingest/src/jobs/` that maps source rows into the canonical price warehouse shape.
5. Persist raw rows through `apps/ingest/src/repositories/postgres-price-warehouse.ts`.
6. Publish any new curated index outputs through `persistIngestArtifacts(...)`.
7. If the public API contract changes, update `apps/api/src/routes/`, repository methods, OpenAPI tests, and this README.

Validation flow for price-index changes:

```bash
bun --filter @aus-dash/db test
bun --filter @aus-dash/data-contract test
bun --filter @aus-dash/shared test
bun --filter @aus-dash/ingest test
bun --filter @aus-dash/api test
bun run docs:check
```

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
- `docs/ai-deflation-au-made-prd-tdd.md`
- `docs/price-index-db-structure.md`
- `docs/price-index-prd-tdd.md`
- `research_electricity_prices_api_scope/research_report.md`
