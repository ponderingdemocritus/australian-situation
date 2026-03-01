# PRD: Electricity Prices (Australia vs Global) V1

Status: Draft for implementation
Owner: Product + Data Platform
Date: 2026-02-28

## 1) Problem Statement
We need a reliable way to compare Australian electricity prices against global benchmarks in one dashboard and via a public API. Today, we have partial Australian energy metrics but no consistent Australia-vs-global comparison product, no normalized KPI layer (tax/band/currency/PPP), and no externally consumable comparison endpoints.

## 2) Product Goal
Deliver a production-grade data product that answers:
1. How expensive is electricity in Australia versus peers right now?
2. Is Australia becoming more or less expensive over time, by wholesale and retail views?
3. Are comparisons methodologically valid (tax handling, consumption band, currency basis)?

## 3) Success Criteria
1. Dashboard supports Australia vs selected peers (EU aggregate, US, and selected countries) for wholesale and retail tracks.
2. API exposes comparison endpoints with explicit methodology metadata.
3. All exposed KPIs have documented formulas, units, dimensions, and source provenance.
4. Freshness and data quality statuses are visible for each KPI family.

## 4) Non-Goals (V1)
1. Full global country coverage across all markets.
2. Customer-specific bill estimation by tariff personalization.
3. Intraday retail billing simulation.
4. Trading-grade low-latency (< 1 minute) market data.

## 5) Personas and Use Cases
1. Policy analyst: compare AU household retail price vs peer countries, nominal and PPP.
2. Strategy/operator: monitor AU wholesale pressure vs EU/US reference levels.
3. Partner/API consumer: ingest standardized comparison KPIs for third-party products.

## 6) Scope (V1)

### 6.1 Data source scope
1. Australia wholesale: AEMO NEM (official).
2. Australia retail: AER PRD + DMO reference ingest.
3. US wholesale/retail anchor: EIA API.
4. EU wholesale anchor: ENTSO-E transparency API.
5. EU retail benchmark: Eurostat `nrg_pc_204`.
6. Normalization: World Bank FX + PPP indicators.
7. Optional accelerator: OpenElectricity for AU ingestion convenience.

### 6.2 Geography scope
1. Australia national and selected state-level where source supports.
2. Global peers: US, EU aggregate, and 5-10 pilot countries with clean data coverage.

### 6.3 Time scope
1. Wholesale: 5-minute (AU), hourly/day-ahead (where applicable), plus derived 1h/24h rollups.
2. Retail: daily/weekly snapshot of available official series or plan data, with monthly reporting views.

## 7) Information Architecture: What gets piped to dashboard via API

### 7.1 Dashboard panels and API contracts

| Dashboard panel | Endpoint | Primary KPIs | Refresh target |
|---|---|---|---|
| AU wholesale live | `/api/v1/energy/wholesale/live?region=AU&window=5m` | `kpi.au_wholesale_spot_aud_mwh`, `kpi.au_wholesale_1h_avg_aud_mwh`, `kpi.au_wholesale_24h_avg_aud_mwh` | <= 10 min |
| AU retail headline | `/api/v1/energy/retail/au-summary?region=AU` | `kpi.au_retail_annual_bill_aud_mean`, `kpi.au_retail_annual_bill_aud_median`, `kpi.au_retail_vs_dmo_gap_pct` | <= 24 h |
| AU vs peers retail | `/api/v1/energy/compare/retail?country=AU&peers=US,DE,FR,...&basis=nominal|ppp` | `kpi.au_vs_peer_retail_gap_pct_nominal`, `kpi.au_vs_peer_retail_gap_pct_ppp`, `kpi.au_retail_rank_nominal`, `kpi.au_retail_rank_ppp` | <= 7 d |
| AU vs peers wholesale | `/api/v1/energy/compare/wholesale?country=AU&peers=...` | `kpi.au_vs_peer_wholesale_gap_pct`, `kpi.au_wholesale_price_percentile` | <= 1 h |
| Methodology + confidence | `/api/v1/metadata/sources`, `/api/v1/metadata/freshness`, `/api/v1/metadata/methodology?metric=...` | Data quality and provenance fields | realtime from DB |

