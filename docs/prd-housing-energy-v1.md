# PRD: Australia Housing + Energy Control Center (V1)

- Status: Draft v1.0
- Date: 2026-02-27
- Target release: 10 weeks from kickoff
- Product surface: `Next.js` web app + `Hono` API + scheduled ingestion workers + Postgres
- Geography: Australia (`AU`, states, capital cities)

## 1. Problem Statement

Decision makers cannot reliably compare Australian housing pressure and household energy cost pressure in one place. Core indicators are fragmented across ABS, AEMO, and AER data sources with different cadences and formats.

The product must answer:

1. What is happening now in housing and energy?
2. Which regions are under more pressure?
3. Are conditions improving or worsening relative to benchmarks?
4. Is the data current and trustworthy?

## 2. Product Goals

1. Deliver a single dashboard with high-trust housing and energy indicators.
2. Provide "live" energy market context while clearly distinguishing modeled estimates from official feeds.
3. Ship APIs and contracts that support internal web UI and future partner integrations.
4. Ensure request-time reads only use normalized local DB data (no upstream dependencies in API path).

## 3. Non-Goals (V1)

1. Suburb-level licensed property price modeling.
2. Personalized household financial advice.
3. Full WA/NT retail-plan parity in a single official API framework.
4. Real-time individualized tariff estimation from smart meter interval data.

## 4. Users and Jobs-To-Be-Done

### 4.1 Personas

1. Policy Analyst
2. Market Strategist
3. Operator/Founder
4. Research Associate

### 4.2 Core Jobs

1. Identify trend shifts quickly by region.
2. Compare housing leverage and energy-cost pressure on one screen.
3. Export and cite source-attributed metrics.
4. Track freshness and confidence for every metric.

## 5. Scope

### 5.1 Housing Module (V1)

1. Overview tiles:
  - Home value index (`MoM`, `QoQ`, `YoY`)
  - Rental index (`YoY`)
  - Lending counts and values (`owner_occupier`, `investor`)
  - Average loan size
  - Mortgage rates (`OO variable`, `OO fixed`)
2. Region filter: `AU`, all states, capital cities.
3. Frequency support: monthly + quarterly series.
4. Serviceability widget with scenario save/reload.
5. Stress watchlist with qualitative source attribution.

### 5.2 Energy Module (V1)

1. Live wholesale panel:
  - NEM regional reference price and AU weighted view.
  - 5-minute updates with 1h and 24h rollups.
2. Retail offer panel:
  - Residential plan averages from AER Product Reference Data.
  - Mean/median price outcomes by region.
3. Benchmark panel:
  - DMO annual benchmark comparison.
4. Modeled household estimate:
  - Experimental and explicitly labeled as modeled.
  - Disabled by default until sign-off.

## 6. Data Sources and Refresh Policy

| Domain | Source | Metric class | Cadence | Freshness SLO |
|---|---|---|---|---|
| Housing | ABS Data API | Lending, dwellings, building indicators | Monthly/Quarterly | < 48h after publication |
| Housing | RBA series (rates) | Housing loan rates | Monthly | < 48h after publication |
| Energy | AEMO NEM feeds | Wholesale reference prices | 5-minute | < 15 minutes |
| Energy | AER PRD (CDR plans) | Retail plan pricing and charges | Near-live updates, daily pull | < 36 hours |
| Energy | AER DMO determinations | Benchmark annual bill | Annual | < 7 days after release |
| Macro | ABS CPI | Electricity CPI context | Quarterly publication | < 72h after publication |

Rules:

1. Every observation stores `source_name`, `source_url`, `published_at`, `ingested_at`, `vintage`, and `methodology_version`.
2. Staleness is computed per series based on expected cadence.
3. Any derived metric must set `is_modeled=true` and include a provenance payload.

## 7. Metric Definitions

### 7.1 Energy "Live Average Cost" Decomposition

V1 does not claim one official real-time national household bill. It exposes three layers:

1. `live_wholesale_index` (official live signal): AU weighted wholesale reference price.
2. `retail_offer_average` (consumer offer signal): daily aggregated residential plan outcomes.
3. `household_estimate` (modeled): estimate from plan structures and standard usage assumptions.

Definition requirements:

