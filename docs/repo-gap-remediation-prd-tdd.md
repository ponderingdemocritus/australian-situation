# Repo Gap Remediation PRD + TDD Plan

## 0. Delivery Status

- [x] Workstream A complete: API selector honesty, validation hardening, and generated OpenAPI contract checks are implemented and passing.
- [x] Workstream B complete: dashboard contract consumption, trust/provenance UI, scope handling, and retry/error-recovery behavior are implemented and passing.
- [x] Workstream C complete: queue execution metadata now survives through durable ingest run logging, and Postgres ingest persistence now enforces strict timestamps with transactional rollback coverage.
- [x] Workstream D complete: shared/store safety and contract enforcement coverage remain green under the repo-wide validation command.
- [x] Workstream E complete: root `lint`, `typecheck`, `validate`, `test:postgres`, `test:e2e:real`, and `validate:full` commands exist; CI now targets `master`, provisions Postgres, and runs a real browser flow without API mocks.

Verification completed:

- [x] `bun run validate`
- [x] `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/aus_dash bun run test:postgres`
- [x] `bun run test:e2e:real`

## 1. Context

The repo already contains focused planning docs for data-pipeline hardening and Postgres-first API abstraction. A fresh codebase audit shows the next layer of work is broader: public API selectors are not always behaviorally real, the dashboard drops trust/provenance semantics that the API already exposes, ingest replay metadata is not auditable end-to-end, and CI still does not exercise the real supported deployment matrix.

This document turns those repo-wide gaps into one prioritized PRD + TDD plan.

Audit scope:

1. `apps/api`
2. `apps/web`
3. `apps/ingest`
4. `packages/data-contract`
5. `packages/db`
6. `packages/shared`
7. root scripts, docs, and CI

Audit note:

1. Findings are from code inspection.
2. The local workspace did not have installed dependencies, so `bun run test` could not be executed because `vitest` was unavailable.

## 2. Problem Statement

The repo currently has four classes of gaps:

1. Contract honesty gaps: several public API query params and response fields imply behavior that is not actually implemented.
2. Trust and product-semantics gaps: the dashboard drops modeled/fallback/source metadata and mixes region-scoped views with AU-only comparison data.
3. Reliability and auditability gaps: ingest replay metadata, Postgres write safety, and timestamp validation are not strong enough for a Postgres-first operational posture.
4. Release-verification gaps: CI and repo scripts do not fully validate the store/Postgres/browser matrix the repo claims to support.

Result:

1. API consumers cannot fully trust selectors and payload semantics.
2. Dashboard users cannot tell when data is modeled, fallback-derived, or AU-scoped.
3. Operators cannot reliably audit backfills and queue replays.
4. Regressions can ship without hitting the actual runtime combinations used in production-like workflows.

## 3. Goals

1. Make every public API selector, enum, date filter, and response field behaviorally honest.
2. Make dashboard scope, provenance, and modeled/fallback semantics explicit to users.
3. Make ingest replay and backfill workflows auditable end-to-end.
4. Make Postgres persistence safe enough to act as the primary supported backend.
5. Centralize and enforce contracts across API, web, ingest, and storage.
6. Make CI validate the real supported backend and browser matrix.

## 4. Non-Goals

1. Introduce new business domains beyond current housing, energy, and macro coverage.
2. Rebuild the dashboard visual system from scratch.
3. Replace BullMQ or remove the JSON store entirely in this phase.
4. Add auth, rate limiting, or multi-tenant features.
5. Productize dormant schema concepts such as `scenarios` or `watchlist_items` unless they are explicitly pulled into scope later.

## 5. Users And Stakeholders

1. API consumers who need query params and payload fields to be trustworthy.
2. Dashboard users who need honest data provenance and scope cues.
3. Ingest/operators who need replay, backfill, and failure triage to be auditable.
4. Maintainers who need shared contracts and predictable backend behavior.
5. Release owners who need CI to exercise the actual supported matrix.

## 6. Gap Inventory

### G-1 High: Decorative Public API Selectors

Current examples:

1. `/api/energy/live-wholesale` validates `window` and echoes it back without changing calculations.
2. `/api/energy/retail-average` accepts `customer_type` but only copies it into the response.
3. `/api/energy/household-estimate` accepts `usage_profile` but always computes `annualBillAudMean / 12`.
4. `usageRateCKwhMean` and `dailyChargeAudDayMean` are exposed from repository responses as fixed values rather than data-backed measurements.

