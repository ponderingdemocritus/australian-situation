# Australian-Made AI Deflation Index PRD + TDD Plan

## 1. Context

The repo now has:

1. a raw intake API for discovered price items
2. an unresolved queue and reconciliation flow
3. a promotion step from reconciled to promoted state
4. a major-goods price-index pipeline based on curated basket logic

That is enough for item discovery and queue management, but it is not yet enough to answer the strategic question:

> can we see AI-driven deflation in Australian-made products?

The current implementation is still too product-specific and too noisy for that question. A broader cohort model is needed.

## 2. Problem Statement

If the system scales to 100k products, a single product-level index will not be interpretable enough to isolate AI-driven price effects.

Three issues block that goal:

1. raw product feeds are too noisy on their own
2. product reconciliation is not yet enriched with origin and AI-exposure metadata
3. the public layer does not yet publish macro cohort indexes

Without cohort logic, the system cannot distinguish:

1. Australian-made vs imported products
2. AI-exposed vs non-AI-exposed products
3. genuine productivity-driven price movement vs general retail or import-price movement

## 3. Goals

1. Build a cohort layer above canonical products so the system can publish macro indexes.
2. Focus the first cohort model on Australian-made products.
3. Add AI-exposure metadata so products can be grouped into treatment and control baskets.
4. Publish a small set of interpretable cohort indexes rather than one giant product universe.
5. Keep raw discovery, reconciliation, promotion, and publication as separate stages.

## 4. Non-Goals

1. Proving causality from AI with econometric certainty in the first release.
2. Publishing a consumer-facing dashboard for every product family.
3. Solving perfect country-of-origin classification from day one.
4. Replacing the existing major-goods index.
5. Building a general-purpose customs or manufacturing ontology.

## 5. Core Thesis

AI deflation is more likely to appear as a relative effect than an absolute effect.

The system should therefore publish cohort comparisons such as:

1. Australian-made AI-exposed basket
2. Australian-made low-AI-exposure control basket
3. imported matched control basket
4. spread series between those cohorts

That makes the signal more interpretable than tracking all products equally.

## 6. Scope

### In Scope

1. canonical metadata for product families, origin, and AI exposure
2. promotion-stage validation gates for cohort readiness
3. basket definitions for AU-made and control cohorts
4. publication of cohort index series
5. API exposure of those cohort series and methodology metadata

### Out Of Scope

1. causal inference or academic-grade econometric modelling
2. customs integration
3. retailer-side inventory forecasting
4. per-agent trust scoring

## 7. Proposed Published Indexes

Start with these 5 public outputs:

1. `prices.au_made.all.index`
2. `prices.au_made.ai_exposed.index`
3. `prices.au_made.control.index`
4. `prices.imported.matched_control.index`
5. `prices.ai_deflation.spread.au_made_vs_control.index`

The spread series is the headline diagnostic for AI-linked relative price movement.

## 8. Data Model Changes

### 8.1 Canonical Product / Product-Family Metadata

Add canonical classification fields at the product or product-family layer:

1. `product_family_slug`
2. `country_of_origin`
3. `is_australian_made`
4. `manufacturer_name`
5. `domestic_value_share_band`
6. `ai_exposure_level`
7. `ai_exposure_reason`
8. `comparable_unit_basis`
9. `is_control_candidate`
10. `cohort_ready`

### 8.2 Promotion Readiness

Split promotion into logical stages:

1. `reconciled`
   - canonical product/category chosen
2. `promoted`
   - raw warehouse persistence allowed
3. `cohort_ready`
   - product can influence cohort indexes

Items should not affect cohort indexes until `cohort_ready = true`.

### 8.3 Cohort Definitions

Represent cohort membership through explicit cohort definitions and mappings rather than hardcoded filters in API handlers.

Minimum concepts:

1. cohort id
2. cohort name
3. inclusion rules
4. exclusion rules
5. effective-from date
6. methodology version

## 9. Product Selection Rules

The first cohort baskets should favor products that are:

1. repeat-observed
2. unit-normalizable
3. reasonably standardized
4. likely to have domestic production or domestic value-add
5. not dominated by retailer-only bundle churn

Good first cohorts:

1. cleaning products
2. paints and coatings
3. garden consumables
4. basic hardware consumables
5. packaged household consumables

Poor first cohorts:

1. highly spec-fragmented power tools
2. one-off seasonal ranges
3. products with weak unit comparability