1. UI must label each layer with `Official` or `Modeled`.
2. API response must include `method_summary`.
3. Any cross-region "AU average" must declare weighting basis (`demand_weighted` or `population_weighted`).

### 7.2 Canonical Dimensions

1. `region_type`: `country | state | capital_city`
2. `region_code`: `AU | NSW | VIC | QLD | SA | WA | TAS | ACT | NT | SYD | MEL | BNE | ADL | PER | HBA | DRW | CBR`
3. `frequency`: `5min | hourly | daily | monthly | quarterly | annual`
4. `unit`: `% | aud | aud_mwh | c_kwh | index | count`
5. `confidence`: `official | derived | qualitative`

### 7.3 Canonical Series IDs (V1)

Housing:

1. `hvi.value.index`
2. `rent.value.index`
3. `lending.oo.count`
4. `lending.oo.value_aud`
5. `lending.investor.count`
6. `lending.investor.value_aud`
7. `lending.avg_loan_size_aud`
8. `rates.oo.variable_pct`
9. `rates.oo.fixed_pct`

Energy:

1. `energy.wholesale.rrp.region_aud_mwh`
2. `energy.wholesale.rrp.au_weighted_aud_mwh`
3. `energy.wholesale.rrp.au_weighted_c_kwh`
4. `energy.retail.offer.annual_bill_aud.mean`
5. `energy.retail.offer.annual_bill_aud.median`
6. `energy.retail.offer.usage_rate_c_kwh.mean`
7. `energy.retail.offer.daily_charge_aud_day.mean`
8. `energy.benchmark.dmo.annual_bill_aud`
9. `energy.cpi.electricity.index`
10. `energy.household.estimate.monthly_aud` (modeled, optional)

## 8. Functional Requirements

### 8.1 Cross-Cutting

1. `FR-001`: `GET /api/health` returns service, DB, and ingestion status.
2. `FR-002`: All chart APIs return `updated_at` and `freshness_status`.
3. `FR-003`: Region switch updates all visible panels with one state change.
4. `FR-004`: APIs return standardized error shape (`code`, `message`, `details`).
5. `FR-005`: API never calls upstream data providers at request time.

### 8.2 Housing

1. `FR-101`: `GET /api/housing/overview` returns latest snapshot by region.
2. `FR-102`: `GET /api/series/:id` supports date filters and sorted output.
3. `FR-103`: Serviceability endpoint returns repayment and burden ratio.
4. `FR-104`: Scenario save/reload works for named inputs.
5. `FR-105`: Watchlist endpoint returns source-attributed qualitative entries.

### 8.3 Energy

1. `FR-201`: `GET /api/energy/live-wholesale` returns 5-minute latest and rollups.
2. `FR-202`: `GET /api/energy/retail-average` returns daily region summaries.
3. `FR-203`: `GET /api/energy/overview` merges wholesale, retail, benchmark, and CPI context.
4. `FR-204`: `GET /api/energy/household-estimate` returns modeled value only when feature flag is enabled.
5. `FR-205`: Every energy response includes `method_summary`, `source_refs`, and `is_modeled`.

## 9. API Contract (V1)

### 9.1 Public Product Endpoints

1. `GET /api/health`
2. `GET /api/housing/overview?region=AU|STATE|CAPITAL`
3. `GET /api/series/:id?region=AU&from=2020-01-01&to=2026-12-31`
4. `GET /api/housing/serviceability?loan=&rate=&term=&income=`
5. `GET /api/housing/scenarios`
6. `POST /api/housing/scenarios`
7. `GET /api/housing/stress/watchlist?region=NSW`
8. `GET /api/energy/overview?region=AU|STATE`
9. `GET /api/energy/live-wholesale?region=AU|NSW|VIC|QLD|SA|TAS&window=5m|1h|24h`
10. `GET /api/energy/retail-average?region=AU|STATE&customer_type=residential`
11. `GET /api/energy/household-estimate?region=AU|STATE&usage_profile=default`
12. `GET /api/metadata/sources`
13. `GET /api/metadata/freshness`

### 9.2 Response Contract Minimum Fields

For each time-series point:

1. `series_id`
2. `date`
3. `value`
4. `unit`
5. `region_code`
6. `source_name`
7. `source_url`
8. `published_at`
9. `ingested_at`
10. `vintage`
11. `is_modeled`
12. `confidence`

