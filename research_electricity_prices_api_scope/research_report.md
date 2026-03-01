# Electricity Prices Data Scope (Australia vs Global)

Date prepared: 28 February 2026

## 1) Objective
Build a reliable data pipeline and comparison layer that shows how Australia compares with other countries on electricity prices, with clear separation between:
- Wholesale market prices (high-frequency, volatile, market-level)
- End-user retail prices (lower frequency, tariff/bill-level)

## 2) What we learned about available APIs

### A) Australia sources

1. AEMO NEM data and NEMWeb (official, wholesale)
- Public market data is available via NEMWeb/current/archive datasets.
- NEMWeb indicates current reports, archive reports (up to 13 months), and data model archive for older data.
- Suitable for NEM region-level wholesale price, demand, dispatch-derived metrics.
- Access pattern is mostly files/feeds rather than a single clean public REST endpoint for all needs.

2. AEMO WEM Dispatch APIs (official, WA wholesale)
- WEM Dispatch APIs exist (v1/v2), with production URLs and certificate-based access.
- Access requires market participant setup and DigiCert certificate for most APIM-hosted WEM APIs.
- Good data quality and detail, but onboarding and credentials are heavier than open datasets.

3. AER Energy Product Reference Data APIs (official, retail plans)
- Public APIs (no accreditation required) for generic plan data used by Energy Made Easy and Victorian Energy Compare.
- Includes plan names, charges, fees, discounts, eligibility, and location availability.
- Important constraints: current plans only (no historical), and known limitations around plan retrieval behavior (e.g., per retailer behavior noted by AER FAQs).
- Coverage excludes jurisdictions not in that framework (WA and NT handled by separate regulators).

4. ABS APIs (official macro price indices)
- Indicator API is live, requires API key, and includes CPI dataflow access.
- Useful for inflation-adjusted trend context and sanity checks, but not direct tariff microdata.

5. OpenElectricity API (third-party, AU-focused accelerator)
- API exposes NEM+WEM data with clean REST endpoints and API key auth.
- Explicitly includes market data metrics such as price and demand.
- Strong developer UX for fast MVP; should be treated as convenience layer over official sources.

### B) Global sources

1. EIA API v2 (official, US)
- Free API with key registration.
- Electricity retail-sales endpoints include price/sales/revenue and facets by state/sector and time frequency.
- Good for deep US benchmarking and a robust non-EU anchor.

2. ENTSO-E Transparency Platform API (official, Europe wholesale)
- API access requires a security token.
- Token onboarding requires registration + explicit API access request.
- Core endpoint style includes `securityToken` query parameter in legacy guide material.
- High-value for day-ahead/market-level European comparison.

3. Eurostat APIs + dataset `nrg_pc_204` (official, Europe retail)
- Free API access, with regular refresh cadence and clear REST query patterns.
- `nrg_pc_204` metadata provides strong methodological detail: household/non-household bands, national-currency per kWh, tax-inclusion levels, and semestrial dissemination.
- Excellent for standardized retail consumer benchmarking in Europe.

4. OECD Data Explorer API (official, cross-country statistical)
- OECD provides free SDMX API with rate limiting.
- Good backbone for macro-economic context and country metadata pipelines; electricity-price-specific extraction needs dataset-level validation during implementation.

5. IEA Energy Prices (global breadth, commercial/subscription)
- Broadest structured global coverage (148 countries) for end-use energy prices including electricity.
- Update cadence includes annual global updates and quarterly OECD detail.
- Best for high-quality global retail comparisons if licensing budget exists.

6. GlobalPetrolPrices API (commercial, broad country coverage)
- Commercial XML/API offering with electricity prices for many countries and consumption-band methodology.
- Useful if rapid broad-country rollout is required and budget is available.

### C) Normalization/auxiliary APIs

1. World Bank Indicators API (official)
- Free API access without keys.
- Provides PPP conversion and official exchange-rate indicators useful for cross-country normalization.

## 3) Recommended API stack by phase

### Phase 1 (MVP, 4-6 weeks)
Goal: Ship Australia vs major comparators with defensible methodology.

- Australia wholesale:
  - AEMO NEMWeb public data (primary)
  - Optional OpenElectricity API (accelerator cache/adapter)
- Australia retail:
  - AER PRD APIs (current plan structure and available offer context)
  - AER DMO published tables for reference baseline (non-API ingest from published files)
- Global wholesale:
  - ENTSO-E (EU)
  - EIA (US)
- Global retail:
  - Eurostat `nrg_pc_204` (EU household/non-household)
- Normalization:
  - World Bank PPP + FX indicators

Output: AU vs EU vs US comparison dashboard with explicit metric labeling.

### Phase 2 (6-10 weeks)
Goal: Expand country coverage and improve representativeness.

- Add one commercial global retail source:
  - Preferred: IEA Energy Prices (if licensed)
  - Alternative: GlobalPetrolPrices API
- Add WA-specific wholesale detail via AEMO WEM APIs if participant access is feasible.
- Add historical snapshots for AU retail by archiving AER plan API responses daily.

