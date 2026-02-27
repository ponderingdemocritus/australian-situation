const SUPPORTED_REGIONS = new Set([
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
]);

const KNOWN_SERIES_IDS = new Set([
  "hvi.value.index",
  "lending.oo.count",
  "lending.oo.value_aud",
  "lending.investor.count",
  "lending.investor.value_aud",
  "lending.avg_loan_size_aud",
  "rates.oo.variable_pct",
  "rates.oo.fixed_pct",
  "rates.investor.variable_pct",
  "rent.value.index",
  "refinance.value_aud"
]);

type Observation = {
  seriesId: string;
  region: string;
  date: string;
  value: number;
};

const OBSERVATIONS: Observation[] = [
  { seriesId: "hvi.value.index", region: "AU", date: "2025-10-31", value: 168.1 },
  { seriesId: "hvi.value.index", region: "AU", date: "2025-11-30", value: 168.9 },
  { seriesId: "hvi.value.index", region: "AU", date: "2025-12-31", value: 169.4 },
  { seriesId: "hvi.value.index", region: "VIC", date: "2025-12-31", value: 172.4 },
  { seriesId: "rates.oo.variable_pct", region: "AU", date: "2025-12-31", value: 6.08 }
];

export type SeriesPoint = {
  date: string;
  value: number;
};

export type SeriesResponse = {
  seriesId: string;
  region: string;
  points: SeriesPoint[];
};

export type SeriesQueryErrorCode = "UNSUPPORTED_REGION" | "UNKNOWN_SERIES_ID";

export class SeriesQueryError extends Error {
  code: SeriesQueryErrorCode;
  status: number;

  constructor(code: SeriesQueryErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type QueryInput = {
  seriesId: string;
  region: string;
  from?: string;
  to?: string;
};

export function querySeries(input: QueryInput): SeriesResponse {
  if (!SUPPORTED_REGIONS.has(input.region)) {
    throw new SeriesQueryError(
      "UNSUPPORTED_REGION",
      `Unsupported region: ${input.region}`,
      400
    );
  }

  if (!KNOWN_SERIES_IDS.has(input.seriesId)) {
    throw new SeriesQueryError(
      "UNKNOWN_SERIES_ID",
      `Unknown series id: ${input.seriesId}`,
      404
    );
  }

  const points = OBSERVATIONS
    .filter(
      (observation) =>
        observation.seriesId === input.seriesId &&
        observation.region === input.region &&
        (!input.from || observation.date >= input.from) &&
        (!input.to || observation.date <= input.to)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((observation) => ({
      date: observation.date,
      value: observation.value
    }));

  return {
    seriesId: input.seriesId,
    region: input.region,
    points
  };
}
