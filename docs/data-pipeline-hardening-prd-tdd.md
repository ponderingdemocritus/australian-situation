# Data Pipeline Hardening PRD + TDD Plan

## 1. Context

The current live-data pipeline spans three major layers:

1. Ingest jobs under `apps/ingest/src/jobs`.
2. Shared store primitives under `packages/shared/src/live-store.ts`.
3. API read paths under `apps/api/src/repositories`.

The review surfaced a pattern of partial duplication across those layers:

1. Every ingest job branches separately for `store` and `postgres`.
2. The API maintains two near-copy repository implementations.
3. Source catalog metadata is registered in multiple places.
4. "Latest observation" logic is implemented separately from the write model that already defines `vintage` as part of identity.

Those duplications are now causing correctness issues rather than only maintainability issues.

## Status

- [x] F-1 Concurrent store-write race removed via phased scheduler execution.
- [x] F-2 Normalization-derived comparison drift removed across backends.
- [x] F-3 Revision-aware latest selection implemented for store and Postgres reads.
- [x] F-4 Fixture-era live metadata leakage reduced for affected ingest jobs.
- [x] F-5 Regional fallback now reports modeled responses when AU fallback is used.
- [x] F-6 Source catalog centralized and older stores are backfilled on read.
- [x] F-7 Repeated ingest persistence branches replaced with a shared helper.

## 2. Review Findings To Address

### F-1 Concurrent Store Writes

The scheduler runs jobs in parallel while `store` remains the default ingest backend. Each job independently reads, mutates, and rewrites the same JSON store. This creates last-writer-wins races and can drop:

1. Observations.
2. Raw snapshots.
3. Source cursors.
4. Ingestion runs.

### F-2 Derived Data Drift Between Backends

`sync-energy-normalization` derives comparison series in the store path but not in the Postgres path. As a result:

1. Store and Postgres contain different datasets.
2. API compare endpoints can behave differently by backend.

### F-3 Revision Semantics Are Not Respected

The database schema defines `(seriesId, regionCode, date, vintage)` as the unique observation identity, but read paths choose the latest observation by `date` only. When multiple vintages share the same logical date:

1. Reads become nondeterministic.
2. Older revisions can be returned as current.
3. Metadata freshness can use stale values.

### F-4 Hardcoded Fixture Dates In Live Jobs

Several jobs still write fixture-era `date`, `publishedAt`, `vintage`, or cursor values even in live mode. This breaks:

1. Freshness calculations.
2. Incremental update behavior.
3. Revision history.
4. Backfill accuracy.

### F-5 Silent Regional Fallback

The API accepts state-level energy regions, but ingest only refreshes AU-level retail averages and AU-level wholesale aggregates for some series. Read paths silently fall back to AU values while returning `isModeled: false`, which misrepresents the data provenance.

### F-6 Source Catalog Drift

Postgres global-source jobs upsert extra catalog entries, but store-mode jobs do not update `store.sources`. This causes:

1. `/api/metadata/sources` mismatch by backend.
2. Incomplete source provenance in store mode.
3. Lossy backfill when moving store data into Postgres.

### F-7 WET Persistence Code

Each ingest job repeats the same persistence pattern:

1. Resolve backend.
2. Ensure source catalog.
3. Stage raw payloads.
4. Upsert observations.
5. Set source cursors.
6. Append ingestion run.

This duplication already allowed behavioral drift.

## 3. Problem Statement

The pipeline does not currently guarantee that the same ingest run produces the same durable state across supported backends. It also does not guarantee deterministic reads once multiple vintages exist for the same logical observation date.

Result:

1. The default ingest mode can lose data under normal scheduler execution.
2. API responses can drift by backend.
3. Provenance metadata is incomplete.
4. Future pipeline changes will continue to duplicate risk across every new job.

## 4. Goals

1. Make ingest execution deterministic for both `store` and `postgres`.
2. Guarantee dataset parity for all shared API behaviors.
3. Respect `vintage` as part of read selection semantics.
4. Remove duplicated backend write logic from individual jobs.
5. Ensure source metadata and derived observations are identical across backends.
6. Preserve backward compatibility for API consumers unless behavior is currently incorrect.

## 5. Non-Goals

1. Remove the `store` backend entirely in this phase.
2. Redesign API payload shapes beyond bug-fix corrections.
3. Replace the JSON live store with a new storage format.
4. Introduce new data domains beyond energy, housing, and macro.
5. Rework frontend dashboard behavior outside of contract parity fixes.

## 6. Scope

### In Scope

