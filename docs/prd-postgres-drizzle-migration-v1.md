# PRD: Postgres + Drizzle Migration for Live Housing/Energy Data (V1)

- Status: Draft v1.0
- Date: 2026-02-27
- Owner: aus-dash platform
- Objective: Move production data path from file-backed `live-store.json` to Postgres-backed repositories using Drizzle

## 1. Problem

Current API/ingest are dynamic but persist live data in a file store. This blocks:

1. concurrent-safe writes,
2. reliable query performance as data grows,
3. production-grade lineage and replay workflows,
4. operational observability across runs and sources.

## 2. Goals

1. Replace file-backed production reads/writes with Postgres + Drizzle.
2. Keep existing API contracts stable (`/api/housing/overview`, `/api/energy/*`, `/api/series/:id`, metadata endpoints).
3. Preserve idempotent ingestion semantics:
1. observations unique by `(series_id, region_code, date, vintage)`,
2. raw snapshot dedupe by `(source_id, checksum_sha256)`.
4. Support rollout with safe fallback:
1. `AUS_DASH_DATA_BACKEND=store|postgres`,
2. no frontend contract changes required.

## 3. Non-Goals (V1)

1. Real-time streaming (Kafka/EventBridge).
2. Multi-tenant tenancy model.
3. Analytics warehouse denormalization.
4. Removing file store immediately (store remains fallback path for rollback).

## 4. Current State (as of 2026-02-27)

1. `apps/api` uses store-backed repository functions.
2. `apps/ingest` writes observations, source cursors, ingestion runs to file store.
3. `packages/db` has initial Drizzle schema but does not yet cover:
1. raw snapshots,
2. source cursors,
3. ingestion runs,
4. required observation metadata fields used by API metadata/freshness contracts.

## 5. Scope

### 5.1 Schema Scope (Drizzle / Postgres)

Target tables:

1. `regions`
2. `series`
3. `observations`
4. `sources`
5. `source_cursors`
6. `ingestion_runs`
7. `raw_snapshots`

Required `observations` columns:

1. `series_id text not null`
2. `region_code text not null`
3. `date text not null` (supports timestamp/date/quarter tokens)
4. `value numeric not null`
5. `unit text not null`
6. `source_name text not null`
7. `source_url text not null`
8. `published_at timestamptz not null`
9. `ingested_at timestamptz not null`
10. `vintage text not null`
11. `is_modeled boolean not null default false`
12. `confidence text not null`
13. unique index on `(series_id, region_code, date, vintage)`

Required `raw_snapshots` columns:

1. `source_id text not null`
2. `checksum_sha256 text not null`
3. `captured_at timestamptz not null`
4. `content_type text not null`
5. `payload text not null`
6. unique index on `(source_id, checksum_sha256)`

Required `source_cursors` columns:

1. `source_id text primary key`
2. `cursor text not null`
3. `updated_at timestamptz not null`

Required `ingestion_runs` columns:

1. `run_id text primary key`
2. `job text not null`
3. `status text not null`
4. `started_at timestamptz not null`
5. `finished_at timestamptz not null`
6. `rows_inserted integer not null`
7. `rows_updated integer not null`
8. `error_summary text null`

### 5.2 API Scope

Production routes remain unchanged externally:

1. `GET /api/housing/overview`
2. `GET /api/series/:id`
3. `GET /api/energy/live-wholesale`
4. `GET /api/energy/retail-average`
5. `GET /api/energy/overview`
6. `GET /api/metadata/freshness`
7. `GET /api/metadata/sources`

Internal change:

1. introduce repository interface (`LiveDataRepository`),
2. add Postgres repository implementation,
3. choose backend via `AUS_DASH_DATA_BACKEND`.

### 5.3 Ingest Scope

1. Add Postgres write repositories for:
1. observation upsert,
2. raw snapshot stage/dedupe,
3. source cursor update,
4. ingestion run insert.
2. Add backend selection for ingest:
1. `AUS_DASH_INGEST_BACKEND=store|postgres`,
2. support dual-write mode for burn-in (`dual` optional).

### 5.4 Backfill Scope

1. Add one-time import script:
1. source: `live-store.json`,
2. destination: Postgres tables.
2. Make import idempotent (safe reruns).

## 6. Rollout Plan

### Phase A: Schema and Repositories

1. Expand Drizzle schema and generate migrations.
2. Implement Postgres repository methods matching current store repository outputs.
3. Keep file-store path unchanged as baseline.

### Phase B: Ingest Persistence Switch

1. Add Postgres ingest repository writes.
2. Enable dual-write in non-prod for 3-7 days.
3. Validate parity (record counts, latest timestamps, freshness statuses).

### Phase C: API Read Switch

1. Enable `AUS_DASH_DATA_BACKEND=postgres` in non-prod.
2. Run contract and performance tests.
3. Promote to production.

### Phase D: Hardening

1. Add lag/failure alerts from `ingestion_runs`.
2. Document replay and rollback runbooks.
3. Keep store fallback for rollback window.

## 7. Success Metrics

1. API contract parity: 100% route tests pass unchanged.
2. Ingestion idempotency: duplicate run adds 0 duplicate observations.
3. Freshness parity: metadata endpoint values align with store baseline during dual-write.
4. Availability: no increase in API error rates during backend cutover.

## 8. Risks and Mitigations

1. **Date token ambiguity (`date`, `timestamp`, `quarter`)**:
1. keep `date` as canonical text token in V1,
2. parse to timestamp only in freshness logic.
2. **Query regressions under load**:
1. add composite indexes for series/region/date,
2. performance gate in tests.
3. **Migration drift between store and Postgres**:
1. dual-write burn-in + parity checks,
2. quick rollback via backend flag.

## 9. Definition of Done

1. `AUS_DASH_DATA_BACKEND=postgres` serves all in-scope API routes with no fixture/store reads in active production path.
2. Ingest writes all run/cursor/raw snapshot/observation records to Postgres with idempotent constraints.
3. Full test suite green, including new Postgres integration coverage.
4. Backfill + rollback runbooks documented.
