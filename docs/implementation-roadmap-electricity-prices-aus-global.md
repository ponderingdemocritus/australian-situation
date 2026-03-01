# Implementation Roadmap: Electricity Prices (AU vs Global)

Status: Execution plan
Date: 2026-02-28
Timeline: 12 weeks (Phase 1 + hardening)

## 1) Delivery Outcomes
1. Reliable pipelines for AU + global electricity price sources.
2. Canonical KPI layer with nominal and PPP views.
3. API-first comparison services exposed internally and externally.
4. Dashboard panels driven only by API responses, no direct source coupling.

## 2) Workstreams
1. Data contracts and schema
2. Source ingestion and normalization
3. Comparison compute services
4. Public/internal API endpoints
5. Dashboard integration
6. Quality, observability, and operational readiness

## 3) Phased Roadmap

### Phase 0 (Week 1): Foundation and contract freeze
Deliverables:
1. Finalize KPI catalog and metric taxonomy.
2. Define canonical observation schema additions.
3. Define `/api/v1` endpoint contracts and response examples.
4. Establish baseline TDD test matrix.

Exit criteria:
1. PRD, KPI definitions, and TDD plan approved.
2. Contract tests fail (RED) for all new API response shapes.

### Phase 1 (Weeks 2-4): AU-first production data pipelines
Deliverables:
1. Harden AEMO wholesale ingestion to canonical series set.
2. Harden AER PRD ingestion and daily snapshot strategy.
3. Add DMO benchmark ingest job.
4. Add metadata/methodology records in source catalog.

Exit criteria:
1. AU wholesale and retail KPIs available via DB-backed repository.
2. Freshness metadata correctly computed for AU series.

### Phase 2 (Weeks 5-7): Global connectors + normalization
Deliverables:
1. EIA client and mapper.
2. ENTSO-E client and mapper.
3. Eurostat retail dataset integration (`nrg_pc_204`).
4. World Bank FX and PPP normalization pipeline.
5. Canonical normalization service (nominal + PPP transforms).

Exit criteria:
1. AU vs US/EU comparable retail and wholesale datasets present.
2. Tax status and consumption band compatibility checks enforced.

### Phase 3 (Weeks 8-10): API and dashboard comparison surfaces
Deliverables:
1. `/api/v1/energy/compare/retail` and `/api/v1/energy/compare/wholesale`.
2. `/api/v1/energy/wholesale/live` and `/api/v1/energy/retail/au-summary` hardening.
3. `/api/v1/metadata/methodology` endpoint.
4. Dashboard AU-vs-global panels, rank cards, and basis toggle.

Exit criteria:
1. End-to-end dashboard works from API only.
2. External API docs + sample queries published.

### Phase 4 (Weeks 11-12): Hardening and launch readiness
Deliverables:
1. Backfill/replay tooling and runbooks.
2. Rate limiting + API key controls for external exposure.
3. Alerting on freshness, schema drift, and ingestion failures.
4. Load testing and reliability sign-off.

Exit criteria:
1. SLOs met for latency and freshness.
2. Launch checklist signed by product + engineering.

## 4) Detailed Backlog by Package

### 4.1 `packages/data-contract`
1. Add energy comparison series IDs and enums.
2. Add metadata enums for `tax_status`, `consumption_band`, `currency_basis`.
3. Add contract tests for all new IDs and schema invariants.

### 4.2 `packages/db`
1. Add migration for new observation metadata fields if required.
2. Add indexes for comparison query paths (`country_code`, `metric_family`, `date`).
3. Add schema tests for uniqueness and query performance assumptions.

### 4.3 `apps/ingest`
1. Add source clients: EIA, ENTSO-E, Eurostat, World Bank.
2. Add mappers to canonical observation shape.
3. Add jobs: `sync-energy-retail-global`, `sync-energy-wholesale-global`, `sync-energy-normalization`.
4. Add scheduler entries and retry policies.
5. Add snapshot integrity checks and schema drift guards.

### 4.4 `apps/api`
1. Add `/api/v1` route group.
2. Add comparison service domain module for gaps/ranks/percentiles.
3. Add filters and validation (`peers`, `basis`, `tax_status`, `consumption_band`).
4. Add metadata methodology endpoint.
5. Add API key middleware and rate limiting for external API mode.

### 4.5 `apps/web`
1. Add AU-vs-global comparison panel.
2. Add basis toggle and peer selector.
3. Render methodology badges and freshness chips.
4. Add empty/error states for partial data quality conditions.

## 5) Data Flow: Source -> API -> Dashboard

| Source | Ingest job | Canonical series family | API endpoint | Dashboard usage |
|---|---|---|---|---|
| AEMO NEM | `sync-energy-wholesale` | `energy.wholesale.*` | `/api/v1/energy/wholesale/live` | AU live wholesale and trend |
| AER PRD + DMO | `sync-energy-retail-plans`, `sync-energy-benchmark-dmo` | `energy.retail.*`, `energy.benchmark.*` | `/api/v1/energy/retail/au-summary` | AU retail headline and DMO gap |
| EIA | `sync-energy-wholesale-global`, `sync-energy-retail-global` | `energy.wholesale.us.*`, `energy.retail.us.*` | `/api/v1/energy/compare/*` | US comparator |
| ENTSO-E | `sync-energy-wholesale-global` | `energy.wholesale.eu.*` | `/api/v1/energy/compare/wholesale` | EU wholesale comparator |
| Eurostat | `sync-energy-retail-global` | `energy.retail.eu.*` | `/api/v1/energy/compare/retail` | EU retail comparator |
| World Bank | `sync-energy-normalization` | `macro.fx.*`, `macro.ppp.*` | `/api/v1/energy/compare/*` | Nominal vs PPP switch |

## 6) External API Exposure Plan
1. Keep internal and external APIs on same contract, with auth policy differences only.
2. Publish `/api/v1` OpenAPI spec.
3. Use API keys for external clients and environment-based toggles.
4. Apply tiered rate limits by endpoint cost profile.
5. Include attribution metadata and source licensing constraints in responses/docs.

## 7) Operational Readiness Checklist
1. Scheduled jobs have retry + dead-letter alert paths.
2. Freshness alerts for each KPI family.
3. Schema drift alerts from source clients.
4. Data QA checks for outliers and null-rate spikes.
5. Runbook for token/certificate rotation (ENTSO-E, AEMO WEM if used).

## 8) Milestone Exit Reviews
1. Phase 1 review: AU-only accuracy and freshness.
2. Phase 2 review: normalization correctness and comparability validity.
3. Phase 3 review: dashboard usability and API contract stability.
4. Phase 4 review: reliability, security, and launch readiness.