### Phase 3 (ongoing)
Goal: Production hardening and policy-grade comparability.

- Methodology governance (versioned assumptions, reproducible transformations)
- Robust data quality checks (missing intervals, outlier spikes, currency anomalies)
- Benchmark set expansion (Japan, Korea, NZ, selected emerging markets)

## 4) Core comparison model (must be explicit in product)

Create separate KPI families:

1. `wholesale_spot_price_usd_mwh`
- Region-level market prices (e.g., NEM regions, selected EU zones, US balancing/retail proxies where needed).

2. `retail_household_price_local_kwh`
- End-user price with source-defined methodology.

3. `retail_household_price_usd_kwh` and `retail_household_price_ppp_kwh`
- Nominal FX-converted and PPP-adjusted views.

4. `tax_inclusion_flag`
- Track whether series includes taxes/levies; do not mix in same chart without explicit labeling.

5. `consumption_band`
- Standardize to nearest common household band (or convert where source supports multiple consumption points).

## 5) Technical data contract (minimum)

Each record should include:
- `source_system` (AEMO, AER, Eurostat, EIA, ENTSOE, etc.)
- `series_type` (`wholesale` | `retail` | `index`)
- `country_code`, `region_code`
- `market` (`NEM`, `WEM`, `EU`, `US`...)
- `metric_name`
- `value`
- `unit` (`$/MWh`, `c/kWh`, `USD/kWh`, etc.)
- `currency`
- `tax_status`
- `consumption_band`
- `interval_start_utc`, `interval_end_utc`
- `published_at`, `ingested_at`
- `methodology_version`

## 6) Key risks and mitigations

1. Apples-to-oranges comparisons
- Risk: Mixing wholesale and retail values or mismatched tax/consumption assumptions.
- Mitigation: strict metric families + mandatory taxonomy fields.

2. Australia retail historical gaps
- Risk: AER PRD is current-plan focused.
- Mitigation: build internal daily snapshot archive from day 1.

3. Access friction for some official APIs
- Risk: ENTSO-E token workflow, AEMO WEM certificates.
- Mitigation: plan onboarding lead time; run interim ingestion via publicly available datasets where possible.

4. Licensing constraints for global breadth
- Risk: best global datasets may be commercial.
- Mitigation: stage architecture so paid source can be added without refactor.

## 7) Practical scope recommendation

Recommended baseline scope for immediate execution:
- Deliver AU vs EU vs US comparison first, not "all countries" in V1.
- Use official/public sources first (AEMO, AER, EIA, ENTSO-E, Eurostat, World Bank).
- Keep commercial global dataset as optional phase-gate decision based on budget.
- Build methodology transparency into UI from day 1 (tax inclusion, band, cadence labels).

Inference note:
- The staged stack recommendation is an implementation inference based on source availability, access friction, and comparability constraints; it is not stated verbatim by any single source.

## Sources
- AEMO Data (NEM): https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem
- AEMO NEMWeb market data page: https://visualisations.aemo.com.au/aemo/nemweb/index.html
- AEMO WEM API access: https://www.aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/procedures-policies-and-guides/guides/wems-api-access
- AEMO WEM Dispatch API overview: https://developer-portal-ppd.aemo.com.au/WEM-Dispatch-API-%20Overview
- AER Energy Product Reference Data: https://www.aer.gov.au/energy-product-reference-data
- Energy Made Easy: https://www.energymadeeasy.gov.au/
- ABS Indicator API: https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/indicator-api
- OpenElectricity API overview: https://docs.openelectricity.org.au/api-reference
- OpenElectricity market endpoint docs: https://docs.openelectricity.org.au/api-reference/market/get-network-data
- EIA API documentation: https://www.eia.gov/opendata/documentation.php
- EIA retail-sales browser: https://www.eia.gov/opendata/index.php/browser/electricity/retail-sales
- ENTSO-E token instructions: https://transparencyplatform.zendesk.com/hc/en-us/articles/12845911031188-How-to-get-security-token
- ENTSO-E backup API guide snapshot: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide_prod_backup_06_11_2024.html
- Eurostat API intro: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction
- Eurostat API statistics guide: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-detailed-guidelines/api-statistics
- Eurostat getting started: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api
- Eurostat electricity price metadata (`nrg_pc_204`): https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm
- OECD API explainer: https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html
- IEA Energy Prices product: https://www.iea.org/data-and-statistics/data-product/energy-prices
- IEA End-Use Prices Data Explorer: https://www.iea.org/data-and-statistics/data-tools/end-use-prices-data-explorer
- GlobalPetrolPrices data API overview: https://www.globalpetrolprices.com/data_access.php
- World Bank Indicators API: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
- World Bank PPP indicator metadata: https://databank.worldbank.org/metadataglossary/world-development-indicators/series/PA.NUS.PPP
- World Bank official FX indicator metadata: https://databank.worldbank.org/metadataglossary/world-development-indicators/series/PA.NUS.FCRF