1. `apps/ingest/src/index.ts`
2. `apps/ingest/src/scheduler.ts`
3. `apps/ingest/src/jobs/sync-*.ts`
4. `apps/ingest/src/repositories/*`
5. `apps/ingest/src/scripts/backfill-store-to-postgres.ts`
6. `packages/shared/src/live-store.ts`
7. `apps/api/src/repositories/live-store-repository.ts`
8. `apps/api/src/repositories/postgres-live-repository.ts`
9. `apps/api/tests/*`
10. `apps/ingest/tests/*`
11. `packages/shared/tests/*`
12. `README.md` endpoint table only if route behavior is clarified or corrected

### Out of Scope

1. New external data sources.
2. UI redesign.
3. Auth or rate limiting.
4. A larger event-driven ingest architecture.

## 7. Users And Stakeholders

1. API maintainers who need backend parity and predictable contracts.
2. Ingest maintainers who need safe scheduling and low-friction job additions.
3. Analytics consumers who depend on correct freshness and provenance.
4. Test and release owners who need deterministic behavior across environments.

## 8. User Stories

1. As an ingest maintainer, I want store-mode runs to preserve every job mutation so local and fixture workflows are trustworthy.
2. As an API maintainer, I want Postgres and store to return equivalent responses for shared routes so backend choice does not alter behavior.
3. As a data consumer, I want the newest revision returned when multiple vintages exist for the same reporting period.
4. As a maintainer, I want adding a new source to require one persistence workflow instead of duplicating store/Postgres branches.
5. As a provenance consumer, I want metadata sources to list every active source regardless of backend.

## 9. Functional Requirements

### FR-1 Safe Scheduler Execution

1. Store-mode ingest must not perform concurrent read-modify-write cycles against the same JSON file.
2. The scheduler must support dependency ordering between jobs.
3. Derived jobs must execute only after their upstream inputs are durably available for that run.
4. Default execution must be safe without requiring environment changes.

### FR-2 Unified Persistence Contract

1. Each job must produce a backend-agnostic persistence payload.
2. The persistence payload must support these fields:
3. `sourceCatalog`
4. `rawSnapshots`
5. `observations`
6. `sourceCursors`
7. `ingestionRun`
8. Both backends must apply the same payload semantics.
9. No job may maintain separate business behavior between store and Postgres branches.

### FR-3 Derived Observation Parity

1. Derived comparison observations must be produced for both backends.
2. The normalization job must derive comparison observations from the same effective source set in both backends.
3. Compare endpoints must return equivalent results for store and Postgres given equivalent persisted state.

### FR-4 Revision-Aware Read Semantics

1. "Latest" selection must consider `date` and `vintage`.
2. When `date` ties exist, the newest `vintage` must win.
3. If `vintage` also ties, read order must be deterministic using a stable secondary rule.
4. Store and Postgres must use the same latest-selection rule.

### FR-5 Accurate Live Timestamps And Cursors

1. Live ingest mode must derive `date`, `publishedAt`, `vintage`, and cursor values from the upstream payload or a deterministic transform of it.
2. Fixture mode may continue using fixture values, but those values must not leak into live-mode paths.
3. Job tests must assert live-mode timestamp derivation explicitly.

### FR-6 Source Catalog Consistency

1. Source catalog registration must be centralized in one canonical registry.
2. Store-mode jobs must upsert source catalog entries just like Postgres jobs.
3. Metadata sources endpoint must return equivalent catalogs for both backends.
4. Store-to-Postgres backfill must not lose catalog entries when the store was created before the registry was centralized.

### FR-7 Honest Fallback Semantics

1. If a region falls back to AU data, the response must reflect that behavior explicitly.
2. Silent fallback must not continue to return `isModeled: false` unless the data is truly the native regional series.
3. This phase may resolve the issue in one of two ways:
4. ingest regional series where the API promises them
5. keep fallback but mark fallback values as modeled and document the behavior
6. The chosen behavior must be consistent across both backends.

### FR-8 Backward Compatibility

1. Existing response keys must remain stable unless a documented bug fix requires a value correction.
2. Any route behavior change must be covered by API tests.
3. Any route behavior change must update `README.md` endpoint documentation.

## 10. Non-Functional Requirements

1. Determinism: repeated runs over the same payload set must produce identical durable state.
2. Reliability: no data loss from scheduler concurrency in default configuration.
3. Maintainability: new jobs should add business logic once and persistence logic once.
4. Testability: each bug fix must be protected by failing tests before implementation.
5. Observability: structured ingestion alert output remains intact.
6. Performance: Postgres mode may remain parallel where safe, but correctness takes priority over throughput.