Impact:

1. Clients cannot trust selectors to drive behavior.
2. OpenAPI and README communicate semantics the implementation does not honor.

Primary evidence:

1. `apps/api/src/routes/energy-routes.ts`
2. `apps/api/src/repositories/live-store-repository.ts`
3. `apps/api/src/repositories/postgres-live-repository.ts`
4. `README.md`

### G-2 High: API Validation And Contract Hardening Are Still Incomplete

Current examples:

1. Most query schemas remain plain strings rather than enums or constrained date formats.
2. `housing/overview` does not reject unsupported regions.
3. `series/:id` accepts malformed or inverted `from`/`to` ranges and relies on raw string comparison.
4. The comparison API accepts arbitrary `country` values while keeping AU-specific response names such as `auRank` and `auPercentile`.

Impact:

1. API consumers receive weak guarantees.
2. OpenAPI cannot describe the real valid inputs precisely.
3. Versioning and client semantics remain ambiguous.

Primary evidence:

1. `apps/api/src/routes/route-contracts.ts`
2. `apps/api/src/routes/housing-routes.ts`
3. `apps/api/src/routes/series-routes.ts`
4. `apps/api/tests/energy-compare.test.ts`

### G-3 High: Backend Parity Coverage Is Still Narrow

Current examples:

1. API parity tests cover only a small subset of happy-path routes.
2. Ingest worker migration parity only exercises a few store-backed jobs.
3. Postgres-specific ingest tests stop at mapping/schema assertions instead of running real jobs against a database.

Impact:

1. `store` and `postgres` can still drift in behavior.
2. Postgres-first confidence remains incomplete.

Primary evidence:

1. `apps/api/tests/postgres-parity.test.ts`
2. `apps/ingest/tests/queue-job-migration-parity.test.ts`
3. `apps/ingest/tests/postgres-observation-mapping.test.ts`
4. `README.md`

### G-4 High: Dashboard Scope And Trust Semantics Are Incomplete

Current examples:

1. Region changes refetch energy and housing, but comparison data remains hardcoded to `country=AU&peers=US,DE`.
2. The dashboard parser drops `sourceRefs`, `methodSummary`, and most modeled/fallback semantics even though the API exposes them.
3. Only retail methodology is fetched; comparison freshness and methodology semantics are incomplete.
4. Existing `Modeled estimate` UI capability is not wired into the main dashboard trust surface.

Impact:

1. `/VIC` can still present AU-level comparison content without clear scoping.
2. Users cannot tell when a value is modeled, fallback-derived, or source-backed.

Primary evidence:

1. `apps/web/app/[[...region]]/page.tsx`
2. `apps/web/features/dashboard/components/dashboard-shell.tsx`
3. `apps/web/features/dashboard/lib/overview.ts`
4. `apps/web/features/energy/components/energy-metric-card.tsx`

### G-5 Medium-High: The Dashboard Shell Over-Promises Operational Capability

Current examples:

1. `ONLINE` is static.
2. The live feed is local fetch bookkeeping, not real operational telemetry.
3. The command/filter input is decorative and has no execution or filtering behavior.

Impact:

1. The UI implies operational controls that do not exist.
2. This creates product ambiguity and false operator affordances.

Primary evidence:

1. `apps/web/features/dashboard/components/dashboard-shell.tsx`
2. `apps/web/tests/home-page.test.tsx`

### G-6 High: Replay And Backfill Metadata Are Not Auditable End-To-End

Current examples:

1. Queue dispatch constructs `from`, `to`, `dryRun`, and `runMode`.
2. Registry job processors discard much of that context before invoking jobs.
3. Persistence does not carry `bullJobId`, `queueName`, `attempt`, or `runMode` into stored ingest runs.

Impact:

1. Replay and backfill flows cannot be reconstructed reliably.
2. The BullMQ runbook is only partially reflected in durable system state.

Primary evidence:

1. `apps/ingest/src/queue/dispatch.ts`
2. `apps/ingest/src/jobs/job-registry.ts`
3. `apps/ingest/src/repositories/ingest-persistence.ts`
4. `docs/ingest-bullmq-operations-runbook.md`

### G-7 High: Postgres Ingest Writes Are Non-Atomic And Row-By-Row

Current examples:

