# Australian Situation Dashboard

Monorepo for AUS Dash ingestion, API, and dashboard apps.

## Scope

- Housing + energy metrics
- Source metadata + freshness metadata
- Internal API-first architecture (`apps/api`) used by the dashboard (`apps/web`)

## Quickstart

```bash
bun install
```

Run everything:

```bash
bun run dev:all
```

Bring up infra + migrate + backfill + build + run:

```bash
bun run up:all
```

Run tests:

```bash
bun run test:all
bun run test:all:e2e
```

Client validation (web tests + build + Playwright):

```bash
bun run test:client
```

Reuse an existing web server for Playwright:

```bash
bun run test:client:e2e:existing
```

## API Endpoints (Current)

All routes are `GET` and mounted under `/api`.

| Endpoint | Query / Params | Data Read | Notes |
| --- | --- | --- | --- |
| `/api/docs` | None | Generated ReDoc HTML | Points to `/api/openapi.json` |
| `/api/openapi.json` | None | Generated OpenAPI document | Excludes `/api/docs` from spec |
| `/api/health` | None | Static payload | `{ status, service }` |
| `/api/housing/overview` | `region` (default `AU`) | Latest values for `hvi.value.index`, `lending.oo.count`, `lending.oo.value_aud`, `lending.investor.count`, `lending.investor.value_aud`, `lending.avg_loan_size_aud`, `rates.oo.variable_pct`, `rates.oo.fixed_pct` | Returns `requiredSeriesIds`, `missingSeriesIds`, `metrics`, `updatedAt` |
| `/api/series/:id` | `id` path param; `region` (default `AU`), `from`, `to` | Time-series points (`date`, `value`) for requested `seriesId` | Returns 400 for unsupported region, 404 for unknown `seriesId` |
| `/api/energy/live-wholesale` | `region` (default `AU`), `window` (`5m`/`1h`/`24h`) | `energy.wholesale.rrp.au_weighted_aud_mwh` (AU) or `energy.wholesale.rrp.region_aud_mwh` (state, with AU fallback) | Returns latest + rollups + freshness |
| `/api/energy/retail-average` | `region` (default `AU`), `customer_type` | `energy.retail.offer.annual_bill_aud.mean` + `.median` (region, then AU fallback) | `customer_type` is passed through as `customerType` |
| `/api/energy/overview` | `region` (default `AU`) | Combines wholesale + retail + `energy.benchmark.dmo.annual_bill_aud` + `energy.cpi.electricity.index` | Panel payload for dashboard cards |
| `/api/energy/household-estimate` | `region` (default `AU`), `usage_profile` | Derived from retail average (`annualBillAudMean / 12`) | Requires `ENABLE_ENERGY_HOUSEHOLD_ESTIMATE=true` |
| `/api/metadata/freshness` | None | Freshness for `energy.wholesale.rrp.au_weighted_aud_mwh`, `energy.retail.offer.annual_bill_aud.mean`, `energy.cpi.electricity.index` | Returns lag + freshness status per series |
| `/api/metadata/sources` | None | Source catalog (`sourceId`, `domain`, `name`, `url`, `expectedCadence`) | Backend-dependent source table/list |
| `/api/v1/energy/compare/retail` | `country` (default `AU`), `peers`, `basis` (`nominal`/`ppp`), `tax_status`, `consumption_band` | Latest country rows from `energy.retail.price.country.usd_kwh_nominal` or `.usd_kwh_ppp` | Returns ranked rows + peer comparisons |
| `/api/v1/energy/compare/wholesale` | `country` (default `AU`), `peers` | Latest country rows from `energy.wholesale.spot.country.usd_mwh` | Returns ranked rows + AU percentile |
| `/api/v1/metadata/methodology` | `metric` | Static in-memory methodology metadata | Supported metrics: `energy.compare.retail`, `energy.compare.wholesale` |

## Data Backends

API backend is selected via `AUS_DASH_DATA_BACKEND`:

- `store` (default): reads local JSON live store (`AUS_DASH_STORE_PATH` or `data/live-store.json` from process cwd).
- `postgres`: reads `observations` and `sources` tables from Postgres (`DATABASE_URL` required).

Ingest backend is selected via `AUS_DASH_INGEST_BACKEND` with the same values (`store` or `postgres`).

## Repo Layout

```text
apps/
  web/       Next.js dashboard
  api/       Hono API
  ingest/    ingestion jobs + source clients
packages/
  ui/            shared UI components
  data-contract/ canonical series + region contracts
  db/            Drizzle schema/config
  shared/        shared helpers/types + live-store utilities
tests/
  e2e/       Playwright tests
```

## Contributing

- Source-of-truth contributor workflow is in `AGENTS.md`.
- If you add/modify endpoints, update the API table in this `README.md` in the same PR.

## Environment Notes

- `NEXT_PUBLIC_API_BASE_URL` (web): defaults to `http://localhost:3001`
- `ENABLE_ENERGY_HOUSEHOLD_ESTIMATE=true` (api): enables `/api/energy/household-estimate`
- `AUS_DASH_STORE_PATH=/abs/path/to/live-store.json`: shared JSON store override

## Planning Docs

- `docs/prd-electricity-prices-aus-vs-global-v1.md`
- `docs/implementation-roadmap-electricity-prices-aus-global.md`
- `docs/tdd-plan-electricity-prices-aus-global-v1.md`
- `docs/kpi-definitions-electricity-prices-aus-global-v1.md`
- `docs/api-energy-comparison-v1.md`
- `research_electricity_prices_api_scope/research_report.md`
