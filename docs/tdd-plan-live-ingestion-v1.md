# TDD Plan: Live Ingestion Platform (Housing + Energy) V1

- Date: 2026-02-27
- Rule: no production ingestion code without failing tests first
- Scope: `apps/ingest`, `apps/api`, and supporting contracts in `packages/*`

## 1. Test Objectives

1. Prove each source client can parse and map upstream payloads correctly.
2. Prove ingest writes are idempotent and replay-safe.
3. Prove API routes are DB-backed and freshness-aware.
4. Prove region switching in UI reflects newly ingested data.

## 2. Test Stack

1. Unit and route tests: `vitest`
2. Parser/mapper fixtures: local JSON/CSV/XML snapshots in repo
3. Integration tests: API + test DB
4. Web contract tests: `@testing-library/react` + mocked fetch
5. E2E smoke (later phase): Playwright against running stack

## 3. Test Data Strategy

### 3.1 Fixture Buckets

1. `fixtures/abs/`:
  - housing lending sample payloads,
  - dwelling/cpi sample payloads.
2. `fixtures/aemo/`:
  - 5-minute dispatch/price sample windows with multi-region points.
3. `fixtures/aer/`:
  - plan list + plan detail samples (residential + non-residential).
4. `fixtures/rba/`:
  - monthly rates sample table extracts.

### 3.2 Required Edge Cases

1. Missing intervals in 5-minute wholesale data.
2. Negative wholesale prices.
3. Source schema drift (missing expected field).
4. Unknown region mapping in payload.
5. Duplicate records in same run.
6. Replay run with same payload checksum.
7. Release-day revision (same date, new vintage).

## 4. Contract-First Baseline (RED)

Before any new implementation:

1. Failing tests for required observation fields.
2. Failing tests for ingestion run metadata shape.
3. Failing tests for freshness status calculation.
4. Failing tests asserting fixture constants are no longer used by API repositories.

## 5. Red-Green Execution Slices

### Slice 1: Source Client Interfaces

RED tests:

1. each source client returns typed raw payload object.
2. client raises typed transient vs permanent error classes.

GREEN code:

1. `SourceClient` interface + source-specific client adapters.

### Slice 2: Raw Staging Persistence

RED tests:

1. stores raw payload with checksum and source metadata.
2. skips duplicate payload by checksum when rerun with same batch.

GREEN code:

1. `raw_snapshots` repository + checksum helper.

### Slice 3: AEMO Wholesale Mapper

RED tests:

1. maps fixture dispatch rows to `energy.wholesale.rrp.region_aud_mwh`.
2. computes AU demand-weighted aggregate series correctly.
3. handles missing intervals with degraded flag.

GREEN code:

1. mapper + aggregation service.

### Slice 4: AER PRD Mapper

RED tests:

1. filters residential plans only.
2. computes mean/median bill and tariff fields.
3. marks partial quality if expected fields missing.

GREEN code:

1. PRD parser + aggregator.

### Slice 5: ABS Housing Mapper

RED tests:

1. maps lending/dwelling series to canonical IDs.
2. region code mapping for `AU` + states + capitals.
3. invalid source dimensions fail with typed errors.

GREEN code:

1. ABS mapping adapters.

### Slice 6: RBA Rates Mapper

RED tests:

1. maps OO variable/fixed rates to canonical series.
2. monthly effective date conversion is deterministic.

GREEN code:

1. RBA rates parser + mapper.

### Slice 7: Upsert + Idempotency

RED tests:

1. same `(series_id, region_code, date, vintage)` does not duplicate.
2. new vintage inserts new row while preserving history.
3. replay backfill across overlapping windows remains consistent.

GREEN code:

1. upsert repository with unique index constraints.

### Slice 8: Freshness Engine

RED tests:

1. per-series cadence maps to correct stale thresholds.
2. freshness status computed correctly for fresh/stale/degraded.

GREEN code:

1. shared freshness calculator used by ingest + API.

### Slice 9: API Repository Swap (Fixture Removal)

RED tests:

1. `/api/housing/overview` and `/api/energy/overview` must read from repository layer.
2. tests fail if fixture constants are used in route path.

GREEN code:

1. DB-backed repository implementations + route wiring.

### Slice 10: Metadata Endpoints

RED tests:

1. `/api/metadata/freshness` returns stale inventory from DB state.
2. `/api/metadata/sources` returns source registry with cadence metadata.

GREEN code:

1. metadata query services.

### Slice 11: Job Scheduling and Retry Semantics

RED tests:

1. each job schedule is registered with expected cadence.
2. transient failures retry up to max policy.
3. permanent parser errors fail fast and emit alert event.

GREEN code:

1. scheduler + retry wrappers.

### Slice 12: Web Integration Guard

RED tests:

1. region switch triggers both energy and housing refetch.
2. error state shows `DATA_UNAVAILABLE` for failed fetches.
3. recovered fetch replaces error with live values.

GREEN code:

1. web fetch orchestration hardening.

## 6. Ingestion Integration Tests

Required suites:

1. `sync-energy-wholesale-5m.integration.test.ts`
2. `sync-energy-retail-prd-hourly.integration.test.ts`
3. `sync-housing-abs-daily.integration.test.ts`
4. `sync-housing-rba-daily.integration.test.ts`
5. `sync-macro-abs-cpi-daily.integration.test.ts`

Assertions for each:

1. run status transitions (`running -> ok` or `running -> failed`).
2. rows inserted/updated counts are correct.
3. freshness metadata updates.
4. rerun idempotency holds.

## 7. Performance and Reliability Tests

1. `GET /api/energy/overview` P95 < 300 ms warm.
2. `GET /api/housing/overview` P95 < 300 ms warm.
3. 5-minute job completes within 60 seconds under normal payload size.
4. retry tests confirm bounded total retry duration.

## 8. CI Gates

Order:

1. Typecheck.
2. Unit tests (all workspaces).
3. Mapper fixture tests.
4. Ingestion integration tests with ephemeral DB.
5. API contract tests.
6. Web integration tests.
7. Coverage threshold checks.

Coverage floors:

1. mappers/parsers: >= 90%.
2. ingest orchestrators: >= 85%.
3. freshness + aggregation modules: >= 95%.

## 9. Release Readiness Checklist

1. 14-day burn-in with no unresolved critical stale alerts.
2. Backfill dry-run for last 90 days completed.
3. Replay test with duplicate payloads passes.
4. Fixture-backed production code paths removed.
5. Runbooks for failure triage and manual replay are documented.

## 10. Immediate Next RED Tests

1. `apps/ingest/tests/aemo-wholesale-live.mapper.test.ts`
2. `apps/ingest/tests/abs-housing-live.mapper.test.ts`
3. `apps/ingest/tests/ingestion-raw-snapshot.test.ts`
4. `apps/api/tests/housing-overview-db-backed.test.ts`
5. `apps/api/tests/energy-overview-db-backed.test.ts`
