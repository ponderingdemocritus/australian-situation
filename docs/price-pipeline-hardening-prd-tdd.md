# Price Pipeline Hardening PRD + TDD Plan

## 1. Context

The current price-domain changes added:

1. a live-source client for major-goods prices
2. a daily sync job for major-goods indexes
3. protected intake, reconciliation, classification, and promotion routes
4. store/Postgres parity coverage for the new API surface

A review of the workspace found four blocking issues:

1. live sync defaults to an HTML source URL instead of a machine-readable feed
2. the live sync path stages the fetched payload but still publishes fixture-derived data
3. intake queue helpers allow invalid state transitions
4. an auth-protected parity test does not send auth and cannot pass

This PRD turns those findings into a concrete remediation plan.

## 2. Problem Statement

The price pipeline currently looks production-ready from the outside, but two core guarantees are false:

1. `sourceMode=live` does not reliably ingest live data
2. queue state transitions are not enforced by code

That creates three operational risks:

1. scheduled live runs can fail before publication
2. successful live runs can still emit fixture values and hide the failure
3. unresolved queue items can bypass the intended review flow and pollute downstream jobs

The repo needs a small hardening pass that fixes behavior without redesigning the broader price-index architecture.

## 3. Goals

1. Make the default live major-goods sync read from a machine-readable source.
2. Ensure fetched live points drive canonical artifacts, warehouse writes, and published observations.
3. Enforce explicit queue-state transitions for reconcile, classify, and promote.
4. Distinguish invalid state from not-found so API callers get deterministic errors.
5. Align protected-route tests with actual auth behavior.
6. Keep the fix additive and backward compatible for public analytical reads.

## 4. Non-Goals

1. Redesigning the major-goods methodology or published series ids.
2. Replacing HTTP Basic Auth with a full auth system.
3. Reworking the broader warehouse schema introduced in this branch.
4. Solving new price-source onboarding beyond the minimum live-source contract needed here.

## 5. Scope

### In Scope

1. `packages/shared/src/live-store.ts`
2. `packages/shared/tests/*`
3. `apps/ingest/src/sources/live-source-clients.ts`
4. `apps/ingest/src/jobs/sync-major-goods-price-index.ts`
5. `apps/ingest/tests/*`
6. `apps/api/src/routes/price-routes.ts`
7. `apps/api/tests/*`
8. `README.md` if protected-route or transition behavior changes

### Out Of Scope

1. dashboard UI changes
2. basket methodology changes
3. new public endpoints
4. migration of intake-queue state out of the live store

## 6. Users And Stakeholders

1. ingest maintainers who need `sourceMode=live` to mean real live ingestion
2. API maintainers who need protected operational routes to enforce workflow rules
3. operators who need reliable scheduled runs and actionable failures
4. agent authors who need deterministic intake/reconciliation contracts

## 7. Current Failure Modes

### FM-1 Invalid Live Source Configuration

The source catalog uses a public ABS CPI webpage as the major-goods fetch URL. The live-source client expects JSON. A live run therefore fails before parsing useful data.

### FM-2 Live Payload Ignored

The sync job builds fixture artifacts first and only swaps `rawSnapshot` after fetching live data. Store writes, warehouse writes, rollups, and public observations continue to come from fixture points.

### FM-3 Invalid Queue Transitions

The shared queue helpers allow:

1. classify on an `open` item
2. promote on an `open` item
3. promote without any explicit state validation

The API layer cannot return the right error because helper results do not distinguish not-found from invalid-state.

### FM-4 Auth-Blind Regression Coverage

The parity test for `/api/prices/major-goods` expects `200` from a protected route without sending auth. That test cannot validate parity and will fail whenever the DB-backed suite runs.

## 8. Product Requirements

### FR-1 Separate Provenance URL From Fetch URL

1. The source catalog must preserve a human-readable provenance URL for metadata responses.
2. Live source clients must use an explicit machine-readable fetch URL.
3. If a live fetch URL is missing, the job must fail fast with a clear configuration error.

### FR-2 One Artifact Builder For Fixture And Live Points

1. The major-goods pipeline must build canonical artifacts from a supplied `MajorGoodsPricePoint[]`.
2. Fixture mode may still generate points internally, but live mode must pass fetched points through the same artifact builder.
3. Published observations, raw warehouse rows, and source cursors must all derive from the same point set.
4. The source cursor must use the payload observation timestamp, not a synthetic timestamp when live data is present.

### FR-3 Explicit Queue-State Contract

The queue must support exactly these transitions:

1. `open -> reconciled` via reconcile
2. `reconciled -> reconciled` via classify metadata enrichment
3. `reconciled -> promoted` via promote

Outcomes that must be rejected:

1. classify on `open`
2. reconcile on `promoted`
3. promote on `open`
4. any repeated transition that would skip or rewind state

### FR-4 Invalid State Must Be Observable

1. Shared queue helpers must distinguish `not_found` from `invalid_state`.
2. The API must map:
   `404` for unknown item ids
   `409` for invalid state transitions
