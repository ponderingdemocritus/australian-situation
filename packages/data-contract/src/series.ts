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