1. Sources, snapshots, observations, cursors, and ingestion runs are written as independent steps.
2. Observation upserts do a `select` plus `insert/update` per row.
3. Timestamp parsing falls back to `new Date()` on invalid input.

Impact:

1. Mid-run failures can leave partial durable state.
2. Backfills pay unnecessary round trips.
3. Bad source data can silently corrupt freshness and audit timelines.

Primary evidence:

1. `apps/ingest/src/repositories/ingest-persistence.ts`
2. `apps/ingest/src/repositories/postgres-ingest-repository.ts`

### G-8 Medium-High: Contracts Are Fragmented Across API, Web, Ingest, And DB

Current examples:

1. `apps/web` manually redefines region lists and response types instead of consuming shared repo contracts.
2. `packages/data-contract` does not fully govern the series IDs emitted by ingest jobs.
3. The database accepts free-text series/region/source values without using `series` and `regions` as write-time integrity constraints.
4. Shared region contracts include capital-city codes, but the web route accepts only AU + state/territory pages.

Impact:

1. Contract drift remains a runtime problem rather than a compile-time or schema-time failure.

Primary evidence:

1. `apps/web/features/dashboard/lib/overview.ts`
2. `packages/data-contract/src/regions.ts`
3. `packages/data-contract/src/series.ts`
4. `apps/ingest/src/jobs/*.ts`
5. `packages/db/src/schema.ts`

### G-9 Medium: Store Safety Still Fails Open

Current examples:

1. Missing or invalid JSON store files are silently replaced with seeded fixture-style data.
2. The repo still defaults to `store` for some local flows.

Impact:

1. Misconfiguration can look like healthy data availability.
2. Fixture-like data can be surfaced without an explicit fixture mode.

Primary evidence:

1. `packages/shared/src/live-store.ts`
2. `packages/shared/tests/live-store.test.ts`
3. `README.md`

### G-10 High: Release Verification And Static Quality Gates Are Incomplete

Current examples:

1. No repo-wide `lint`, `typecheck`, or formatter verification scripts exist.
2. CI provisions Redis but not Postgres.
3. CI does not run Playwright.
4. Browser specs mock core API routes rather than exercising a real web+api path.
5. Test orchestration differs across root scripts, workspace config, and CI.
6. Toolchain versions are not pinned with `packageManager` or `engines`.
7. API docs remain duplicated manually in `README.md`.

Impact:

1. Regressions can pass the default automation surface.
2. Docs and contracts can drift independently.
3. New contributors have no single authoritative validation target.

Primary evidence:

1. `package.json`
2. `apps/*/package.json`
3. `vitest.workspace.ts`
4. `.github/workflows/ci.yml`
5. `tests/e2e/playwright.config.ts`
6. `tests/e2e/specs/*.spec.ts`
7. `README.md`

## 7. Product Decision Themes

This phase requires a few explicit decisions before implementation:

1. Should comparison endpoints remain AU-first, or become truly generic global comparison APIs?
2. Should unsupported selectors be implemented, or removed from public contracts until backed by real behavior?
3. Should the dashboard comparison panel be region-aware, or explicitly branded as AU-global only regardless of route?
4. Should the terminal shell become operationally real, or be reduced to a simpler dashboard metaphor?
5. Should missing/corrupt store files fail closed outside explicit fixture mode?

## 8. Functional Requirements

### FR-1 Contract Honesty

1. No public API query param may remain decorative.
2. Every response field exposed as measured data must be sourced from persisted observations or explicitly documented as fixed/derived metadata.
3. Unsupported selector dimensions must be rejected with structured `400` errors or removed from the contract.

### FR-2 Strong Input Validation

1. Region, window, basis, tax status, and consumption band inputs must be schema-level enums where applicable.
2. Date filters must require valid `YYYY-MM-DD` format.
3. `from > to` must return a structured `400`.
4. All current-domain routes must apply consistent supported-region validation.

### FR-3 Dashboard Scope And Provenance

1. Dashboard comparison content must align with route scope or be explicitly labeled as AU-global only.
2. Modeled/fallback values must render an explicit trust cue.
3. Source references and methodology summaries must be available in the dashboard UX for relevant panels.
4. Comparison data loading must support retry/refetch behavior instead of one-shot initialization only.

### FR-4 Shared Contract Consumption

1. The web layer must consume shared response/region contracts instead of redefining them manually.
2. Ingest-produced series IDs must be validated against canonical contracts.
3. Database writes must fail fast when contract IDs are invalid.

