# TDD Plan: Electricity Prices (AU vs Global) V1

Status: Mandatory execution approach
Date: 2026-02-28

## 1) TDD Rules for This Project
1. No production code before a failing test.
2. Every new endpoint and mapper starts with a RED test.
3. Every RED test must fail for the intended missing behavior.
4. Only minimal GREEN implementation per step.
5. Refactor only after GREEN and keep tests green.

## 2) Test Strategy by Layer
1. Contract tests in `packages/data-contract`.
2. Schema and persistence tests in `packages/db`.
3. Source client and job tests in `apps/ingest/tests`.
4. Route and repository tests in `apps/api/tests`.
5. Dashboard mapping/render tests in `apps/web/tests`.
6. End-to-end smoke for critical comparison flow in `tests/e2e/specs`.

## 3) Implementation Sequence (Red -> Green -> Refactor)

### Step A: Contract-first
Files:
1. `packages/data-contract/src/series.ts`
2. `packages/data-contract/tests/energy-series-contract.test.ts` (new)

RED tests to add first:
1. `defines required wholesale comparison series ids`
2. `defines required retail comparison series ids`
3. `rejects unknown tax status enum`
4. `rejects unknown consumption band enum`

GREEN target:
1. Add new series IDs and enums only, no extra behavior.

### Step B: DB schema and repository support
Files:
1. `packages/db/src/schema.ts`
2. `packages/db/tests/schema-contract.test.ts`

RED tests:
1. `observations schema includes methodology metadata columns`
2. `comparison query index exists`
3. `uniqueness key remains idempotent after metadata extension`

GREEN target:
1. Add minimal migration/schema fields and indexes.

### Step C: Source clients and mappers
Files:
1. `apps/ingest/src/sources/live-source-clients.ts`
2. `apps/ingest/src/mappers/*.ts` (new files per source)
3. `apps/ingest/tests/source-clients.test.ts`
4. `apps/ingest/tests/*` new mapper tests

RED tests:
1. `parses EIA payload into canonical wholesale/retail points`
2. `parses ENTSO-E payload and preserves bidding zone metadata`
3. `parses Eurostat nrg_pc_204 with tax and band fields`
4. `parses World Bank FX and PPP indicators`
5. `throws non-transient schema drift errors for malformed payloads`

GREEN target:
1. Minimal parser/mapping logic to pass each source case.

### Step D: Ingestion jobs
Files:
1. `apps/ingest/src/jobs/sync-energy-wholesale-global.ts` (new)
2. `apps/ingest/src/jobs/sync-energy-retail-global.ts` (new)
3. `apps/ingest/src/jobs/sync-energy-normalization.ts` (new)
4. `apps/ingest/src/scheduler.ts`
5. `apps/ingest/tests/*` new job tests

RED tests:
1. `upserts canonical global wholesale rows idempotently`
2. `upserts canonical global retail rows with tax_status and consumption_band`
3. `normalizes nominal and ppp values from fx inputs`
4. `scheduler includes new global jobs`
5. `retries transient upstream errors and alerts on terminal failure`

GREEN target:
1. Add jobs/schedule wiring and minimal upsert behavior.

### Step E: API comparison endpoints
Files:
1. `apps/api/src/app.ts`
2. `apps/api/src/domain/energy-comparison.ts` (new)
3. `apps/api/src/repositories/*` (store and postgres support)
4. `apps/api/tests/*` new route tests

RED tests:
1. `GET /api/v1/energy/compare/retail returns AU vs peers with rank and gap`
2. `GET /api/v1/energy/compare/wholesale returns percentile and spread`
3. `GET /api/v1/metadata/methodology returns metric metadata`
4. `compare endpoints reject unsupported basis/tax/band filters`
5. `compare endpoints return structured errors for unknown peers`

GREEN target:
1. Implement minimal route + domain behavior that satisfies response contracts.

### Step F: Dashboard integration
Files:
1. `apps/web/features/dashboard/components/*`
2. `apps/web/features/dashboard/lib/overview.ts`
3. `apps/web/tests/*` new tests

RED tests:
1. `renders AU vs peers retail table from compare endpoint`
2. `switching nominal/ppp toggles displayed values and labels`
3. `shows methodology badges and freshness status`
4. `handles partial data with quality warning banner`

GREEN target:
1. Add minimal UI wiring and parser updates.

### Step G: End-to-end critical path
Files:
1. `tests/e2e/specs/electricity-comparison.spec.ts` (new)

RED tests:
1. `user can load AU vs global view and switch basis`
2. `user sees API-backed rank, spread, and freshness`

GREEN target:
1. Minimum stable E2E path for release gate.

## 4) Test Data Fixtures
1. Add deterministic fixtures for AU, US, and EU sample periods.
2. Include one mismatch fixture to validate tax/band guardrails.
3. Include stale data fixture to test freshness signaling.

## 5) Definition of Done (TDD)
1. Every new behavior has a test that failed first.
2. `bun --filter @aus-dash/data-contract test` passes.
3. `bun --filter @aus-dash/db test` passes.
4. `bun --filter @aus-dash/ingest test` passes.
5. `bun --filter @aus-dash/api test` passes.
6. `bun --filter @aus-dash/web test` passes.
7. `bun --filter @aus-dash/web build` passes.
8. New endpoints are documented with sample responses.
9. Freshness/source metadata assertions are covered in API tests.

## 6) Suggested PR Breakdown
1. PR-1: Data contract and schema updates + tests.
2. PR-2: Global source clients and mapper tests.
3. PR-3: Global ingest jobs and scheduler tests.
4. PR-4: API comparison endpoints and metadata endpoint tests.
5. PR-5: Dashboard comparison UI and tests.
6. PR-6: E2E smoke and launch runbooks.
