export const REGION_TYPES = ["country", "state", "capital_city"] as const;

export type RegionType = (typeof REGION_TYPES)[number];

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
