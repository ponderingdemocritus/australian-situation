# Roadmap: Australia Housing + Energy Data (Research-Based)

- Date: 2026-02-27
- Status: Proposed
- Scope: `AU` dashboard roadmap for Housing first, then Energy (including live energy pricing signal)

## 1. Target Outcome

Ship a reliable data platform in phases:

1. Housing: stable national/state/capital-city indicators from official sources.
2. Energy: live market signal + consumer-price context, then evolve to stronger "average household cost" estimates.

## 2. Data Source Roadmap

### 2.1 Housing (Phase 1 baseline)

| Source | What we use | Frequency | Access pattern | Decision |
|---|---|---:|---|---|
| ABS Data API | Canonical housing time series pull mechanism | Monthly/Quarterly | REST (`/api/v1/data/...`) | Primary ingestion path |
| ABS Building Approvals | New dwelling approvals/values | Monthly | Publication + API-backed extraction | Include in V1 |
| ABS Lending Indicators | Housing finance commitments and values | Monthly | Publication + API-backed extraction | Include in V1 |
| ABS Total Value of Dwellings | Stock/value context for dwelling market | Quarterly | Publication + API-backed extraction | Include in V1 |
| Housing Data Dashboard update schedule | Cadence checks and supplemental context | Mixed (monthly to annual by indicator) | Reference schedule | Use for freshness QA, not primary API |

Notes:
- Existing Housing V1 docs in this repo already align with this direction.
- Keep suburb/postcode detail as V2 via licensed feeds if needed.

### 2.2 Energy (Phase 2 baseline)

| Source | What we use | Frequency | Access pattern | Decision |
|---|---|---:|---|---|
| AEMO NEM data streams (dashboard + NEMWeb) | Regional reference price (wholesale), demand context | 5-minute | File/API ingest | Primary live signal |
| AER Product Reference Data (CDR energy plans) | Retail offer prices, charges, plan metadata | Near-live provider updates | REST (`/cds-au/v1/energy/plans`, plan detail endpoints) | Primary retail-price feed |
| AER DMO determinations | Regulated benchmark household bill references | Annual | PDF/table ingest | Benchmark anchor |
| AER State of the Energy Market data | Trend validation and QA | Quarterly/Annual | Downloadable data | Secondary validation |
| ABS CPI (includes electricity) | Consumer inflation context for electricity | Monthly/Quarterly publication | Publication/API-backed extraction | Context KPI |

Important limitation:
- AER explicitly notes no single Australia-wide API coverage for all jurisdictions/policies and no API coverage in WA/NT in their comparison context. Treat "national average" as a modeled metric, not a direct official feed.

## 3. "Live Average Energy Cost" Definition

There is no single official real-time API for Australian household retail electricity cost. Implement in layers:

1. `Live wholesale index` (official, 5-min): AU weighted average of NEM regional reference prices (`AUD/MWh`, converted to `c/kWh`).
2. `Retail offer average` (near-live): median/mean residential offer from AER PRD plans by region and tariff type.
3. `Estimated household cost` (modeled, clearly labeled): derive from retail offer data with standard usage assumptions; optionally add a conservative wholesale pass-through nowcast later.

Recommendation:
- V1 dashboard should show (1) and (2) separately.
- Add (3) only when methodology and caveats are reviewed and signed off.

## 4. API Scope Plan

### 4.1 External Ingestion Scopes

1. `housing.abs.core`
  - Pull ABS housing/lending/dwelling datasets through ABS API.
2. `energy.aemo.wholesale_live`
  - Pull 5-minute NEM price data.
3. `energy.aer.retail_plans`
  - Pull AER CDR plan and plan-detail endpoints.
4. `energy.aer.benchmark`
  - Extract annual DMO benchmark values.
5. `macro.abs.cpi_energy`
  - Pull electricity CPI for context.

### 4.2 Internal Product API Scopes (for frontend + partners)

