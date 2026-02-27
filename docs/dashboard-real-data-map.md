# Dashboard Real Data Map

## Scope

This document maps `apps/web/features/dashboard/components/dashboard-shell.tsx` UI sections to their real API data sources and notes which stub patterns were removed.

## Data Mapping

| Dashboard Surface | Endpoint | Response Fields Used | Notes |
| --- | --- | --- | --- |
| Region selector + sync labels | `/api/energy/overview?region=<code>` and `/api/housing/overview?region=<code>` | `region` query param drives both calls; selected `region` rendered in labels | One selector controls both panels and map state |
| Energy overview rows | `/api/energy/overview` | `panels.liveWholesale.valueAudMwh`, `panels.retailAverage.annualBillAudMean`, `panels.retailAverage.annualBillAudMedian`, `panels.benchmark.dmoAnnualBillAud`, `panels.cpiElectricity.period`, `panels.cpiElectricity.indexValue`, `freshness.updatedAt`, `freshness.status` | Row values and status metadata now come from payload fields only |
| Housing overview rows | `/api/housing/overview` | `metrics[]` values for `hvi.value.index`, `lending.avg_loan_size_aud`, `rates.oo.variable_pct`, `lending.investor.count`; `updatedAt` | Missing values render `--`; as-of label from `updatedAt` |
| Data health block | `/api/energy/overview` + `/api/housing/overview` | `freshness.status`, `missingSeriesIds.length` | Replaces static "Sector Performance" mock block |
| Header stream count | `/api/energy/overview` + `/api/housing/overview` | Derived from loaded panel count and `metrics.length` | Replaces fixed stream counts |
| Map bottom status bar | `/api/energy/overview` + `/api/housing/overview` | `freshness.status`, `freshness.updatedAt`, `updatedAt`, `missingSeriesIds.length` | Replaces static city/node labels |
| Live feed panel | `/api/energy/overview` + `/api/housing/overview` | energy: `region`, `freshness.updatedAt`, `panels.liveWholesale.valueAudMwh`; housing: `region`, `updatedAt`, `metrics.length` | Replaces random synthetic log generator with deterministic API-driven events |

## Removed Stub Behavior

- Random log actions/entities and timer-based log generation.
- Hardcoded "Sector Performance" percentages.
- Hardcoded map bottom city labels and fixed "7 nodes active".
- Fixed stream-count fallback (`3`/`5`) unrelated to loaded data.
