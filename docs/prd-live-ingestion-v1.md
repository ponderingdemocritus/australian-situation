# PRD: Live Ingestion Platform (Housing + Energy) V1

- Status: Draft v1.0
- Date: 2026-02-27
- Target: Replace fixture-backed data with production ingestion pipelines
- Product context: powers `apps/api` and `apps/web` routes already wired in UI

## 1. Problem

The dashboard UI and API are now dynamic at request time, but core values are still fixture-backed in code. This blocks trustworthy "live" operation and creates operational risk (manual updates, no freshness guarantees, no lineage).

## 2. Goals

1. Ingest official Australian housing and energy datasets automatically.
2. Normalize all source data into canonical series/region contracts.
3. Serve only DB-backed data from API routes (no hardcoded fixtures).
4. Provide freshness, lineage, and reliability signals for every metric.

## 3. Non-Goals (V1)

1. Suburb/postcode licensed property feeds.
2. Personalized household tariff optimization.
3. Full WA/NT retail plan parity in a single official API framework.
4. Intraday correction/revision modeling beyond source vintages.

## 4. Current State (as of 2026-02-27)

1. UI fetches:
  - `GET /api/energy/overview?region=...`
  - `GET /api/housing/overview?region=...`
2. API endpoints return static fixture values.
3. Ingest app has scaffolds + initial job structure but no upstream live pulls.

## 5. Scope

### 5.1 In-Scope Sources and Cadence

| Domain | Source | Access | Expected update cadence | Ingestion cadence target |
|---|---|---|---|---|
| Housing | ABS Data API (Beta) | REST (`data.api.abs.gov.au/rest/...`) | Monthly / Quarterly | Poll daily + release-day refresh |
| Housing | RBA lenders rates (F6) | RBA statistical releases/tables | Monthly | Daily poll, process on change |
| Energy | AEMO NEM operational data (NEM Dashboard + NEMWeb) | Market data feeds/files | 5-minute market intervals | Every 5 minutes |
| Energy | AER Energy PRD (CDR) | Public REST endpoints | Frequent retailer updates | Hourly (or 15m if stable) |
| Energy benchmark | AER DMO determinations | Annual release docs/data | Annual | Daily poll during release windows |
| Macro context | ABS CPI electricity | ABS release | Quarterly | Daily poll, process on release |

Definitions:

1. `live`: source-backed metric updated <= 15 minutes from source availability.
2. `near_live`: source-backed metric updated <= 36 hours.
3. `periodic`: monthly/quarterly/annual source cadence.

### 5.2 In-Scope Internal Endpoints (DB-backed)

1. `GET /api/housing/overview`
2. `GET /api/series/:id`
3. `GET /api/energy/live-wholesale`
4. `GET /api/energy/retail-average`
5. `GET /api/energy/overview`
6. `GET /api/metadata/freshness`
7. `GET /api/metadata/sources`

## 6. Data Contracts

### 6.1 Canonical Keys

1. `series_id`
2. `region_code`
3. `date` (or interval timestamp for 5-minute series)
4. `vintage`

Uniqueness:

1. `UNIQUE(series_id, region_code, date, vintage)`

### 6.2 Required Observation Fields

1. `series_id`
2. `region_code`
3. `date`
4. `value`
5. `unit`
6. `source_name`
7. `source_url`
8. `published_at`
9. `ingested_at`
10. `vintage`
11. `is_modeled`
12. `confidence`

## 7. Ingestion Architecture

### 7.1 Pipeline Stages

1. `extract`: pull source payload.
2. `stage_raw`: persist raw payload + checksum for replay.
3. `parse_map`: map source fields to canonical series.
4. `validate`: schema + data quality checks.
5. `upsert`: idempotent write to observations.
6. `publish`: update freshness/materialized views.

### 7.2 Job Set (V1)

1. `sync-energy-wholesale-5m`
2. `sync-energy-retail-prd-hourly`
3. `sync-energy-benchmark-dmo-daily`
4. `sync-housing-abs-daily`
5. `sync-housing-rba-daily`
6. `sync-macro-abs-cpi-daily`

### 7.3 Stateful Controls

1. Per-source cursor/checkpoint table (`source_cursor`).
2. Idempotent replay with checksum and upsert keys.
3. Backfill window support (`from`, `to`, `dry_run`).

## 8. Data Quality and Freshness Rules

### 8.1 Validation Rules

1. Reject NaN/inf values.
2. Reject unknown region codes.
3. Reject unmapped `series_id`.
4. Flag outlier deltas beyond configurable thresholds.
5. Enforce monotonic time ordering in ingest batches.

### 8.2 Freshness SLOs

1. `energy.wholesale.*`: stale if lag > 20 minutes.
2. `energy.retail.*`: stale if lag > 48 hours.
3. `housing.*` monthly: stale if lag > expected release + 72 hours.
4. `housing.*` quarterly: stale if lag > expected release + 7 days.

## 9. API Requirements (Ingestion-Critical)

1. API must read only from DB tables/views.
2. API responses must include `freshness` and `source_refs`.
3. Missing series in region should not 500:
  - return partial payload + explicit missing list.

## 10. Reliability and Ops

1. Retry policy:
  - transient network failures: exponential backoff, max 3 retries.
  - parser/schema errors: fail fast, alert.
2. Every job emits `ingestion_runs` record:
  - start/end time, row counts, status, error summary.
3. Alerting:
  - critical: wholesale feed lag > 20 min.
  - warning: daily jobs fail 2 consecutive runs.

## 11. Security and Governance

1. No secrets in code; use environment variables for credentials/keys.
2. Persist source URLs and methodology versions for auditability.
3. Store raw payloads with retention policy (e.g., 30-90 days configurable).

## 12. Milestones (6-8 Weeks)

1. Week 1: schema + source client interfaces + cursor framework.
2. Week 2: AEMO wholesale ingest live (5-minute).
3. Week 3: AER PRD ingest + retail aggregation.
4. Week 4: ABS housing/CPI ingest + RBA rates ingest.
5. Week 5: API swap from fixtures to DB queries.
6. Week 6: freshness dashboard, replay tooling, hardening.
7. Week 7-8: burn-in, backfills, release.

## 13. Definition of Done

1. Fixture constants removed from production API route data paths.
2. All overview routes are DB-backed and freshness-annotated.
3. Job success rate >= 99% over 14-day burn-in.
4. Replay/backfill tested and documented.
5. CI tests + ingestion integration tests pass.

## 14. Sources (for implementation reference)

1. ABS Data API user guide:
   https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide
2. ABS Data API syntax and dataflow usage:
   https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide/using-api
3. ABS Indicator API (live release-oriented headline series):
   https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/indicator-api
4. AEMO NEM data dashboard (5-minute dispatch context):
   https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem
5. NEMWeb current reports directory:
   https://www.nemweb.com.au/REPORTS/CURRENT/
6. AER Energy Product Reference Data:
   https://www.aer.gov.au/energy-product-reference-data
7. RBA lenders' interest rates release page:
   https://www.rba.gov.au/statistics/interest-rates/
8. RBA statistical release schedule reference:
   https://www.rba.gov.au/statistics/tables/frequency-statistical-releases.html