1. Housing
  - `GET /api/housing/overview?region=AU|STATE|CAPITAL`
  - `GET /api/series/:id?region=&from=&to=`
2. Energy
  - `GET /api/energy/overview?region=AU|STATE`
  - `GET /api/energy/live-wholesale?region=AU|NSW|VIC|...&window=5m|1h|24h`
  - `GET /api/energy/retail-average?region=&customer_type=residential`
  - `GET /api/energy/household-estimate?region=&usage_profile=default` (modeled; label as estimate)
3. Platform
  - `GET /api/metadata/sources`
  - `GET /api/metadata/freshness`

## 5. Implementation Plan (8-10 weeks)

### Phase 0 (Week 1): Contract and Method Decisions

1. Lock canonical energy series IDs in `packages/data-contract`.
2. Agree weighting method for AU wholesale index (population vs demand weighted).
3. Define retail average method (median vs trimmed mean; residential-only filters).
4. Add explicit "modeled metric" flag in schema for derived series.

### Phase 1 (Weeks 1-3): Housing Hardening

1. Complete Housing V1 ingestion with ABS-backed pulls and freshness metadata.
2. Finalize region mapping (`AU`, states, capital cities) and mixed-frequency rendering.
3. Add stale-series alerting for each housing series.

### Phase 2 (Weeks 3-5): Energy Ingestion MVP

1. Build `apps/ingest` job: `energy-aemo-wholesale-5m`.
2. Build `apps/ingest` job: `energy-aer-prd-daily`.
3. Build `apps/ingest` job: `energy-dmo-annual`.
4. Build `apps/ingest` job: `energy-abs-cpi-monthly`.
5. Add idempotent upsert tests for all new parsers/mappers.

### Phase 3 (Weeks 5-7): API + UI Delivery

1. Implement energy API routes in `apps/api`.
2. Add overview cards/charts in `apps/web`:
  - live wholesale (5-minute updates),
  - retail average (daily),
  - benchmark comparison (DMO/VDO-style annual anchor).
3. Add source attribution + last-updated labels to every chart.

### Phase 4 (Weeks 7-8): Modeled Household Metric + QA

1. Implement `household_estimate` as opt-in experimental metric.
2. Add method notes and confidence indicator in UI.
3. Add contract tests to ensure estimates are never returned without provenance fields.

### Phase 5 (Weeks 9-10): Release Readiness

1. E2E scenarios for region switch and data freshness.
2. Performance checks on overview APIs.
3. Backfill/replay tooling for ingestion reruns.

## 6. Minimum Delivery Slice for Next Sprint

1. Approve source list + metric definitions.
2. Implement AEMO 5-minute ingest + `GET /api/energy/live-wholesale`.
3. Implement AER PRD ingest + `GET /api/energy/retail-average`.
4. Ship one Energy overview page with explicit caveats.

## 7. Sources

Housing and macro:

- ABS API data access and syntax: https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide
- ABS Building Approvals: https://www.abs.gov.au/statistics/industry/building-and-construction/building-approvals-australia/latest-release
- ABS Lending Indicators: https://www.abs.gov.au/statistics/economy/finance/lending-indicators/latest-release
- ABS Total Value of Dwellings: https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release
- ABS Consumer Price Index: https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release
- Housing Data Dashboard update schedule: https://www.housingdata.gov.au/updates/2026-02-18-data-sources-and-update-schedule

Energy:

- AEMO NEM data dashboard (5-minute update context): https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem
- NEMWeb current reports directory (operational data feed): https://www.nemweb.com.au/REPORTS/CURRENT/
- AER Product Reference Data API details (Energy Made Easy/Victorian Energy Compare): https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body
- AER Default Market Offer final determinations: https://www.aer.gov.au/industry/registers/resources/determinations/default-market-offer-prices-2025-26-final-determination
- AER State of the Energy Market data downloads: https://www.aer.gov.au/industry/registers/resources/reports/state-energy-market-2024
