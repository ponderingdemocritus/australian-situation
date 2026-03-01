# Postgres-First API Abstraction PRD + TDD Plan

## 1. Context

The API currently supports two data backends (`store`, `postgres`) via a shared repository interface.
Recent review identified maintainability risks that make extension harder and backend parity fragile:

1. Repository contract is inferred from one implementation and bypassed with type-casting.
2. Store and Postgres behavior can drift (for example freshness semantics).
3. Backend parity tests are missing for Postgres route behavior.
4. Domain constants are duplicated across API layers instead of sourced from shared contracts.
5. OpenAPI response schemas are mostly generic objects.
6. Legacy prototype modules remained under `apps/api/src/domain` and obscured active abstractions.

This PRD defines a Postgres-first hardening pass to make the API safer to evolve.

## 2. Problem Statement

Adding metrics/endpoints currently requires touching multiple duplicated constants and hand-validating backend parity. Type-level guarantees are weak because the repository contract is coupled to store return types and Postgres is cast into that contract.

Result: regressions can pass compile-time checks and only surface in runtime or production-specific backend configurations.

## 3. Goals

1. Make Postgres the primary, explicitly typed backend contract for API behavior.
2. Enforce compile-time repository compatibility (remove unsafe backend casts).
3. Eliminate backend behavior drift for shared endpoints.
4. Centralize domain constants and filter enums in shared contracts.
5. Strengthen API schema contracts in OpenAPI for maintainability and extension.
6. Keep changes backward compatible for API consumers.

## 4. Non-Goals

1. Redesign endpoint payload shapes (unless bug fix requires it and remains backward compatible).
2. Remove `store` backend entirely in this phase.
3. Rework ingest pipeline architecture.
4. Introduce auth/rate limiting.

## 5. Scope

### In Scope

1. `apps/api/src/repositories/live-data-repository.ts`
2. `apps/api/src/repositories/postgres-live-repository.ts`
3. `apps/api/src/repositories/live-store-repository.ts`
4. `apps/api/src/app.ts`
5. `apps/api/tests/*` (new parity and contract tests)
6. `packages/data-contract/src/*` constants usage in API
7. OpenAPI response schema tightening for current endpoints

### Out of Scope

1. New business endpoints
2. UI/client changes

## 6. User Stories

1. As an API maintainer, I want backend contracts to be explicit and compiler-checked so I can extend endpoints without hidden backend mismatch risk.
2. As an API maintainer, I want Postgres and store to return equivalent responses for shared routes so deployments behave predictably.
3. As an API consumer, I want stable payload contracts documented in OpenAPI so integrations are reliable.

## 7. Functional Requirements

### FR-1 Repository Contract Hardening

1. Define explicit DTO/types for each repository method independent of implementation function `ReturnType`.
2. Ensure both Postgres and store repositories satisfy the same typed interface with no `as` cast.
3. If implementations diverge, compilation must fail.

### FR-2 Postgres-First Behavior Parity

1. Add route-level parity tests that run against both backends (where feasible in CI/local test setup).
2. Ensure freshness semantics and fallback behavior are consistent across backends for:
1. `/api/energy/retail-average`
2. `/api/energy/overview`
3. `/api/metadata/freshness`
4. `/api/series/:id`

### FR-3 Constants Centralization

1. Replace duplicated region/filter literals in API with imports from `@aus-dash/data-contract`.
2. Maintain endpoint-specific subsets by deriving from shared canonical sets (do not retype literals).

### FR-4 OpenAPI Contract Tightening

1. Add concrete response schemas for core endpoints instead of generic `record<string, unknown>`.
2. Ensure tests assert generated OpenAPI includes expected schema structure for these endpoints.

### FR-5 Codebase Hygiene (Legacy Fixture Move)

1. Prototype-only in-memory domain modules should not live in production API source tree.
2. Move retained prototypes to `apps/api/tests/fixtures` and keep production paths free of dead abstractions.

## 8. Non-Functional Requirements

