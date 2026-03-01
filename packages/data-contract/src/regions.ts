export const REGION_TYPES = ["country", "state", "capital_city"] as const;

export type RegionType = (typeof REGION_TYPES)[number];

export const COUNTRY_REGION_CODES = ["AU"] as const;

export const STATE_AND_TERRITORY_REGION_CODES = [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT"
] as const;

export const CAPITAL_CITY_REGION_CODES = [
  "SYD",
  "MEL",
  "BNE",
  "ADL",
  "PER",
  "HBA",
  "DRW",
  "CBR"
] as const;

export const NATIONAL_AND_STATE_REGION_CODES = [
  ...COUNTRY_REGION_CODES,
  ...STATE_AND_TERRITORY_REGION_CODES
] as const;

export const CORE_REGION_CODES = [
  "AU",
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
  "SYD",
  "MEL",
  "BNE",
  "ADL",
  "PER",
  "HBA",
  "DRW",
  "CBR"
] as const;