## 11. Target Design

### 11.1 Execution Model

The scheduler will move from "all jobs in one `Promise.all`" to a dependency-aware run plan.

Target model:

1. Phase 1 base-source jobs:
2. `sync-housing-series`
3. `sync-housing-rba`
4. `sync-energy-wholesale`
5. `sync-energy-wholesale-global`
6. `sync-energy-retail-plans`
7. `sync-energy-retail-global`
8. `sync-energy-benchmark-dmo`
9. `sync-macro-abs-cpi`
10. Phase 2 derived jobs:
11. `sync-energy-normalization`

Execution rules:

1. Store backend runs phases serially and jobs serially within a phase.
2. Postgres backend may run jobs in parallel within a phase if no direct dependency exists.
3. Derived jobs run only after all upstream base jobs finish successfully for that run.

This fixes both the file race and the normalization dependency problem.

### 11.2 Unified Ingest Result Contract

Each job should return a persistence payload such as:

1. `sourceCatalog: SourceCatalogItem[]`
2. `rawSnapshots: StageRawPayloadInput[]`
3. `observations: LiveObservation[]`
4. `sourceCursors: Array<{ sourceId: string; cursor: string }>`
5. `ingestionRun: Omit<IngestionRun, "runId">`

Then a shared persistence adapter applies that payload.

Suggested abstraction:

1. `IngestPersistenceAdapter`
2. `createStoreIngestAdapter`
3. `createPostgresIngestAdapter`
4. `persistIngestResult(adapter, payload)`

Benefits:

1. Jobs stop branching on backend for write semantics.
2. Store and Postgres behavior converge automatically.
3. New jobs only own fetch/parse/map logic.

### 11.3 Store Session Strategy

Store backend should not let each job reopen the file independently during one scheduler run.

Preferred approach:

1. Load the store once at scheduler start for store mode.
2. Pass a store-backed adapter over that in-memory object to every job in run order.
3. Write the JSON store once at the end of each job or once at end-of-run depending on failure requirements.

Recommended implementation for this phase:

1. Write after each successful job to preserve crash recovery.
2. Keep the in-memory store instance shared through the run to eliminate lost updates.

### 11.4 Canonical Source Registry

Create one canonical registry for source metadata and consume it from:

1. seed store creation
2. ingest jobs
3. metadata sources endpoints
4. backfill script

Rules:

1. Global energy sources must exist in the same registry as seed sources.
2. Jobs may reference subsets, but source definitions are declared once.
3. Store-mode persistence must upsert source catalog entries before writing.

### 11.5 Revision-Aware Selection Rules

Create shared "latest observation" semantics that both repositories use.

Target precedence:

1. highest `date`
2. highest `vintage`
3. highest `publishedAt`
4. highest `ingestedAt`
5. stable tiebreaker on source identity if still tied

Implementation notes:

1. Store repository should reuse a shared comparator instead of ad hoc `sortByDateDesc`.
2. Postgres repository should query with explicit ordering instead of fetching the full list and choosing the last record by date.
3. Country comparison helpers must use the same precedence.

### 11.6 Live Timestamp Policy

Every job must define how it derives:

1. observation `date`
2. `publishedAt`
3. `vintage`
4. source cursor

Rules:

1. If upstream exposes a period or interval, that becomes `date`.
2. If upstream exposes publication time, use it directly.
3. If only a reporting date exists, `publishedAt` may be normalized deterministically.
4. `vintage` must represent the ingestion revision date for that payload, not a fixture constant.

### 11.7 Regional Fallback Policy

The implementation must choose one of two supported policies:

1. Ingest missing regional series so the API returns native regional data where promised.
2. Keep fallback, but mark fallback values as modeled and surface the provenance honestly.

Recommended for this phase:

1. Preserve current route shape.
2. Keep fallback where data is genuinely unavailable.
3. Mark fallback responses as modeled and document the behavior.

This is lower-risk than expanding ingest scope during the same hardening pass.

## 12. Delivery Plan

### PR-1 Scheduler Safety And Baseline Tests

Objective:

1. Eliminate store-mode data loss.
2. Introduce dependency-aware scheduling.

Changes:

1. Replace top-level `Promise.all` with phased execution.
2. Ensure store backend uses ordered execution.
3. Add normalization dependency ordering.

Acceptance criteria:

1. Store-mode scheduler preserves mutations from every job in one run.
2. Normalization executes after upstream jobs.
3. Existing scheduler retry behavior remains intact.

### PR-2 Unified Persistence Adapter

Objective:

1. Remove duplicated store/Postgres mutation code from jobs.

