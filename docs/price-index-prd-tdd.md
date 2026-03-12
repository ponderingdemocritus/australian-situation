# Australia Major Goods Price Index PRD + TDD Plan

## 1. Context

The repo currently supports curated time-series ingestion and API reads through:

1. `packages/db` for Postgres schema.
2. `apps/ingest` for source parsing and persistence.
3. `apps/api` for public read models.
4. `packages/shared` for the live-store contract used by both backends.

That shape works for low-cardinality macro series, but it is not yet designed for high-volume product price scraping across retailers, locations, and time.

The proposed database structure is captured in:

1. `docs/price-index-db-structure.md`

This PRD turns that structure into an implementation and test plan.

## 2. Problem Statement

To build a price index of major goods in Australia, the repo needs to support three things at once:

1. high-volume raw scraped price history
2. reproducible product/category normalization
3. stable public index series exposed through the API

The current `observations` model is not enough on its own because it does not represent:

1. canonical product identity
2. merchant and store/location identity
3. offer-level price history
4. unit normalization
5. weight versioning for index construction

If raw scrape rows are mixed directly into `observations`, the repo will lose query clarity, provenance clarity, and API performance.

## 3. Goals

1. Add a raw price warehouse in Postgres that can store retailer/product/offer price history over time.
2. Preserve the existing `series` + `observations` model as the public curated time-series layer.
3. Support reproducible daily rollups and versioned basket-weight index calculation.
4. Keep provenance and replayability through `raw_snapshots`, `ingestion_runs`, and methodology versioning.
5. Make the first supported public outputs backward compatible with the current API architecture.
6. Keep the design additive and safe for future agent-driven scraping jobs.

## 4. Non-Goals

1. Perfect coverage of every Australian good or retailer in the first release.
2. Real-time streaming analytics or sub-second BI workloads.
3. Building a consumer-facing shopping UI in this phase.
4. Solving product matching with full ML-based entity resolution in this phase.
5. Replacing the existing store backend entirely.

## 5. Users And Stakeholders

1. Ingest maintainers who will add and evolve scraper/agent jobs.
2. API maintainers who need a stable public contract.
3. Analytics consumers who need trustworthy index methodology and provenance.
4. Operators who need backfill and replay workflows to be auditable.
5. Future agent builders who will write new product-price source integrations.

## 6. Scope

### In Scope

1. `packages/db/src/schema.ts`
2. `packages/db/drizzle/*`
3. `packages/db/tests/*`
4. `packages/shared/src/live-store.ts`
5. `apps/ingest/src/repositories/*`
6. `apps/ingest/src/jobs/*`
7. `apps/ingest/src/sources/live-source-clients.ts`
8. `apps/ingest/tests/*`
9. `packages/data-contract/src/*`
10. `apps/api/src/repositories/*`
11. `apps/api/src/routes/*`
12. `apps/api/tests/*`
13. `README.md` and generated API docs if public route behavior changes

### Out Of Scope

1. A polished dashboard experience for the new price domain.
2. Non-Australia-first product coverage.
3. External auth, billing, or tenancy features.
4. Generic data-lake or warehouse export tooling.

## 7. User Stories

1. As an ingest maintainer, I want every scrape to produce durable, queryable offer-level price history without losing source evidence.
2. As a methodology owner, I want canonical products, categories, and weight versions so I can recompute the index consistently.
3. As an API consumer, I want stable price-index series without having to understand raw retailer scrape structure.
4. As an operator, I want to trace any published index point back to raw snapshots and ingestion runs.
5. As a maintainer, I want new sources to plug into one persistence model instead of inventing source-specific tables.

## 8. Functional Requirements

### FR-1 Raw Price Warehouse

1. The database must support canonical product, merchant, location, offer, and raw price-observation tables.
2. The base fact grain must be one observed price for one offer at one time in one geography.
3. The schema must be additive relative to existing `series`, `observations`, `sources`, `raw_snapshots`, and `ingestion_runs`.

### FR-2 Canonical Product And Category Modeling

1. The schema must support a stable product-category hierarchy for "major goods".
2. Products must support unit normalization fields so different pack sizes can be compared.
3. Source-specific product identifiers must map through an alias/reconciliation table before index calculation.

### FR-3 Merchant And Location Modeling

