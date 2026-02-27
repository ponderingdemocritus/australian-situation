# PRD: Control Center Housing V1

- Status: Draft v0.1
- Date: 2026-02-27
- Target release: V1 (8-10 weeks from kickoff)
- Product surface: `Next.js` app + `Hono` API + ingestion worker

## 1. Problem and Goal

Australia housing signals are fragmented across releases and dashboards. Decision makers need one view that answers:

1. What is happening now?
2. Where pressure is building?
3. Where pressure is concentrated?
4. What happens under rate/income shocks?

V1 goal: deliver a fast housing control center with reliable core indicators and first-pass stress workflows.

## 2. In Scope (V1)

### 2.1 Housing Overview (home)

- Tiles for:
  - Home value index (`MoM`, `QoQ`, `YoY`)
  - Rental index `YoY` + vacancy proxy when available
  - New lending (`owner_occupier`, `investor`) counts + value
  - Average new loan size
  - Mortgage rates (`OO variable`, `OO fixed`)
  - Refinance volume (optional if data is available in time)
- Region filter: `AU`, state, capital city
- Frequency handling: monthly + quarterly series on one page

### 2.2 Credit and Leverage

- New lending split: levels and investor share
- Average loan size by region
- Refinance or churn trend if enabled
- Heat badges:
  - Fastest growing loan size region
  - Largest investor share increase region

### 2.3 Rates and Serviceability

- Charts:
  - Housing loan rates (`OO variable`, `OO fixed`, optional `investor variable`)
  - Optional RBA cash rate overlay
- Serviceability widget inputs:
  - Loan size (prefill from latest average loan)
  - Interest rate (prefill from latest rate)
  - Loan term (years)
  - Gross annual income
- Outputs:
  - Monthly repayment
  - Repayment as % of monthly income
  - Stress band (`Low`, `Medium`, `High`) using configurable thresholds

### 2.4 Stress and Exposure (first cut)

- Qualitative suburb/postcode watchlist from public hotspot reporting
- First exposure score framework (not full quantitative model yet):
  - `exposure_score = leverage_signal * rate_sensitivity * income_sensitivity`
- Region drill-down and watchlist tagging

## 3. Out of Scope (V1)

- Global coverage (US/EU)
- Licensed suburb-level price index ingestion
- Portfolio/user-level financial advice
- Full arrears feed integration from banks or paid risk vendors

## 4. Users and Core Jobs

- Policy/market analyst: detect trend shifts quickly.
- Credit strategist: monitor leverage, investor share, and refinance pressure.
- Founder/operator: run scenario stress snapshots for regional risk.

## 5. Data Contract (V1)

Canonical dimensions:

- `region_type`: `country | state | capital_city`
- `region_code`: `AU`, `NSW`, `VIC`, `SYD`, `MEL`, etc.
- `frequency`: `monthly | quarterly`
- `unit`: `% | aud | index | count`

Canonical series IDs (internal IDs; source mapping maintained in metadata):

1. `hvi.value.index`
2. `rent.value.index`
3. `lending.oo.count`
4. `lending.oo.value_aud`
5. `lending.investor.count`
6. `lending.investor.value_aud`
7. `lending.avg_loan_size_aud`
8. `rates.oo.variable_pct`
9. `rates.oo.fixed_pct`
10. `rates.investor.variable_pct` (optional)
11. `refinance.value_aud` (optional)

V1 sources:

- ABS lending indicators (counts, value, average loan size)
- RBA F5 housing lending rates
- Public housing index pathway for national/state/capital city
- Qualitative watchlist signals from public reporting

## 6. Functional Requirements

- `FR-001`: Overview API returns latest snapshot by region in under 300 ms from warm cache.
- `FR-002`: User can switch region across all charts with one control.
- `FR-003`: Serviceability widget computes repayment and DTI burden deterministically.
- `FR-004`: User can save named scenarios (`ai_shock`, `rate_shock`, `combined`) and reload them.
- `FR-005`: Stress page displays watchlist entries with source attribution and updated timestamp.
- `FR-006`: API serves only normalized DB data; no direct upstream calls in request path.

## 7. Non-Functional Requirements

- `NFR-001`: P95 web route render < 2.5 s on first load, < 1.2 s on cached reload.
- `NFR-002`: Ingestion jobs are idempotent and support rerun without duplicate observations.
- `NFR-003`: Every observation stores `series_id`, `date`, `value`, `region_code`, `source`, `vintage`.
- `NFR-004`: Observability includes ingestion run status, stale-series alerts, and API latency metrics.

## 8. API Contract (V1)

- `GET /api/health`
- `GET /api/housing/overview?region=AU`
- `GET /api/series?category=housing&region=NSW`
- `GET /api/series/:id?region=AU&from=2020-01-01&to=2026-12-31`
- `GET /api/housing/serviceability?loan=736000&rate=0.055&term=30&income=220000`
- `GET /api/housing/stress/watchlist?region=NSW`
- `GET /api/housing/scenarios`
- `POST /api/housing/scenarios`

## 9. Definition of Done (V1)

1. Overview loads instantly from stored series and exposes latest updates.
2. Region toggle supports `AU` + all states + capital cities.
3. Rates + lending + housing index series are visible and queryable.
4. Serviceability widget supports calculation and saved scenarios.
5. Stress page has qualitative watchlist and upgrade-ready exposure data model.

## 10. Risks and Mitigations

- Risk: suburb-level price data licensing constraints.
  - Mitigation: ship V1 without suburb index; build data model that supports later provider ingest.
- Risk: mixed frequency joins (monthly vs quarterly) confuse users.
  - Mitigation: explicit frequency labels and separate trend cards where needed.
- Risk: watchlist sources are qualitative.
  - Mitigation: label as qualitative and keep schema ready for quantitative replacements.

## 11. Milestones

1. Week 1-2: data contract, schema, ingestion skeleton, first series loaded.
2. Week 3-4: overview API and web overview UI.
3. Week 5-6: credit/rates pages and serviceability widget.
4. Week 7: stress watchlist page and scenario persistence.
5. Week 8: hardening, test gates, release candidate.
