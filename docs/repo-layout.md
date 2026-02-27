# Proposed Repo Layout (Housing V1)

## 1. Layout

```text
aus-dash/
  apps/
    web/                         # Next.js App Router frontend
      app/
      components/
      features/
      lib/
      tests/
    api/                         # Hono API server
      src/
        routes/
        domain/
        repositories/
        middleware/
      tests/
    ingest/                      # scheduled ingestion workers
      src/
        jobs/
        parsers/
        mappers/
      tests/
  packages/
    data-contract/               # series IDs, enums, schemas
      src/
    db/                          # Drizzle schema + migrations + seeds
      src/
      drizzle/
    shared/                      # shared utils and types
      src/
    ui/                          # reusable chart/format components
      src/
  tests/
    e2e/                         # Playwright cross-app flows
  infra/
    docker/
    scripts/
  docs/
    prd-housing-v1.md
    tdd-plan-housing-v1.md
    repo-layout.md
```

## 2. Ownership Boundaries

- `apps/web`: rendering, UX state, client/server component composition.
- `apps/api`: read APIs, scenario APIs, validation, cache semantics.
- `apps/ingest`: source pull, normalize, upsert, freshness metadata.
- `packages/data-contract`: canonical series and region contracts. No side effects.
- `packages/db`: schema and migrations only; no business logic.

## 3. Data Model Starter

Core tables:

- `regions(id, region_type, region_code, name, parent_region_id)`
- `series(id, category, name, unit, frequency, source, source_series_code)`
- `observations(id, series_id, region_id, date, value, vintage, ingested_at, unique(series_id, region_id, date, vintage))`
- `scenarios(id, name, kind, params_json, created_at, updated_at)`
- `watchlist_items(id, region_id, label, source, url, confidence, published_at, observed_at)`

## 4. API Surface Starter

- `GET /api/health`
- `GET /api/housing/overview`
- `GET /api/series`
- `GET /api/series/:id`
- `GET /api/housing/serviceability`
- `GET /api/housing/stress/watchlist`
- `GET /api/housing/scenarios`
- `POST /api/housing/scenarios`

## 5. Runtime and Tooling

- TypeScript everywhere
- Single test runner baseline (`vitest`) for unit/integration
- `playwright` for e2e
- `drizzle` for schema and SQL migration flow
- Cache strategy:
  - API layer in-memory or Redis cache for computed overview payloads
  - frontend route revalidation tuned per page (`overview` short TTL, `stress` medium TTL)

## 6. Branching and Delivery

1. One vertical slice per branch (feature + tests).
2. Mandatory RED commit or test evidence before GREEN implementation.
3. Merge only when CI gates in `tdd-plan-housing-v1.md` pass.

## 7. Migration Note for Current Workspace

Current root project is a separate `Bun + Elysia` backend. Keep it isolated while building `aus-dash/` as the housing module workspace to avoid regression risk.
