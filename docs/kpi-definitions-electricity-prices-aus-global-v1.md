# KPI Definitions: Electricity Prices (AU vs Global) V1

Status: Draft for sign-off
Date: 2026-02-28

## 1) KPI Design Rules
1. Do not mix wholesale and retail KPIs in a single metric.
2. Always expose tax status and consumption band for retail KPIs.
3. Provide both nominal and PPP comparison views for cross-country KPI families.
4. Every KPI must include source and freshness metadata.

## 2) Core Dimensions
1. `country_code`
2. `region_code`
3. `market`
4. `timestamp` or `period`
5. `tax_status`
6. `consumption_band`
7. `currency_basis` (`local`, `usd_nominal`, `usd_ppp`)
8. `methodology_version`

## 3) KPI Catalog

### 3.1 Wholesale KPI family

| KPI ID | Name | Formula | Unit | Cadence | Source |
|---|---|---|---|---|---|
| `kpi.au_wholesale_spot_aud_mwh` | AU wholesale spot price | Latest demand-weighted AU RRP from regional points | AUD/MWh | 5m | AEMO |
| `kpi.au_wholesale_1h_avg_aud_mwh` | AU wholesale 1h average | Mean of last 12 five-minute AU wholesale spot points | AUD/MWh | 5m rollup | AEMO |
| `kpi.au_wholesale_24h_avg_aud_mwh` | AU wholesale 24h average | Mean of all AU wholesale spot points in trailing 24h window | AUD/MWh | 5m rollup | AEMO |
| `kpi.au_wholesale_spot_usd_mwh` | AU wholesale spot (USD nominal) | `kpi.au_wholesale_spot_aud_mwh / fx_aud_per_usd` | USD/MWh | 5m+daily FX | AEMO + World Bank |
| `kpi.au_vs_peer_wholesale_gap_pct` | AU vs peer wholesale gap | `(au_wholesale_usd_mwh - peer_wholesale_usd_mwh) / peer_wholesale_usd_mwh * 100` | % | hourly/daily | AEMO + ENTSO-E/EIA |
| `kpi.au_wholesale_price_percentile` | AU wholesale percentile vs peers | Percentile rank of AU wholesale price within selected peer set | percentile | hourly/daily | Derived |

### 3.2 Retail KPI family

| KPI ID | Name | Formula | Unit | Cadence | Source |
|---|---|---|---|---|---|
| `kpi.au_retail_annual_bill_aud_mean` | AU retail annual bill mean | Arithmetic mean of eligible residential plan annual bills | AUD/year | daily | AER PRD |
| `kpi.au_retail_annual_bill_aud_median` | AU retail annual bill median | Median of eligible residential plan annual bills | AUD/year | daily | AER PRD |
| `kpi.au_retail_vs_dmo_gap_pct` | AU retail mean vs DMO gap | `(retail_mean_aud - dmo_annual_bill_aud) / dmo_annual_bill_aud * 100` | % | daily | AER PRD + DMO |
| `kpi.au_retail_price_usd_kwh_nominal` | AU retail price nominal | `retail_local_kwh / fx_local_per_usd` | USD/kWh | daily/weekly | AER/Eurostat/EIA + FX |
| `kpi.au_retail_price_usd_kwh_ppp` | AU retail price PPP | `retail_local_kwh / ppp_local_per_usd` | PPP-adjusted USD/kWh | daily/weekly | AER/Eurostat/EIA + PPP |
| `kpi.au_vs_peer_retail_gap_pct_nominal` | AU vs peer retail gap (nominal) | `(au_retail_usd_kwh_nominal - peer_usd_kwh_nominal) / peer_usd_kwh_nominal * 100` | % | weekly/monthly | Derived |
| `kpi.au_vs_peer_retail_gap_pct_ppp` | AU vs peer retail gap (PPP) | `(au_retail_usd_kwh_ppp - peer_usd_kwh_ppp) / peer_usd_kwh_ppp * 100` | % | weekly/monthly | Derived |
| `kpi.au_retail_rank_nominal` | AU retail rank nominal | Rank of AU among peer set by nominal retail USD/kWh | rank | weekly/monthly | Derived |
| `kpi.au_retail_rank_ppp` | AU retail rank PPP | Rank of AU among peer set by PPP retail USD/kWh | rank | weekly/monthly | Derived |

### 3.3 Data quality KPI family

| KPI ID | Name | Formula | Unit | Cadence | Source |
|---|---|---|---|---|---|
| `kpi.energy_freshness_sla_pass_pct` | Freshness SLA pass rate | `fresh_series_count / total_series_count * 100` over evaluation window | % | hourly | API metadata |
| `kpi.energy_ingest_job_success_pct` | Ingestion success rate | `successful_runs / total_runs * 100` by job and source | % | hourly/daily | ingestion_runs |
| `kpi.energy_schema_drift_incidents` | Schema drift incident count | Count of source parsing failures flagged as non-transient schema errors | count | daily | ingest alerts |

## 4) Comparator Methodology
1. Retail comparisons require matching `tax_status` and compatible `consumption_band`.
2. Wholesale comparisons use same-time or nearest-period windows.
3. Rankings are computed on selected peer set only and must echo the peer set in response metadata.
4. If compatibility filters remove all peers, endpoint returns explicit `NO_COMPARABLE_PEERS` error.

## 5) KPI API Response Requirements
Each KPI response row must include:
1. `kpi_id`
2. `value`
3. `unit`
4. `country_code` and `region_code`
5. `period_start` and `period_end`
6. `currency_basis`
7. `tax_status`
8. `consumption_band`
9. `source_refs[]`
10. `freshness_status` and `updated_at`
11. `methodology_version`

## 6) Guardrails
1. Do not display a gap/rank KPI when methodology compatibility checks fail.
2. Mark derived KPIs with `is_modeled=true` and confidence `derived`.
3. Preserve raw source values and transformed values separately.

## 7) Example KPI Payload (Retail Comparison)

```json
{
  "kpiId": "kpi.au_vs_peer_retail_gap_pct_ppp",
  "countryCode": "AU",
  "peerCountryCode": "US",
  "value": 18.4,
  "unit": "%",
  "currencyBasis": "usd_ppp",
  "taxStatus": "incl_tax",
  "consumptionBand": "household_mid",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "sourceRefs": [
    {
      "name": "AER Product Reference Data",
      "url": "https://www.aer.gov.au/energy-product-reference-data"
    },
    {
      "name": "EIA",
      "url": "https://www.eia.gov/opendata/documentation.php"
    },
    {
      "name": "World Bank Indicators API",
      "url": "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation"
    }
  ],
  "freshness": {
    "status": "fresh",
    "updatedAt": "2026-02-28T10:00:00Z"
  },
  "methodologyVersion": "energy-comparison-v1"
}
```