1. Backward compatibility: existing response keys remain unchanged unless explicitly versioned.
2. Performance: no regression >10% on existing warm-path test assumptions.
3. Reliability: deterministic test suite for both backend modes.
4. Observability: existing structured error format unchanged.

## 9. Design Approach

### 9.1 Target Abstraction Model

1. Create API-level contract types:
1. `SeriesResponse`
2. `EnergyRetailAverageResponse`
3. `EnergyLiveWholesaleResponse`
4. `EnergyOverviewResponse`
5. `MetadataFreshnessResponse`
6. `MetadataSourcesResponse`
7. comparison responses
2. Repository interface uses these types directly.
3. Store/Postgres adapters map backend data into these shared DTOs.

### 9.2 Backend Strategy

1. Keep `AUS_DASH_DATA_BACKEND` selector.
2. Treat Postgres as primary validation path in tests.
3. Keep store backend as fallback/mock backend with strict parity assertions.

### 9.3 Constant Strategy

1. Import canonical constants from `packages/data-contract`.
2. Derive endpoint-specific sets by filtering canonical constants.
3. Avoid separate literal arrays in route/repository layers.

## 10. TDD Execution Plan

## Rule

For each step: write test first, watch fail, implement minimal fix, watch pass, then refactor.

### Phase A: Contract Safety

1. Add compile-level test/usage assertions for repository implementations satisfying interface.
2. RED: create test/typing guard that fails when Postgres shape diverges.
3. GREEN: remove cast and align method signatures.

### Phase B: Postgres Parity

1. Add backend matrix route tests for key endpoints using injected `createRepository`.
2. RED: encode expected parity for freshness fields and missing-data behavior.
3. GREEN: align Postgres/store implementations where drift exists.

### Phase C: Constant Deduplication

1. Add tests validating API accepts/rejects regions and filters sourced from shared constants.
2. RED: tests fail while literals remain duplicated.
3. GREEN: replace literals with shared imports and derived sets.

### Phase D: OpenAPI Schema Hardening

1. Add tests that assert specific response schema keys for priority endpoints.
2. RED: tests fail with generic object schemas.
3. GREEN: define concrete Valibot schemas and wire to `describeRoute`.

### Phase E: Fixture Hygiene

1. Add/adjust tests (if needed) to reference moved fixtures.
2. RED: import path failure after move.
3. GREEN: update fixture paths and ensure `apps/api` tests pass.

## 11. Test Matrix

1. Unit tests:
1. repository mapping
2. freshness calculations
3. filter validation helpers
2. Integration/API tests:
1. endpoint contracts
2. structured errors
3. backend parity checks (store vs postgres)
3. Contract tests:
1. OpenAPI schema assertions
2. response key stability checks

## 12. Acceptance Criteria

1. `LiveDataRepository` no longer depends on store `ReturnType` and uses explicit shared DTOs.
2. No `as LiveDataRepository` cast exists in repository factory.
3. Postgres and store parity tests pass for scoped endpoints.
4. Region/filter constants in API route validation are sourced from shared contracts.
5. OpenAPI tests assert concrete response schema shapes for scoped endpoints.
6. Legacy prototype modules are moved from `apps/api/src/domain` into test fixtures.
7. `bun --filter @aus-dash/api test` passes.

## 13. Rollout Plan

1. PR-1: hygiene + fixtures move + baseline parity tests (no behavior changes).
2. PR-2: repository contract hardening + remove cast.
3. PR-3: parity fixes and constants dedupe.
4. PR-4: OpenAPI schema hardening.

## 14. Risks and Mitigations

1. Risk: hidden payload drift breaks clients.
1. Mitigation: additive-first changes, contract tests, avoid key renames.
2. Risk: Postgres test environment instability.
1. Mitigation: isolate backend-parity tests and support injected repositories for deterministic runs.
3. Risk: broad refactor scope.
1. Mitigation: phase-based delivery with explicit acceptance gates per PR.

## 15. Definition of Done

1. All acceptance criteria met.
2. API tests green.
3. README endpoint table updated only if route behavior changes.
4. Follow-up tasks for out-of-scope improvements logged.
