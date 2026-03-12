---
name: add-major-goods-index-source
description: Use this when adding a new retailer, product source, basket expansion, or methodology change to the Australian major-goods price index in this repo. Covers raw warehouse persistence, rollup/index publication, API exposure, seed data, and validation.
---

# Add Major Goods Index Source

Use this skill when the task is to extend the major-goods price index pipeline in this repo.

This repo already has a working major-goods slice:

- Raw warehouse schema in `packages/db/src/schema.ts`
- Curated public series ids in `packages/data-contract/src/series.ts`
- Seed source catalog and observations in `packages/shared/src/live-store.ts`
- Source parsing in `apps/ingest/src/sources/live-source-clients.ts`
- Sync job in `apps/ingest/src/jobs/sync-major-goods-price-index.ts`
- Raw Postgres persistence in `apps/ingest/src/repositories/postgres-price-warehouse.ts`
- Public API route in `apps/api/src/routes/price-routes.ts`

## Non-negotiables

1. Write tests first. Watch them fail before adding production code.
2. Keep the raw warehouse and public API layers separate.
3. Raw retailer facts go into `price_*` tables, not directly into public `observations`.
4. Public routes must read curated observations, not warehouse facts.
5. Keep changes additive unless the user explicitly asks for a breaking methodology change.

## Current Model

The major-goods implementation uses two layers:

1. Raw warehouse:
   - `product_categories`
   - `products`
   - `product_aliases`
   - `merchants`
   - `merchant_locations`
   - `offers`
   - `price_observations`
   - `price_rollups_daily`
   - `index_definitions`
   - `index_basket_versions`
   - `index_weights`
2. Curated API layer:
   - `series`
   - `observations`

The sync job computes daily product rollups from raw offer observations, then publishes rebased index series such as:

- `prices.major_goods.overall.index`
- `prices.major_goods.food.index`
- `prices.major_goods.household_supplies.index`

## Decide What Kind of Change You Are Making

Choose the smallest path that matches the task:

1. New retailer or upstream feed, same public outputs:
   - update source parsing
   - extend canonical mapping in the sync job
   - keep public series ids unchanged
2. New product or category coverage inside the basket:
   - update canonical product/category mapping
   - update basket weights if publication should change
   - update seed fixtures and tests
3. New public index output:
   - add series ids
   - publish new curated observations
   - update API response handling if the route surface changes
4. Warehouse schema change:
   - update `packages/db/src/schema.ts`
   - generate a migration
   - add schema contract tests

## Workflow

### 1. Start with tests

Add or update only the tests needed for the requested change:

- `packages/db/tests/*` for schema/index/constraint changes
- `packages/data-contract/tests/*` for new public series ids
- `apps/ingest/tests/source-clients.test.ts` for source parsing
- `apps/ingest/tests/sync-major-goods-price-index.test.ts` for rollup/index behavior
- `apps/ingest/tests/job-registry.test.ts` if a new recurring job or cadence is added
- `apps/api/tests/*` if public route behavior changes

### 2. Add or extend the source registry

If the upstream source is new:

1. Add a stable `sourceId` to `packages/shared/src/live-store.ts`
2. Use domain `prices`
3. Keep `name`, `url`, and `expectedCadence` realistic

If the source is only used inside the warehouse and not exposed publicly, still register it so provenance stays queryable.

### 3. Parse the upstream payload

Implement the parser in `apps/ingest/src/sources/live-source-clients.ts`.

Rules:

1. Throw `SourceClientError` on schema drift or HTTP/network failures.
2. Mark transient failures correctly.
3. Normalize the source into a small, typed row shape before it reaches the job.
4. Keep parser logic source-specific and keep methodology logic out of the parser.

### 4. Map into the canonical warehouse model

Extend `apps/ingest/src/jobs/sync-major-goods-price-index.ts`.

Required outcomes:

1. Deterministic ids for categories, products, merchants, locations, offers, and facts
2. Canonical product/category assignment
3. Raw `price_observations` rows with `observedAt`, `observedDate`, price fields, and provenance
4. `price_rollups_daily` rows using median-friendly aggregation
5. Published curated `LiveObservation` outputs for public series

Do not skip the warehouse write path just because the store backend also exists. The store backend is only for curated observation fixtures and local fallback behavior.

### 5. Persist raw warehouse rows

Use `apps/ingest/src/repositories/postgres-price-warehouse.ts`.

Rules:

1. Stage the raw payload in `raw_snapshots`
2. Upsert source catalog metadata
3. Upsert dimensions before facts
4. Keep fact writes idempotent
5. Link warehouse rows back to `raw_snapshot_id`

If you need a new persistence field, add it to both schema and repository mapping in the same change.

### 6. Publish curated observations

Use `persistIngestArtifacts(...)` after raw warehouse persistence.

Rules:

1. Only publish derived public series
2. Set `methodologyVersion`
3. Keep `sourceName`, `sourceUrl`, `publishedAt`, `ingestedAt`, and `vintage` populated
4. If you add a new public series id, update `packages/data-contract/src/series.ts`

### 7. Update the API only if the public contract changes

Current public route:

- `/api/prices/major-goods`

If you change what the public route returns:

1. update `apps/api/src/repositories/live-data-contract.ts`
2. update both repositories:
   - `apps/api/src/repositories/live-store-repository.ts`
   - `apps/api/src/repositories/postgres-live-repository.ts`
3. update route contracts in `apps/api/src/routes/route-contracts.ts`
4. update route registration if needed
5. update API tests and OpenAPI tests together

Do not make the API query raw `price_*` tables directly unless the user explicitly asks for a new raw-data endpoint.

### 8. Keep seed data aligned

If the public outputs or source catalog change, regenerate the checked-in seed stores:

```bash
bun -e 'import { createSeedLiveStore, writeLiveStoreSync } from "./packages/shared/src/live-store.ts"; for (const target of ["data/live-store.json", "apps/api/data/live-store.json", "apps/ingest/data/live-store.json"]) { writeLiveStoreSync(createSeedLiveStore(), target); }'
```

This keeps local dev and API tests aligned with the shared seed data.

## When You Need to Read More

Read these only when the task actually needs them:

1. `README.md`
   - for the current high-level price-index pipeline and validation commands
2. `docs/price-index-prd-tdd.md`
   - for product requirements and acceptance criteria
3. `docs/price-index-db-structure.md`
   - for table intent and warehouse design constraints

## Validation Checklist

Run the smallest set that matches the change, then expand if the touch surface grows:

```bash
bun --filter @aus-dash/db test
bun --filter @aus-dash/data-contract test
bun --filter @aus-dash/shared test
bun --filter @aus-dash/ingest test
bun --filter @aus-dash/api test
bun run docs:check
bun run typecheck
```

If repo-wide lint fails, check whether the failure is from files you changed or unrelated pre-existing issues. Do not silently ignore new lint failures you introduced.

## Delivery Standard

A complete change usually includes:

1. failing tests first
2. minimal implementation
3. migration if schema changed
4. updated seed data if public outputs changed
5. updated README if public behavior or workflow changed
6. explicit note of what was validated and what remains unvalidated
