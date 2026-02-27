# Live Ingestion Implementation Checklist

- Date started: 2026-02-27
- Scope source: `docs/prd-live-ingestion-v1.md`

## Phase 1: Foundation

- [x] Add shared live-store contract and file persistence helpers.
- [x] Add seed store content with housing + energy observations and source catalog.
- [x] Add tests for read/write/upsert/cursor/run bookkeeping.

## Phase 2: Ingest Integration

- [x] Wire `sync-energy-wholesale` to upsert observations into live store.
- [x] Wire `sync-energy-retail-plans` to upsert observations into live store.
- [x] Wire `sync-housing-series` to upsert observations into live store.
- [x] Record ingestion runs + source cursors from ingest jobs.

## Phase 3: API Repository Swap

- [x] Add API repository layer reading from live store.
- [x] Replace fixture-backed `housing/overview` route with repository-backed response.
- [x] Replace fixture-backed `energy/live-wholesale` route with repository-backed response.
- [x] Replace fixture-backed `energy/retail-average` route with repository-backed response.
- [x] Replace fixture-backed `energy/overview` route with repository-backed response.
- [x] Replace metadata routes with repository-backed freshness/source responses.

## Phase 4: Reliability and Validation

- [x] Preserve existing API/web behavior for region switching and metric formatting.
- [x] Keep CORS and existing route contracts intact.
- [x] Update/add tests for repository-backed behavior and ingest writes.
- [x] Run full workspace test suite and keep green.

## Phase 5: Remaining PRD Gaps (post-this-pass)

- [x] Implement real upstream ABS/AEMO/AER/RBA extract clients (currently fixture-seeded ingest).
- [ ] Move from file-backed live store to Postgres-backed repositories in production path.
- [x] Add scheduler cadence orchestration and alerting hooks.