1. The schema must represent merchant identity independently from product identity.
2. Offers must support location-scoped and online-national pricing.
3. Public region aggregation must remain compatible with existing `regions.regionCode`.

### FR-4 Auditable Raw Price History

1. Raw price observations must link back to the ingestion run and raw snapshot when available.
2. The warehouse must store observed timestamp, daily grouping date, price type, and unit-price normalization.
3. Duplicate observations from repeated scrape payloads must be idempotent under a deterministic uniqueness rule.

### FR-5 Daily Rollups

1. The system must derive daily product-level rollups from raw observations.
2. Rollups must capture at least sample size, offer count, median price, mean price, and unit-price aggregates.
3. Rollups must retain a `methodologyVersion`.

### FR-6 Versioned Index Methodology

1. Public indexes must be defined through explicit index metadata plus versioned basket weights.
2. Basket weights must be time-bounded so reweighting does not rewrite historical outputs.
3. The design must support product-level or category-level weights.

### FR-7 Public Series Publication

1. Derived public index outputs must be written into existing `series` and `observations`.
2. Raw scrape facts must not be exposed through the public `observations` model by default.
3. Public series IDs for the new domain must be added to `packages/data-contract`.

### FR-8 Backfill And Recompute

1. It must be possible to recompute rollups and indexes from stored raw observations.
2. A methodology change must produce new derived outputs without deleting raw history.
3. Reprocessing must remain traceable to the methodology version used.

### FR-9 API Exposure

1. The API must expose curated price-index outputs through the existing repository pattern.
2. If new endpoints are introduced, route validation, OpenAPI generation, and tests must be added together.
3. Public payloads must include methodology and source-reference metadata where appropriate.

### FR-10 Backward Compatibility

1. Existing route behavior must remain stable unless a new price-domain route is explicitly added.
2. Existing domain routes must not degrade due to new warehouse tables or jobs.
3. Any new public route behavior must be test-backed and documented.

## 9. Non-Functional Requirements

1. Determinism: repeated processing of the same raw payloads must produce identical canonical outputs.
2. Auditability: published index points must be traceable back to source evidence and run metadata.
3. Scale: the raw fact table must support long-running accumulation without degrading public series reads.
4. Maintainability: new sources should fit existing source/repository/job patterns.
5. Performance: raw writes and rollup reads must be optimized for append-heavy time-series workloads.
6. Safety: schema changes must be additive and migration-backed.

## 10. Target Design

### 10.1 Two-Layer Storage Model

The system will use:

1. a raw price warehouse layer
2. a curated public series layer

Raw warehouse tables:

1. `product_categories`
2. `products`
3. `product_aliases`
4. `merchants`
5. `merchant_locations`
6. `offers`
7. `price_observations`
8. `price_rollups_daily`
9. `index_definitions`
10. `index_basket_versions`
11. `index_weights`

Curated public layer:

1. `series`
2. `observations`

### 10.2 Ingest Flow

Target flow:

1. Source client fetches payload.
2. Raw payload is stored in `raw_snapshots`.
3. Merchant/location/product/offer dimensions are upserted.
4. Raw price facts are upserted into `price_observations`.
5. Daily rollups are recomputed for affected dates/products/regions.
6. Index series are recomputed for affected baskets/date windows.
7. Curated outputs are published into `series` + `observations`.

### 10.3 Partitioning Strategy

1. `price_observations` will be partitioned monthly by `observed_at`.
2. The table will use `timestamptz` for raw event time and `date` for daily grouping.
3. Public `observations` will remain optimized for curated series queries rather than raw scrape exploration.

### 10.4 API Strategy

1. Keep the current repository split (`store` and `postgres`) intact.
2. Treat Postgres as the authoritative path for the new price warehouse.
3. Publish public price-index outputs through the same DTO/repository pattern used by other domains.

## 11. Delivery Phases

### Phase A: Schema Foundation

Deliver:

1. New warehouse table definitions in `packages/db/src/schema.ts`
2. Drizzle migrations
3. Schema contract tests

Success criteria:

1. New tables and indexes exist.
2. Existing tables remain unchanged except additive references if needed.
3. `packages/db` tests verify key columns, foreign keys, unique constraints, and indexes.

### Phase B: Canonical Upsert Path

Deliver:

1. Ingest persistence helpers for merchants, locations, products, aliases, offers, and raw price observations
2. Source-specific mapping functions that emit the canonical write model
3. Idempotent upsert behavior