### FR-5 Replay And Backfill Auditability

1. Queue dispatch metadata must survive through job execution and durable run logging.
2. Stored ingest runs must include queue/run context needed for replay triage.
3. Runbook-documented replay flows must be testable against persisted records.

### FR-6 Postgres Write Safety

1. Postgres ingest persistence must be transactional.
2. Observation writes must use batched upsert semantics rather than row-by-row `select` + `insert/update`.
3. Invalid timestamps must fail the ingest path instead of defaulting to current time.

### FR-7 Store Safety

1. Missing or invalid live-store files must not silently create fixture-looking data outside explicit fixture/bootstrap mode.
2. Local developer convenience may remain available, but it must be opt-in and clearly marked.

### FR-8 Release Verification

1. The repo must expose authoritative root validation commands for linting, type-checking, unit/integration tests, and browser tests.
2. CI must exercise the supported backend matrix, including Postgres-backed behavior and at least one true browser flow without API mocks.
3. API docs must be generated or otherwise validated from the same source-of-truth contract surface.

## 9. Non-Functional Requirements

1. Backward compatibility: breaking contract changes must be versioned or explicitly deprecated.
2. Auditability: replay and backfill metadata must be durable and queryable.
3. Determinism: ingest runs over the same payload set must produce the same durable state.
4. Performance: latest-value endpoints should avoid repeated full-store scans and avoid unnecessary Postgres round trips.
5. Testability: every gap closure must be protected by failing tests first.
6. Developer ergonomics: local validation commands must be simpler, not more fragmented.

## 10. Target Workstreams

### Workstream A: Honest API Contracts

Scope:

1. `apps/api/src/routes/*`
2. `apps/api/src/repositories/*`
3. `apps/api/tests/*`
4. `README.md`

Outputs:

1. Implemented or removed selector dimensions.
2. Stronger route schemas and input validation.
3. Version decision on AU-biased comparison responses.
4. Expanded parity and contract tests.

### Workstream B: Shared Client Contracts And Dashboard Trust UX

Scope:

1. `apps/web/app/*`
2. `apps/web/features/dashboard/*`
3. `packages/data-contract`
4. optionally a new shared API client contract package or shared module

Outputs:

1. Shared API contract consumption in web.
2. Region/comparison scope alignment.
3. Modeled/source/methodology trust cues.
4. Clear decision on decorative terminal-shell controls.

### Workstream C: Replay Auditability And Transactional Ingest

Scope:

1. `apps/ingest/src/queue/*`
2. `apps/ingest/src/jobs/*`
3. `apps/ingest/src/repositories/*`
4. `packages/db`
5. `docs/ingest-bullmq-operations-runbook.md`

Outputs:

1. Full replay metadata propagation.
2. Transactional Postgres persistence.
3. Batched writes.
4. Strict timestamp failure semantics.

### Workstream D: Contract Enforcement And Store Safety

Scope:

1. `packages/data-contract`
2. `packages/db`
3. `packages/shared`
4. `apps/ingest`
5. `apps/api`

Outputs:

1. Canonical series/region enforcement.
2. Safer store bootstrap behavior.
3. Read-path performance hardening.

### Workstream E: CI And Repo Quality Gates

Scope:

1. root `package.json`
2. `vitest.workspace.ts`
3. `.github/workflows/ci.yml`
4. `tests/e2e/*`
5. docs generation/validation surface

Outputs:

1. Root `lint`, `typecheck`, and authoritative test commands.
2. CI matrix with Postgres and real browser/API coverage.
3. Unified test orchestration and toolchain pinning.

## 11. TDD Execution Plan

## Rule

For each phase: write failing tests first, confirm the failure is for the intended reason, implement the smallest viable change, then refactor.

### Phase 1: Contract Honesty And Validation

1. Add failing API tests proving `window`, `customer_type`, `usage_profile`, and fixed retail subfields are currently misleading.
2. Add failing tests for unsupported housing regions, malformed dates, and inverted ranges.
3. Add failing OpenAPI contract tests for real enum/date schemas.
4. Implement the chosen contract behavior.

### Phase 2: Dashboard Scope And Trust

1. Add failing web tests asserting modeled/fallback badges and provenance visibility.
2. Add failing tests for comparison refetch/scope behavior when region changes.
3. Add failing tests for comparison retry/recovery semantics.
4. Implement shared parsing/client contracts and UI trust affordances.