## 10. Functional Requirements

### FR-1 Canonical Cohort Metadata

1. Reconciled products must support explicit origin and AI-exposure metadata.
2. Metadata must be versionable and auditable.
3. Cohort readiness must be machine-checkable.

### FR-2 Promotion Gating

1. Promotion must distinguish warehouse-ready items from cohort-ready items.
2. An item can be promoted without immediately entering a published basket.
3. Promotion logic must be idempotent.

### FR-3 Product-Family Rollups

1. Raw offer observations must aggregate to product-family daily rollups.
2. Cohort indexes must compute from product-family rollups, not directly from raw offers.
3. Unit normalization must remain explicit.

### FR-4 Cohort Basket Publication

1. Cohort baskets must be explicitly defined and versioned.
2. AU-made and control baskets must be reproducible by methodology version.
3. Spread series must derive from published cohort indexes, not ad hoc API math.

### FR-5 API Exposure

1. Cohort series must publish through the existing curated `series` + `observations` model.
2. Public API payloads must expose methodology clearly.
3. The API must not expose raw queue or raw fact tables as the default analytical surface.

## 11. API Strategy

Keep the current pattern:

1. raw discovery and reconciliation can stay operational and protected
2. public analytical reads should stay curated

Expected public API shape:

1. either new cohort overview routes
2. or curated series ids accessible through `/api/series/:id`

The implementation should prefer additive cohort routes only if the user experience clearly benefits.

## 12. Delivery Plan

### Phase A: Metadata Foundation

Deliver:

1. schema additions for origin, AI exposure, family grouping, and cohort readiness
2. tests for classification fields and constraints

Success criteria:

1. products can be marked AU-made and AI-exposed
2. cohort readiness is explicit and queryable

### Phase B: Promotion Consumer

Deliver:

1. promotion consumer that turns promoted queue items into canonical warehouse rows
2. product-family grouping logic
3. cohort-readiness gating

Success criteria:

1. promoted items persist into canonical structures
2. non-ready items do not leak into cohort baskets

### Phase C: Cohort Baskets

Deliver:

1. cohort definitions
2. cohort membership logic
3. cohort basket weights

Success criteria:

1. AU-made and control cohorts are reproducible
2. basket version changes do not mutate history

### Phase D: Publication

Deliver:

1. cohort index computation
2. spread-series computation
3. curated publication into `observations`

Success criteria:

1. the 5 target cohort series are queryable
2. methodology version is preserved

### Phase E: API and Documentation

Deliver:

1. API exposure
2. tests and OpenAPI updates
3. README updates for cohort methodology

Success criteria:

1. the public contract is documented and test-backed

## 13. TDD Execution Plan

### Phase A Tests First

1. add schema contract tests for new classification fields
2. RED: missing origin / AI-exposure / readiness fields
3. GREEN: add schema and migration

### Phase B Tests First

1. add promotion-consumer tests for stage transitions and idempotency
2. RED: promoted items bypass readiness or duplicate warehouse rows
3. GREEN: implement promotion consumer

### Phase C Tests First

1. add cohort-membership tests
2. RED: wrong items included in AU-made or control baskets
3. GREEN: implement cohort rules and mappings

### Phase D Tests First

1. add cohort-index calculation tests
2. RED: wrong rebasing or spread values
3. GREEN: implement publication logic

### Phase E Tests First

1. add API tests for cohort route or cohort series behavior
2. RED: missing methodology or wrong payload shape
3. GREEN: implement API wiring

## 14. Validation Matrix

```bash
bun --filter @aus-dash/db test
bun --filter @aus-dash/data-contract test
bun --filter @aus-dash/shared test
bun --filter @aus-dash/ingest test
bun --filter @aus-dash/api test
bun run docs:check
bun run typecheck
```

## 15. Acceptance Criteria

1. Products can be classified as Australian-made and AI-exposed.
2. Cohort readiness is explicit and enforced before publication.
3. Product-family rollups exist for promoted canonical items.
4. AU-made and control cohort baskets are versioned and reproducible.
5. The 5 target series publish through the curated observation layer.
6. Methodology metadata is explicit in tests and public outputs.

## 16. Definition Of Done

1. schema, ingest, and API changes are merged
2. promoted items can become cohort-ready
3. AU-made and control cohort indexes are published
4. spread series is queryable
5. validation commands for touched packages are green