### 7.2 API exposure requirements
1. Public API versioning: `/api/v1/*`.
2. Backward compatibility period for existing `/api/*` endpoints.
3. Pagination and filtering on all comparison endpoints.
4. Response metadata must include `tax_status`, `consumption_band`, `currency_basis`, `methodology_version`.
5. Rate limiting and API key auth for external consumers.

## 8) Functional Requirements

### FR-1 Canonical metric taxonomy
Introduce series IDs and metadata fields to prevent apples-to-oranges comparisons.

Required fields per observation:
1. `series_id`
2. `country_code`, `region_code`, `market`
3. `metric_family` (`wholesale` | `retail` | `normalization`)
4. `value`, `unit`, `currency`
5. `tax_status` (`incl_tax` | `excl_tax` | `mixed`)
6. `consumption_band`
7. `interval_start_utc`, `interval_end_utc`
8. `published_at`, `ingested_at`, `vintage`
9. `source_id`, `methodology_version`, `confidence`

### FR-2 Ingestion pipelines
1. Implement source clients and mappers for AEMO, AER, EIA, ENTSO-E, Eurostat, World Bank.
2. Store raw payload snapshots for audit/debug.
3. Upsert canonical observations idempotently.
4. Schedule ingestion by source cadence.
5. Capture job run metrics and error summaries.

### FR-3 Comparison computation service
1. Compute normalized nominal USD and PPP-adjusted values.
2. Enforce tax and consumption band compatibility checks.
3. Provide ranking/percentile calculations over peer sets.
4. Emit quality flags when inputs are missing/mismatched.

### FR-4 API endpoints
1. `GET /api/v1/energy/wholesale/live`
2. `GET /api/v1/energy/retail/au-summary`
3. `GET /api/v1/energy/compare/retail`
4. `GET /api/v1/energy/compare/wholesale`
5. `GET /api/v1/metadata/sources`
6. `GET /api/v1/metadata/freshness`
7. `GET /api/v1/metadata/methodology`

### FR-5 Dashboard integration
1. Add "Australia vs Global" comparison section.
2. Add basis toggles: nominal USD vs PPP.
3. Add methodology badges (tax status, consumption band).
4. Add freshness chip and quality warning banners per panel.

## 9) Non-Functional Requirements
1. Availability: 99.5% monthly for read APIs.
2. p95 response latency: <= 300 ms for cached comparison queries.
3. Idempotent ingestion and replay safety.
4. Full source traceability for every KPI.
5. Test coverage: unit + integration route coverage for all new endpoints.

## 10) Data Model Changes
1. Extend `packages/data-contract` with energy comparison series IDs and enums.
2. Extend `packages/db` schema for normalization metadata fields if not already represented.
3. Keep existing `observations` compatibility; add migration for new fields as needed.

## 11) Rollout Plan
1. Phase 1: AU + EU + US foundational comparisons.
2. Phase 2: wider country set and WA-specific depth.
3. Phase 3: commercial global dataset integration (optional budget gate).

## 12) Risks and Mitigations
1. Method mismatch risk: enforce strict filter defaults and explicit metadata in response.
2. Missing retail history: snapshot AER plan outputs daily from day 1.
3. Source access friction: parallel onboarding for ENTSO-E token and AEMO WEM cert track.
4. Licensing risk for broad global data: keep adapter interface source-agnostic.

## 13) Release Acceptance Criteria
1. All V1 endpoints live behind `/api/v1` and documented.
2. Dashboard shows AU vs peers with basis toggle and metadata badges.
3. KPI catalog approved by product/data stakeholders.
4. Freshness and source metadata endpoints pass integration tests.
5. Backfill and replay runbooks documented and tested.