### Phase 3: Replay Auditability

1. Add failing queue/ingest tests proving `from`, `to`, `dryRun`, `runMode`, `bullJobId`, `queueName`, and `attempt` are preserved end-to-end.
2. Add failing tests that replay/backfill runs are queryable from durable ingestion records.
3. Implement metadata propagation and run logging fixes.

### Phase 4: Transactional Postgres Persistence

1. Add failing integration tests that inject a partial-write failure and assert rollback.
2. Add failing tests for invalid timestamp handling.
3. Add failing performance-oriented tests or spies showing row-by-row queries on upsert paths.
4. Implement transactions, batching, and strict timestamp parsing.

### Phase 5: Contract Enforcement And Store Safety

1. Add failing tests for invalid series/region IDs crossing ingest/db boundaries.
2. Add failing tests for missing/corrupt store behavior outside explicit fixture mode.
3. Add failing tests or performance assertions around repeated latest-value scans.
4. Implement enforcement and store fail-closed semantics.

### Phase 6: CI And Quality Gates

1. Add root validation commands and wire them into CI.
2. Add CI coverage for Postgres-backed parity and at least one true browser flow.
3. Add checks that contract docs stay aligned with OpenAPI or a generated source.

## 12. Test Matrix

1. API unit/integration tests
2. API backend parity tests for `store` and `postgres`
3. Web component and route tests
4. Real browser tests with web + API running together
5. Ingest queue dispatch tests
6. Ingest replay/backfill audit tests
7. Postgres persistence integration tests
8. Contract enforcement tests for series/regions/source IDs
9. Store bootstrap safety tests
10. CI command smoke tests

## 13. Acceptance Criteria

1. No public API selector remains decorative.
2. API routes reject invalid enums, unsupported regions, malformed dates, and inverted ranges with structured errors.
3. Comparison contract direction is explicit and reflected in route names, response fields, tests, and dashboard copy.
4. The dashboard visibly communicates modeled/fallback/provenance semantics for relevant values.
5. Region-scoped pages no longer silently present AU-only comparison content without explicit labeling.
6. Web contract consumption no longer depends on duplicate hand-written response types and region lists.
7. Replay/backfill metadata is persisted durably and can reconstruct queue execution context.
8. Postgres ingest writes are transactional and batched.
9. Invalid timestamps fail fast instead of defaulting to current time.
10. Missing/corrupt store files do not silently reseed fixture-looking data outside explicit fixture/bootstrap mode.
11. CI runs authoritative root validation commands, includes Postgres-backed coverage, and includes at least one browser flow without mocked API routes.
12. Repo docs and generated/public API contract surfaces are aligned.

## 14. Rollout Plan

1. PR-1: API selector honesty + validation hardening
2. PR-2: dashboard shared contracts + provenance/modeling UX
3. PR-3: replay metadata propagation + ingest run auditability
4. PR-4: Postgres transactions + batched upserts + timestamp strictness
5. PR-5: contract enforcement + store safety + read-path performance
6. PR-6: CI matrix + root quality gates + doc governance

## 15. Risks And Mitigations

1. Risk: stricter validation breaks existing clients.
   Mitigation: version or deprecate breaking contract changes; document behavior changes clearly.
2. Risk: transactional Postgres changes increase implementation complexity.
   Mitigation: isolate persistence contract tests and ship behind one focused PR.
3. Risk: browser + Postgres CI increases runtime.
   Mitigation: keep one representative full-stack browser flow and parallelize the rest.
4. Risk: fail-closed store behavior hurts local DX.
   Mitigation: keep explicit fixture/bootstrap mode for local development and tests.
5. Risk: shared-contract migration touches many files.
   Mitigation: land API contract source-of-truth first, then move web consumption onto it.

## 16. Definition Of Done

1. All acceptance criteria are met.
2. Root validation commands are documented and green in CI.
3. README and runbook semantics match actual implementation behavior.
4. Follow-up items not completed in this phase are logged as explicit backlog items rather than hidden repo debt.

## Appendix A: Lower-Priority Gaps Surfaced During Audit

1. `scenarios` and `watchlist_items` exist in the DB schema without current product or API wiring.
2. README planning-doc inventory is no longer a complete reflection of the `docs/` directory.
3. `tests/e2e` remains outside the Vitest workspace surface, which is acceptable only if root scripts and CI remain explicit about that separation.