Changes:

1. Introduce a shared persistence payload contract.
2. Add store and Postgres adapters.
3. Migrate one job first, then all remaining jobs.

Acceptance criteria:

1. No job contains separate business logic by backend.
2. Source staging, observation upsert, cursor updates, and ingestion-run recording are applied uniformly.

### PR-3 Derived Data And Source Catalog Parity

Objective:

1. Make persisted datasets match across backends.

Changes:

1. Normalize comparison derivation across both backends.
2. Centralize source catalog registry.
3. Update store-mode source catalog writes.
4. Repair backfill script to use canonical catalog rules.

Acceptance criteria:

1. Compare endpoints match for store and Postgres.
2. Metadata sources match for store and Postgres.
3. Backfill preserves all source catalog entries.

### PR-4 Revision-Aware Reads

Objective:

1. Make latest-selection deterministic and aligned with the schema.

Changes:

1. Shared latest-selection helper and comparator.
2. Postgres query ordering updates.
3. Store repository updates.
4. Freshness and overview paths reuse the same rule.

Acceptance criteria:

1. Given two vintages for one date, both backends return the same newest revision.
2. Compare endpoints and metadata freshness reflect newest revision.

### PR-5 Live Timestamp And Fallback Cleanup

Objective:

1. Remove fixture-era live metadata and clarify regional fallback semantics.

Changes:

1. Derive live timestamps and cursors from payloads.
2. Separate fixture-mode constants from live-mode mapping.
3. Mark fallback responses honestly or ingest the missing regional data if chosen.
4. Update README if behavior clarification changes route semantics.

Acceptance criteria:

1. Live-mode tests prove timestamp derivation for affected jobs.
2. Freshness reflects real upstream periods.
3. Regional fallback behavior is explicit and tested.

## 13. TDD Plan

## Rule

Each code change in this effort must follow:

1. write one failing test
2. verify the failure is for the intended behavior
3. implement the smallest fix
4. rerun targeted tests
5. refactor only after green

### Phase A: Lock In Scheduler Failures

Add failing tests first:

1. `apps/ingest/tests/scheduler-store-serialization.test.ts`
2. `apps/ingest/tests/scheduler-dependency-order.test.ts`

Required red cases:

1. two store-mode jobs mutate different sections of the store and one mutation disappears under concurrent execution
2. normalization runs before upstream observations are present

Green implementation:

1. phase-aware scheduler
2. sequential store execution
3. explicit dependency ordering

Refactor:

1. move job definitions into a typed run-plan structure with `phase` and optional dependencies

### Phase B: Introduce Persistence Payload Contract

Add failing tests first:

1. `apps/ingest/tests/persistence-adapter-parity.test.ts`
2. extend existing job tests to assert identical store and Postgres persistence side effects

Required red cases:

1. same logical ingest payload produces different stored artifacts by backend
2. source cursors or raw snapshots are missing on one backend

Green implementation:

1. create persistence payload type
2. create store adapter
3. create Postgres adapter
4. migrate jobs one by one

Refactor:

1. extract repeated timestamp helpers and run-record builders

### Phase C: Fix Normalization Parity

Add failing tests first:

1. extend `apps/ingest/tests/sync-energy-normalization.test.ts`
2. extend `apps/api/tests/postgres-parity.test.ts`
3. add compare-endpoint parity assertions

Required red cases:

1. Postgres normalization run lacks `energy.retail.price.country.usd_kwh_ppp`
2. Postgres normalization run lacks derived `energy.wholesale.spot.country.usd_mwh`
3. `/api/v1/energy/compare/retail` or `/api/v1/energy/compare/wholesale` differs by backend

Green implementation:

1. derive comparison observations for both backends from the same observation set
2. persist those observations through the shared adapter

Refactor:

1. split normalization into pure mapping and derivation helpers with explicit inputs

### Phase D: Centralize Source Catalog

Add failing tests first:

1. extend `apps/api/tests/metadata-sources.test.ts`
2. add `apps/ingest/tests/source-catalog-parity.test.ts`
3. add test coverage for `backfill-store-to-postgres`

Required red cases:

1. store-mode metadata sources omits global sources after running global jobs
2. backfill fails to populate complete source catalog in Postgres from an older store

Green implementation:

1. create canonical source registry module
2. update seed store to consume it
3. make store-mode jobs upsert sources
4. merge catalog during backfill when needed

Refactor:

1. remove per-job duplicate source catalog arrays where possible and replace with registry references

### Phase E: Make Latest Selection Revision-Aware

Add failing tests first:

1. `apps/api/tests/live-data-latest-selection.test.ts`
2. extend `apps/api/tests/postgres-parity.test.ts`
3. add shared helper tests under `packages/shared/tests`

Required red cases:

1. same `date` with newer `vintage` still returns the older record
2. metadata freshness uses an older revision
3. country comparison rows select a stale revision when same-date duplicates exist

Green implementation:

1. shared comparator for latest selection
2. update store repository helpers
3. update Postgres ordering queries

Refactor:

1. remove duplicated "latest observation" logic from repository files

### Phase F: Remove Fixture Metadata Leakage From Live Mode

Add failing tests first:

1. extend `apps/ingest/tests/sync-energy-retail-plans.test.ts`
2. extend `apps/ingest/tests/sync-housing-series.test.ts`
3. extend `apps/ingest/tests/sync-macro-abs-cpi.test.ts`
4. add live-mode cursor assertions for affected jobs

Required red cases:

1. live-mode retail plans still writes `2026-02-27`
2. live-mode housing series still writes fixed publication dates unrelated to payload
3. live-mode CPI cursor and vintage are not derived from the latest payload period

Green implementation:

1. separate fixture mapping from live mapping
2. derive effective timestamps from payload metadata
3. update per-job cursor derivation

Refactor:

1. extract shared time-derivation helpers where formats repeat

### Phase G: Clarify Regional Fallback

Add failing tests first:

1. extend `apps/api/tests/energy-retail-average-repository.test.ts`
2. extend `apps/api/tests/postgres-parity.test.ts`
3. add route-level tests for non-AU regions

Required red cases:

1. region falls back to AU while response still claims non-modeled regional data
2. store and Postgres do not agree on fallback metadata

Green implementation:

1. apply chosen fallback policy consistently
2. update response flags and docs if needed

Refactor:

1. centralize fallback helper so overview and retail-average use the same semantics

## 14. Test Matrix

### Unit Tests

1. scheduler phase ordering
2. latest-observation comparator
3. source catalog registry helpers
4. timestamp derivation helpers
5. normalization derivation helpers

### Ingest Integration Tests

1. each job persists identical artifacts across backends
2. source cursor updates reflect live payloads
3. raw snapshot staging remains idempotent
4. ingestion runs are appended once per job execution

### API Integration Tests

1. parity for:
2. `/api/series/:id`
3. `/api/energy/live-wholesale`
4. `/api/energy/retail-average`
5. `/api/energy/overview`
6. `/api/metadata/freshness`
7. `/api/metadata/sources`
8. `/api/v1/energy/compare/retail`
9. `/api/v1/energy/compare/wholesale`

### Backfill Tests

1. store with raw snapshots, cursors, and ingestion runs backfills fully into Postgres
2. store missing newer catalog entries is repaired via canonical registry

## 15. Acceptance Criteria

1. Default store-mode ingest no longer loses data under scheduler execution.
2. Scheduler execution order guarantees normalization runs after its upstream jobs.
3. All ingest jobs use a shared persistence workflow instead of per-job backend branches for business behavior.
4. Store and Postgres persist identical derived comparison datasets.
5. Metadata sources output is equivalent across backends.
6. Latest-selection semantics are revision-aware and deterministic across backends.
7. Live-mode jobs no longer stamp fixture-era timestamps or cursors.
8. Regional fallback behavior is explicit and consistently represented in responses.
9. Backend parity tests cover compare endpoints and metadata sources in addition to current coverage.
10. `bun --filter @aus-dash/ingest test` passes.
11. `bun --filter @aus-dash/api test` passes.
12. `README.md` is updated if any route behavior clarification changes documented semantics.

## 16. Risks And Mitigations

1. Risk: scheduler changes alter throughput.
2. Mitigation: keep Postgres intra-phase parallelism where safe and measure after correctness is restored.

3. Risk: centralizing persistence touches every ingest job.
4. Mitigation: land via phased PRs and keep adapter contract narrow.

5. Risk: revision-aware reads reveal hidden seed-data inconsistencies.
6. Mitigation: add explicit fixture cleanup or move ambiguous seed cases into tests once behavior is codified.

7. Risk: fallback-policy clarification changes API values for some state queries.
8. Mitigation: keep payload shape stable, document the correction, and cover with API tests and README updates.

## 17. Definition Of Done

1. All acceptance criteria are met.
2. New tests were written before implementation for each fix area.
3. Store and Postgres parity suite covers all shared pipeline-critical routes.
4. No job contains duplicated backend-specific business behavior.
5. The repo contains one canonical source catalog registry.
6. The pipeline can be extended with a new source using one persistence workflow.
