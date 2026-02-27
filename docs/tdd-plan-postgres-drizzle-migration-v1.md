# TDD Plan: Postgres + Drizzle Migration (V1)

- Date: 2026-02-27
- Rule: no production migration code without failing tests first
- Scope: `packages/db`, `apps/ingest`, `apps/api`

## 1. Test Objectives

1. Prove schema supports current live-store data model and uniqueness constraints.
2. Prove ingest writes remain idempotent in Postgres mode.
3. Prove API response contracts are unchanged when backend switches from store to Postgres.
4. Prove fallback/rollback flags are safe.

## 2. Test Layers

1. Unit tests: repository adapters and mappers.
2. Integration tests: Postgres-backed ingest and API route behavior.
3. Contract tests: compare JSON shape/status codes vs current route tests.
4. Migration tests: backfill script idempotency and parity checks.

## 3. Red-Green Slices

### Slice 1: Drizzle Schema Expansion

RED tests:

1. `observations` schema includes all required fields (`unit`, source refs, modeled/confidence, published/ingested timestamps).
2. unique key `(series_id, region_code, date, vintage)` is present.
3. `raw_snapshots`, `source_cursors`, `ingestion_runs`, `sources` tables exist with expected keys.

GREEN code:

1. update `packages/db/src/schema.ts`,
2. generate migrations.

### Slice 2: Postgres Observation Repository

RED tests:

1. upsert same `(series, region, date, vintage)` updates existing row, does not duplicate.
2. new vintage inserts new row.
3. point queries by series/region/date range return ordered points.

GREEN code:

1. `apps/ingest/src/repositories/postgres-observations.ts`,
2. `apps/api/src/repositories/postgres-live-repository.ts` (query path).

### Slice 3: Raw Snapshot Dedupe Repository

RED tests:

1. same `(source_id, checksum)` stores once.
2. different payload stores new row.

GREEN code:

1. Postgres raw snapshot insert with conflict handling.

### Slice 4: Cursor + Ingestion Run Repository

RED tests:

1. cursor upsert updates existing source cursor.
2. ingestion run insert writes status/counts/error fields.

GREEN code:

1. cursor/run repositories and write wiring in job orchestration.

### Slice 5: Backend Selector Wiring

RED tests:

1. `AUS_DASH_DATA_BACKEND=store` keeps existing behavior.
2. `AUS_DASH_DATA_BACKEND=postgres` routes use Postgres repository.
3. unsupported backend value fails fast with explicit error.

GREEN code:

1. backend factory for API repositories.

### Slice 6: Ingest Backend Selector

RED tests:

1. `AUS_DASH_INGEST_BACKEND=store` only touches file-store.
2. `...=postgres` only touches DB repositories.
3. optional `...=dual` writes both and reports drift if mismatch.

GREEN code:

1. ingest persistence adapter layer.

### Slice 7: Backfill Script

RED tests:

1. importing `live-store.json` populates all target tables.
2. rerun is idempotent (no duplicates).
3. imported counts match source store counts by entity type.

GREEN code:

1. `scripts/backfill-store-to-postgres.ts`.

### Slice 8: API Contract Parity

RED tests:

1. existing API tests pass unchanged under Postgres backend.
2. `series/:id` date filters and error codes match existing contract.
3. metadata endpoints still return required fields.

GREEN code:

1. query parity fixes.

### Slice 9: Performance Budget Gates

RED tests:

1. warm `/api/energy/overview` P95 < 300ms in Postgres mode.
2. warm `/api/housing/overview` P95 < 300ms in Postgres mode.

GREEN code:

1. add/adjust indexes and query plans.

## 4. CI Gates

Order:

1. `@aus-dash/db` tests + schema validation.
2. `@aus-dash/ingest` unit tests.
3. Postgres integration tests (ingest + API).
4. full workspace tests (`bun run test`).

## 5. Immediate RED Tests to Add

1. `packages/db/tests/live-schema.postgres.test.ts`
2. `apps/ingest/tests/postgres-observation-upsert.integration.test.ts`
3. `apps/ingest/tests/postgres-raw-snapshot-dedupe.integration.test.ts`
4. `apps/api/tests/series-by-id.postgres.test.ts`
5. `apps/api/tests/energy-overview.postgres.test.ts`
6. `apps/api/tests/metadata-freshness.postgres.test.ts`

## 6. Completion Checklist

1. All RED tests observed failing before implementation.
2. All Green tests pass with no contract regressions.
3. Dual-write parity verified in non-prod.
4. Backend switch + rollback documented.
