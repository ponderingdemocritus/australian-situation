# TDD Plan: Australia Housing + Energy Control Center (V1)

- Date: 2026-02-27
- Rule: no production code without a failing test first
- Scope: ingestion, normalization, APIs, UI, and end-to-end flows for Housing + Energy

## 1. Testing Objectives

1. Guarantee correctness of financial and energy metric calculations.
2. Guarantee data integrity and provenance for every observation.
3. Guarantee stable API contracts for UI and future integrations.
4. Guarantee freshness behavior and stale-data alerts.

## 2. Test Stack

1. Unit + API integration: `vitest`
2. API request tests: `hono` test harness + supertest-style assertions
3. Web component tests: `@testing-library/react` + `vitest`
4. E2E flows: `playwright`
5. Contract/schema checks: `zod` or JSON schema validation
6. DB contract checks: Drizzle migration tests against ephemeral Postgres

## 3. Test Environments

1. Local:
  - deterministic fixtures from `apps/ingest/tests/fixtures`
  - isolated test database
2. CI:
  - ephemeral Postgres container
  - deterministic clock for time-dependent freshness logic
3. Pre-release:
  - replay selected ingestion jobs against sandboxed copies

## 4. Coverage and Quality Gates

1. Domain modules: >= 90% line coverage.
2. Critical calculators (`serviceability`, `energy aggregation`, `household estimate`): >= 95%.
3. API route modules: >= 85%.
4. Ingestion parser/mappers: >= 90%.
5. E2E smoke: all must pass for merge to release branch.

## 5. Test Data Strategy

### 5.1 Fixtures

1. Housing fixtures:
  - ABS lending sample payloads.
  - ABS dwelling value sample payloads.
  - RBA housing rates sample payloads.
2. Energy fixtures:
  - AEMO 5-minute reference price samples.
  - AER PRD plan list and plan detail samples.
  - DMO benchmark sample tables.
3. Macro fixtures:
  - ABS CPI electricity index sample points.

### 5.2 Edge Cases

1. Missing intervals in 5-minute AEMO feed.
2. Negative or zero wholesale prices.
3. Plan data with missing controlled-load fields.
4. Unknown region mapping from source payload.
5. Revisions where same date has new vintage.
6. Delayed publication causing stale status.

## 6. Contract-First Baseline

Before implementation, add failing contract tests for:

1. Required observation fields:
  - `series_id`, `date`, `value`, `unit`, `region_code`, `source_url`, `ingested_at`, `vintage`, `is_modeled`.
2. Standard API envelope:
  - `data`, `meta`, `errors` shape.
3. Freshness metadata:
  - `updated_at`, `freshness_status`, `expected_cadence`.
4. Provenance on modeled metrics:
  - `methodology_version`, `method_summary`.

## 7. Red/Green Execution Backlog

Execution rule:

1. Write failing tests.
2. Implement smallest code change to pass.
3. Refactor with tests green.
4. Commit by vertical slice.

### Slice 1: Region and Series Contract

RED tests:

1. reject unsupported region codes in all routes.
2. reject unknown `series_id`.
3. validate frequency-unit compatibility.

GREEN code:

1. shared validators in `packages/data-contract`.
2. route-level parameter guards.

### Slice 2: Housing Serviceability Engine

RED tests:

1. computes repayment from principal/rate/term.
2. computes burden ratio from income.
3. returns stress bands by configured thresholds.
4. rejects invalid inputs.

GREEN code:

1. pure `calculateServiceability` function.
2. config-driven threshold mapping.

### Slice 3: Housing Overview API

RED tests:

1. returns latest snapshot for required housing series.
2. respects region filter.
3. includes freshness metadata.
4. stable sorting and null fallback behavior.

GREEN code:

1. repository query + response mapper.
2. `GET /api/housing/overview`.

### Slice 4: Generic Series API

RED tests:

1. supports `from`, `to`, `region`.
2. returns ascending date order.
3. returns typed error for invalid ranges.

GREEN code:

1. `GET /api/series/:id` query path and schema.

### Slice 5: Housing Ingestion Normalization

RED tests:

1. ABS lending fixture maps to canonical IDs.
2. RBA rates fixture maps to canonical IDs.
3. rerun upserts do not duplicate rows.

GREEN code:

1. parser + mapper + upsert jobs.

### Slice 6: Energy Wholesale Aggregation

RED tests:

1. AEMO fixture maps to `energy.wholesale.rrp.region_aud_mwh`.
2. AU weighted index computes correctly for configured weighting basis.
3. supports windows `5m`, `1h`, `24h`.
4. handles missing intervals without crashing and marks degraded status.

GREEN code:

1. wholesale mapper and rollup service.
2. `GET /api/energy/live-wholesale`.

### Slice 7: Energy Retail Average

RED tests:

1. AER PRD fixture maps plan data to annual bill and usage rate metrics.
2. residential-only filter enforced.
3. mean/median outputs match fixture expectations.
4. missing plan fields handled with partial-quality flags.

GREEN code:

1. retail parser + aggregator.
2. `GET /api/energy/retail-average`.

### Slice 8: Energy Benchmark and Context

