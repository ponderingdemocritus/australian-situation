# Postgres + Drizzle Implementation Checklist

- Date started: 2026-02-27
- Scope source: `docs/prd-postgres-drizzle-migration-v1.md`

## Phase 1: Schema

- [x] Expand `packages/db/src/schema.ts` with observations metadata parity fields.
- [x] Add `sources`, `source_cursors`, `ingestion_runs`, `raw_snapshots` tables.
- [x] Add required unique constraints and indexes.
- [x] Generate and commit Drizzle migrations.

## Phase 2: Ingest Persistence

- [x] Implement Postgres observation upsert repository.
- [x] Implement Postgres raw snapshot stage/dedupe repository.
- [x] Implement Postgres source cursor upsert repository.
- [x] Implement Postgres ingestion run repository.
- [x] Add `AUS_DASH_INGEST_BACKEND` store/postgres selector.

## Phase 3: API Repository Switch

- [x] Add Postgres live repository implementing current route contracts.
- [x] Add `AUS_DASH_DATA_BACKEND` selector (`store|postgres`).
- [x] Keep route payload shapes/status codes unchanged.
- [x] Keep CORS and current validation behavior unchanged.

## Phase 4: Backfill and Rollout

- [x] Add `live-store.json -> Postgres` idempotent backfill script.
- [ ] Run dual-write burn-in and parity verification.
- [ ] Switch non-prod API reads to Postgres.
- [ ] Switch production API reads to Postgres.

## Phase 5: Validation

- [ ] Add Postgres integration tests for ingest writes and idempotency.
- [ ] Add Postgres route contract tests for housing/energy/series/metadata.
- [x] Run full workspace tests green.
- [ ] Record rollback procedure and operations runbook.