Success criteria:

1. The same source payload can be replayed safely.
2. Raw facts are linked to source evidence.
3. Tests cover duplicate payloads and partial matching cases.

### Phase C: Rollup Computation

Deliver:

1. Daily rollup job/helpers
2. Rollup recompute path for affected days/products/regions
3. Methodology-version persistence

Success criteria:

1. Rollups are correct for median, mean, counts, and unit prices.
2. Rollups are stable under repeated recomputation.

### Phase D: Index Methodology

Deliver:

1. Index definitions
2. Basket versions and weights
3. Index calculation logic
4. Publication into `series` + `observations`

Success criteria:

1. Index points can be traced to basket version + methodology version.
2. Reweighting creates new outputs without mutating raw history.
3. Public series IDs are registered in `packages/data-contract`.

### Phase E: API Exposure

Deliver:

1. Repository methods for public price-index reads
2. Route handlers and validation
3. OpenAPI contract coverage
4. API tests

Success criteria:

1. New routes are queryable through the same API architecture as other domains.
2. Metadata and methodology semantics are explicit in the response.

## 12. TDD Execution Plan

## Rule

For each phase: write failing tests first, implement the smallest change that passes, then refactor.

### Phase A Tests First

1. Add `packages/db/tests/*` contract tests for new tables, indexes, and uniqueness constraints.
2. RED: assert missing warehouse tables/columns/indexes.
3. GREEN: add schema definitions and migrations.

### Phase B Tests First

1. Add ingest repository tests for canonical mapping and idempotent upserts.
2. RED: replayed payloads create duplicate dimensions/facts or break foreign-key expectations.
3. GREEN: implement upsert helpers and source mappings.

### Phase C Tests First

1. Add rollup tests for daily aggregation, median selection, and unit-price aggregation.
2. RED: incorrect counts or aggregate values.
3. GREEN: implement deterministic rollup logic.

### Phase D Tests First

1. Add index-calculation tests for basket weights, rebasing, and methodology version changes.
2. RED: incorrect weighted output or historical mutation under reweighting.
3. GREEN: implement index calculation + publication.

### Phase E Tests First

1. Add API tests for new price-index routes or series behavior.
2. RED: unsupported filters, missing metadata, or parity gaps.
3. GREEN: implement route/repository wiring and OpenAPI contracts.

## 13. Test Matrix

1. `bun --filter @aus-dash/db test`
2. `bun --filter @aus-dash/ingest test`
3. `bun --filter @aus-dash/api test`
4. `bun run docs:check` if new routes are added
5. `bun run validate` before merge

Additional required coverage:

1. schema contract tests for every new table
2. ingest tests for idempotency and source-evidence linkage
3. rollup tests for aggregation correctness
4. index tests for weighting/versioning correctness
5. API tests for route behavior and metadata payloads

## 14. Acceptance Criteria

1. The repo contains additive Postgres tables for raw price warehousing and index methodology.
2. Raw price data can be ingested without using `observations` as the raw fact store.
3. Daily rollups can be recomputed deterministically from raw observations.
4. Public price-index series are published through `series` + `observations`.
5. Methodology and basket changes are versioned rather than rewriting historical raw data.
6. Every new public behavior is protected by tests in `apps/api/tests/*`.
7. Every ingest workflow change is protected by tests in `apps/ingest/tests/*`.
8. Schema guarantees are protected by tests in `packages/db/tests/*`.

## 15. Risks And Mitigations

1. Risk: product matching is messy and source-specific.
   Mitigation: keep `product_aliases` explicit and allow unresolved aliases before canonical assignment.
2. Risk: raw fact volume grows quickly.
   Mitigation: partition `price_observations` monthly and keep public reads on curated tables.
3. Risk: methodology changes create opaque outputs.
   Mitigation: persist `methodologyVersion`, `index_basket_versions`, and source evidence links.
4. Risk: route scope expands too early.
   Mitigation: publish curated series first and delay broad raw-data API exposure.

## 16. Definition Of Done

1. Schema, ingest, and API changes are merged with tests.
2. Raw price history is durable and replayable.
3. Derived public price-index series are queryable through the API.
4. Methodology and provenance are explicit in storage and public outputs.
5. Validation commands for touched packages are green.