RED tests:

1. DMO benchmark values appear in overview response.
2. CPI electricity series joins correctly by latest period.
3. region without benchmark coverage returns explicit `not_available`.

GREEN code:

1. benchmark ingestion and join logic.
2. `GET /api/energy/overview`.

### Slice 9: Modeled Household Estimate (Feature-Flagged)

RED tests:

1. endpoint blocked when feature flag disabled.
2. enabled endpoint returns `is_modeled=true` and provenance fields.
3. methodology version mismatch fails contract tests.

GREEN code:

1. estimate service + feature flag guard.
2. `GET /api/energy/household-estimate`.

### Slice 10: Freshness and Staleness Framework

RED tests:

1. freshness status computes per series cadence.
2. stale banner appears in UI when threshold breached.
3. metadata endpoint returns stale-series inventory.

GREEN code:

1. freshness calculator shared across API and UI.
2. `GET /api/metadata/freshness`.

### Slice 11: UI Rendering and Region Sync

RED tests:

1. overview cards render source, value, delta, and freshness badge.
2. one region selector updates housing and energy panels.
3. modeled metrics show required badge and tooltip text.

GREEN code:

1. unified filter state management.
2. overview page components.

### Slice 12: Scenario Persistence + Watchlist

RED tests:

1. save/reload scenario persists valid payloads.
2. invalid scenario payloads rejected.
3. watchlist items render with qualitative confidence and source URLs.

GREEN code:

1. scenario and watchlist route implementations.

### Slice 13: E2E Critical Paths

RED tests:

1. first load housing + energy overview.
2. switch region and verify all panels update.
3. load wholesale panel and verify near-live timestamp.
4. save serviceability scenario and reload.
5. open stress watchlist and verify source attribution.

GREEN code:

1. final integration fixes across web/api/ingest boundaries.

## 8. API Contract Tests (Required)

For each endpoint:

1. validates query params and enums.
2. validates response JSON schema.
3. verifies source/provenance metadata is present.
4. verifies error schema on failures.

Required endpoint list:

1. `/api/housing/overview`
2. `/api/series/:id`
3. `/api/housing/serviceability`
4. `/api/housing/scenarios` (`GET`, `POST`)
5. `/api/housing/stress/watchlist`
6. `/api/energy/live-wholesale`
7. `/api/energy/retail-average`
8. `/api/energy/overview`
9. `/api/energy/household-estimate`
10. `/api/metadata/sources`
11. `/api/metadata/freshness`

## 9. Ingestion Reliability Tests

1. Scheduler trigger tests for each job cadence.
2. Retry policy tests:
  - transient HTTP 5xx retries,
  - permanent schema failures do not retry indefinitely.
3. Idempotency tests:
  - rerun same fixture twice, row count unchanged.
4. Replay tests:
  - backfill historical window does not break uniqueness.

## 10. Performance Tests

1. API benchmark tests:
  - `housing/overview` P95 < 300ms warm.
  - `energy/live-wholesale` P95 < 300ms warm.
2. Query plan tests for highest-volume series routes.
3. Caching tests:
  - expected cache hit behavior for overview payloads.

## 11. CI Pipeline Order

1. Typecheck.
2. Unit tests.
3. Contract tests.
4. API integration tests.
5. Ingestion fixture tests.
6. E2E smoke.
7. Coverage threshold checks.
8. Migration up/down validation.

Merge blocked if any stage fails.

## 12. Release Exit Criteria

1. All red/green slices completed with tests checked in.
2. Coverage thresholds satisfied.
3. No flaky tests in last 10 CI runs.
4. Staging replay run completed for latest month and latest week data windows.
5. Manual product validation:
  - source links visible,
  - freshness badges accurate,
  - modeled badge behavior correct.

## 13. Proposed Test File Layout

`apps/api/tests`:

1. `housing-overview.route.test.ts`
2. `series.route.test.ts`
3. `energy-live-wholesale.route.test.ts`
4. `energy-retail-average.route.test.ts`
5. `energy-overview.route.test.ts`
6. `metadata-freshness.route.test.ts`

`apps/ingest/tests`:

1. `abs-housing.mapper.test.ts`
2. `aemo-wholesale.mapper.test.ts`
3. `aer-prd.mapper.test.ts`
4. `dmo-benchmark.mapper.test.ts`
5. `idempotent-upsert.test.ts`

`apps/web/tests`:

1. `overview-page.test.tsx`
2. `region-selector-sync.test.tsx`
3. `modeled-metric-labeling.test.tsx`
4. `stale-banner.test.tsx`

`tests/e2e`:

1. `housing-energy-overview.spec.ts`
2. `region-switch.spec.ts`
3. `serviceability-scenario.spec.ts`
4. `watchlist-and-provenance.spec.ts`

## 14. Immediate Sprint Start (First 5 RED Tests)

1. Contract test for `GET /api/energy/live-wholesale` response shape.
2. Unit test for AU weighted wholesale aggregation.
3. Mapper test for AER PRD residential plan filtering.
4. Route test for `GET /api/energy/retail-average` invalid region handling.
5. UI test for modeled badge rendering guard.
