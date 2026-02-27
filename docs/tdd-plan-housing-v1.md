# TDD Plan: Housing V1

- Date: 2026-02-27
- Rule: no production code without a failing test first
- Scope: `Next.js` frontend, `Hono` API, ingestion jobs, DB contract

## 1. Test Stack

- Unit/API tests: `vitest`
- API integration tests: `@hono/hono` request testing + test DB
- Frontend component tests: `@testing-library/react` + `vitest`
- E2E tests: `playwright`
- Contract tests:
  - JSON schema validation for API responses
  - ingestion fixture tests for source-to-canonical mapping

## 2. Test Layers

1. Domain unit tests
  - Serviceability math
  - Exposure score composition
  - Heat badge ranking logic
2. Data contract tests
  - Required dimensions (`series_id`, `date`, `value`, `region_code`, `source`, `vintage`)
  - Frequency consistency and null handling
3. API route tests
  - parameter validation
  - response shape and sorting
  - cache headers
4. Web UI tests
  - overview tiles render with expected formatting
  - region toggle updates all visible charts
  - scenario save/reload behavior
5. E2E flow tests
  - first load overview
  - switch region
  - run serviceability scenario
  - open stress watchlist

## 3. Red-Green Backlog (Execution Order)

## Slice 1: Serviceability engine

- RED tests:
  - computes monthly repayment from principal, rate, and term
  - returns burden ratio and stress band
  - rejects invalid inputs (`loan <= 0`, `income <= 0`, malformed rate)
- GREEN code:
  - pure function `calculateServiceability(input)`

## Slice 2: Overview snapshot API

- RED tests:
  - returns latest point for required series set
  - respects `region` filter and missing-series fallback
  - response time budget guard (integration benchmark threshold)
- GREEN code:
  - `GET /api/housing/overview`

## Slice 3: Region-aware series endpoint

- RED tests:
  - `GET /api/series/:id` returns ordered points and date filtering
  - rejects unsupported region or unknown series id with structured errors
- GREEN code:
  - series query route + repository adapter

## Slice 4: Ingestion normalization

- RED tests:
  - ABS sample fixture maps to canonical lending series ids
  - RBA sample fixture maps to canonical rate series ids
  - rerun is idempotent (no duplicate observation rows)
- GREEN code:
  - parser and upsert pipeline for fixtures

## Slice 5: Overview page UI

- RED tests:
  - displays all required tiles from API payload
  - region change refetches and rerenders numbers
  - stale-data banner appears when `updated_at` exceeds threshold
- GREEN code:
  - overview route and tile components

## Slice 6: Scenario persistence

- RED tests:
  - save scenario via API and retrieve in list
  - load saved scenario pre-fills widget inputs
- GREEN code:
  - scenario table, routes, and UI hooks

## Slice 7: Stress watchlist

- RED tests:
  - watchlist entries render with `source`, `published_at`, `confidence=qualitative`
  - region filter behaves consistently
- GREEN code:
  - watchlist data model + page + endpoint

## 4. CI Gates

- Required for merge:
  - `lint`
  - all unit/integration tests
  - e2e smoke tests
  - migration validation (up/down on ephemeral DB)
- Coverage floor:
  - domain and API: 85% lines minimum
  - critical calculation modules: 95% lines minimum

## 5. Test Data Strategy

- Use deterministic fixtures committed in-repo for ABS/RBA sample payloads.
- Use seeded test DB snapshots for region and series metadata.
- Add synthetic edge cases:
  - missing quarter
  - negative revision
  - delayed update timestamp

## 6. Exit Criteria for V1

1. Every shipped behavior has a test that was observed failing first.
2. All CI gates pass on main branch.
3. No `TODO` markers in critical path routes or calculators.
4. Data freshness and scenario workflows are covered by e2e smoke tests.
