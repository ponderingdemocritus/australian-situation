export const HOUSING_SERIES_IDS = [
  "hvi.value.index",
  "rent.value.index",
  "lending.oo.count",
  "lending.oo.value_aud",
  "lending.investor.count",
  "lending.investor.value_aud",
  "lending.avg_loan_size_aud",
  "rates.oo.variable_pct",
  "rates.oo.fixed_pct",
  "rates.investor.variable_pct",
  "refinance.value_aud"
] as const;

export type HousingSeriesId = (typeof HOUSING_SERIES_IDS)[number];

export const HOUSING_OVERVIEW_REQUIRED_SERIES_IDS = [
  "hvi.value.index",
  "lending.oo.count",
  "lending.oo.value_aud",
  "lending.investor.count",
  "lending.investor.value_aud",
  "lending.avg_loan_size_aud",
  "rates.oo.variable_pct",
  "rates.oo.fixed_pct"
] as const;

export type HousingOverviewRequiredSeriesId =
  (typeof HOUSING_OVERVIEW_REQUIRED_SERIES_IDS)[number];

export const ENERGY_WHOLESALE_SERIES_IDS = [
  "energy.wholesale.spot.au.aud_mwh",
  "energy.wholesale.spot.country.usd_mwh",
  "energy.wholesale.spread.au_vs_peer.pct",
  "energy.wholesale.rank.au.percentile"
] as const;

export type EnergyWholesaleSeriesId = (typeof ENERGY_WHOLESALE_SERIES_IDS)[number];

export const ENERGY_RETAIL_SERIES_IDS = [
  "energy.retail.price.country.local_kwh",
  "energy.retail.price.country.usd_kwh_nominal",
  "energy.retail.price.country.usd_kwh_ppp",
  "energy.retail.spread.au_vs_peer.nominal_pct",
  "energy.retail.spread.au_vs_peer.ppp_pct",
  "energy.retail.rank.au.nominal",
  "energy.retail.rank.au.ppp"
] as const;

export type EnergyRetailSeriesId = (typeof ENERGY_RETAIL_SERIES_IDS)[number];

export const PRICE_INDEX_SERIES_IDS = [
  "prices.major_goods.overall.index",
  "prices.major_goods.food.index",
  "prices.major_goods.household_supplies.index"
] as const;

export type PriceIndexSeriesId = (typeof PRICE_INDEX_SERIES_IDS)[number];

export const PRICE_INDEX_OVERVIEW_SERIES_IDS = [...PRICE_INDEX_SERIES_IDS] as const;

export type PriceIndexOverviewSeriesId =
  (typeof PRICE_INDEX_OVERVIEW_SERIES_IDS)[number];

export const AI_DEFLATION_SERIES_IDS = [
  "prices.au_made.all.index",
  "prices.au_made.ai_exposed.index",
  "prices.au_made.control.index",
  "prices.imported.matched_control.index",
  "prices.ai_deflation.spread.au_made_vs_control.index"
] as const;

export type AiDeflationSeriesId = (typeof AI_DEFLATION_SERIES_IDS)[number];

export const AI_DEFLATION_OVERVIEW_SERIES_IDS = [...AI_DEFLATION_SERIES_IDS] as const;

export type AiDeflationOverviewSeriesId =
  (typeof AI_DEFLATION_OVERVIEW_SERIES_IDS)[number];

export const TAX_STATUS_VALUES = ["incl_tax", "excl_tax", "mixed"] as const;

export type TaxStatus = (typeof TAX_STATUS_VALUES)[number];

export function isTaxStatus(value: string): value is TaxStatus {
  return TAX_STATUS_VALUES.includes(value as TaxStatus);
}

export const CONSUMPTION_BAND_VALUES = [
  "household_low",
  "household_mid",
  "household_high",
  "non_household_small"
] as const;

export type ConsumptionBand = (typeof CONSUMPTION_BAND_VALUES)[number];

export function isConsumptionBand(value: string): value is ConsumptionBand {
  return CONSUMPTION_BAND_VALUES.includes(value as ConsumptionBand);
}

export const ENERGY_WINDOW_VALUES = ["5m", "1h", "24h"] as const;

export type EnergyWindow = (typeof ENERGY_WINDOW_VALUES)[number];

export const ENERGY_RETAIL_COMPARISON_BASIS_VALUES = ["nominal", "ppp"] as const;

export type EnergyRetailComparisonBasis =
  (typeof ENERGY_RETAIL_COMPARISON_BASIS_VALUES)[number];