3. Error payloads must be stable and test-backed.

### FR-5 Protected Routes Must Be Tested As Protected

1. All tests that hit protected price routes must send Basic Auth when asserting success.
2. At least one regression test must assert `401` for the protected overview routes without auth.
3. Store/Postgres parity tests must compare authenticated responses.

## 9. Design Decisions

### 9.1 Source Catalog Contract

Add an optional fetch-oriented field instead of overloading `url`.

Recommended shape:

1. keep `url` as public provenance metadata
2. add `fetchUrl?: string`

That avoids changing metadata endpoints while giving ingest a safe machine-readable target.

### 9.2 Artifact Construction

Refactor the major-goods job into two layers:

1. point acquisition
2. artifact derivation

Target helpers:

1. `buildFixtureMajorGoodsPoints(...)`
2. `buildMajorGoodsPriceIndexArtifactsFromPoints(points, metadata)`

The sync job should choose the point source first, then run one artifact path.

### 9.3 Queue Helper Return Shape

The helpers currently return `item | null`, which is not enough.

Recommended shape:

1. a discriminated result such as `{ kind: "ok", item }`
2. `{ kind: "not_found" }`
3. `{ kind: "invalid_state", currentStatus }`

The API can then map those results without guessing.

### 9.4 Promotion Semantics

This remediation does not need a new queue status. Promotion should remain allowed from `reconciled`, even if the item is not cohort-ready, because downstream publication already filters on `cohortReady`.

What must change is skipping reconciliation entirely.

## 10. Success Criteria

1. `sourceMode=live` can run against the default configured source without HTML/JSON mismatch.
2. A mocked live payload changes the published index output away from the fixture baseline.
3. Invalid classify/promote calls return deterministic `409` responses.
4. Shared queue tests prove invalid transitions are rejected.
5. Parity and route tests accurately reflect auth requirements.

## 11. TDD Plan

### Phase A: Live Source Configuration

Write failing tests first:

1. `apps/ingest/tests/source-clients.test.ts`
   Add a test proving the major-goods client uses a machine-readable `fetchUrl` or fails fast with a configuration error when no fetch URL exists.
2. `apps/ingest/tests/sync-major-goods-price-index.test.ts`
   Add a live-mode test with a mocked payload whose prices materially differ from fixture prices.
   Assert that the published AU index changes accordingly.

Expected RED state:

1. the source client still resolves to the provenance webpage
2. the sync job still publishes fixture-derived values

GREEN target:

1. introduce `fetchUrl` support
2. make the sync job derive artifacts from fetched points

### Phase B: Shared Queue State Invariants

Write failing tests first:

1. `packages/shared/tests/price-intake-queue.test.ts`
   Add tests that classify on `open` is rejected.
2. `packages/shared/tests/price-intake-queue.test.ts`
   Add tests that promote on `open` is rejected.
3. `packages/shared/tests/price-intake-queue.test.ts`
   Add tests that reconcile on `promoted` is rejected.

Expected RED state:

1. helpers mutate items despite invalid status
2. helper return values do not encode invalid state

GREEN target:

1. introduce discriminated helper results
2. enforce legal transitions only

### Phase C: API Error Mapping

Write failing tests first:

1. `apps/api/tests/price-intake-api.test.ts`
   Add tests asserting:
   `409 INVALID_ITEM_STATE` for classify on `open`
   `409 INVALID_ITEM_STATE` for promote on `open`
2. Extend existing happy-path tests to prove valid transitions still return `200`.

Expected RED state:

1. API returns `200` for invalid transition attempts

GREEN target:

1. route handlers map helper results to `404` vs `409`
2. OpenAPI route contracts include the new `409` error response where relevant

### Phase D: Auth Regression Coverage

Write failing tests first:

1. `apps/api/tests/postgres-parity.test.ts`
   Add auth headers to protected-route parity calls.
2. `apps/api/tests/price-index-overview.test.ts`
   Keep the existing `401` test and add the same guard for `/api/prices/ai-deflation` if missing.

Expected RED state:

1. protected parity test fails with `401`

GREEN target:

1. parity tests compare authenticated responses only
2. unauthorized tests stay explicit and separate

## 12. Implementation Order

1. fix live-source configuration contract
2. refactor artifact building so live and fixture share one path
3. harden shared queue transitions
4. wire API `409` handling
5. repair and expand auth-aware regression coverage

## 13. Validation Checklist

Run after implementation:

```bash
bun --filter @aus-dash/shared test
bun --filter @aus-dash/ingest test
bun --filter @aus-dash/api test
```

If protected-route docs or operational behavior change:

```bash
bun run docs:check
```

## 14. Open Questions

1. Should `fetchUrl` live in the shared source catalog, or should the major-goods job accept an ingest-only environment variable for the machine-readable feed?
2. Should invalid queue transitions return a single generic `INVALID_ITEM_STATE` code, or separate error codes per operation?
3. Should classify remain metadata-only on `reconciled`, or should it become a prerequisite for promotion and require a stronger contract update in README and skills docs?