## 10. UI/UX Requirements

1. Overview pages show metric value, delta, source label, updated timestamp, and freshness badge.
2. Any modeled metric uses explicit badge: `Modeled estimate`.
3. Tooltip reveals `method_summary` and weighting details.
4. Data stale banner appears when freshness SLO is violated.
5. Region selector persists in URL query string.

## 11. Data Ingestion Requirements

### 11.1 Jobs

1. `housing-abs-monthly`
2. `housing-rba-monthly`
3. `energy-aemo-5m`
4. `energy-aer-prd-daily`
5. `energy-dmo-annual`
6. `macro-abs-cpi-quarterly`

### 11.2 Ingestion Behavior

1. Idempotent upsert key: `(series_id, region_id, date, vintage)`.
2. Retry policy:
  - network error: exponential backoff (max 3 retries),
  - schema mismatch: fail and alert,
  - partial ingestion: mark run `degraded`.
3. Store ingestion run logs in `ingestion_runs`.

## 12. Non-Functional Requirements

1. `NFR-001`: `GET /api/housing/overview` P95 < 300 ms (warm cache).
2. `NFR-002`: `GET /api/energy/live-wholesale` P95 < 300 ms (warm cache).
3. `NFR-003`: Web P95 first-load route render < 2.5s; cached reload < 1.2s.
4. `NFR-004`: Ingestion success rate >= 99% monthly.
5. `NFR-005`: Data quality checks block publish on schema failures.
6. `NFR-006`: Audit trail available for all modeled metric versions.

## 13. Observability and Alerting

1. Metrics:
  - API latency, error rate, cache hit rate.
  - ingestion runtime and success/failure counts.
  - per-series freshness lag.
2. Alerts:
  - critical: live wholesale lag > 20 minutes.
  - warning: retail feed lag > 48 hours.
  - warning: housing series lag > expected cadence + 72 hours.
3. Dashboard:
  - ingestion run timeline.
  - stale-series table.

## 14. Security and Access

1. Internal dashboard users authenticated through existing app auth strategy.
2. Rate limit external-facing API routes.
3. Validate all query params and reject unsupported region/series combinations.
4. Avoid storing any personally identifiable household inputs in logs.

## 15. Success Metrics

Product:

1. 90% of user sessions load overview without stale warnings.
2. 80% of active users use both housing and energy tabs in same session.
3. < 2% endpoint error rate across overview routes.

Data:

1. 100% of published points have source attribution fields.
2. 100% of modeled points have methodology version.
3. 0 duplicated observation rows under rerun tests.

## 16. Risks and Mitigations

1. Risk: "Live average energy cost" may be interpreted as official retail bill.
  - Mitigation: split into official live wholesale and separate retail average; modeled badge mandatory.
2. Risk: Source cadence mismatch causes confusing comparisons.
  - Mitigation: frequency-specific labeling and freshness badges.
3. Risk: AER jurisdiction limitations reduce national comparability.
  - Mitigation: document coverage scope and confidence notes by region.
4. Risk: Upstream schema changes break parsers.
  - Mitigation: contract tests with fixture snapshots and schema alarms.

## 17. Milestones (10 Weeks)

1. Week 1: Data contract and methodology lock.
2. Week 2-3: Housing ingestion hardening and API stabilization.
3. Week 4-5: Energy ingestion MVP (AEMO + AER PRD + DMO).
4. Week 6-7: Energy API routes and dashboard UI.
5. Week 8: Modeled estimate flag and provenance pipeline.
6. Week 9: E2E hardening and performance tuning.
7. Week 10: Release candidate and production checklist.

## 18. Definition of Done

1. Housing + Energy overview pages are live with region switching.
2. All API responses include source and freshness metadata.
3. Live wholesale and retail average endpoints are production-ready.
4. Modeled estimate is either disabled or released with approved methodology notes.
5. CI gates pass with required coverage and e2e smoke tests.

## 19. Open Decisions (Must Close in Week 1)

1. AU wholesale weighting basis (`demand` vs `population`).
2. Retail average method (`mean`, `median`, or trimmed mean).
3. Standard household usage profile definitions by region.
4. Feature-flag default for `household_estimate`.
