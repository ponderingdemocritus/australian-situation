// Legacy prototype fixture retained for regression/reference use in tests only.

const REQUIRED_SERIES_IDS = [
  "hvi.value.index",
  "lending.oo.count",
  "lending.oo.value_aud",
  "lending.investor.count",
  "lending.investor.value_aud",
  "lending.avg_loan_size_aud",
  "rates.oo.variable_pct",
  "rates.oo.fixed_pct"
] as const;

type RequiredSeriesId = (typeof REQUIRED_SERIES_IDS)[number];

type Observation = {
  seriesId: RequiredSeriesId;
  region: string;
  date: string;
  value: number;
};

type OverviewMetric = {
  seriesId: RequiredSeriesId;
  date: string;
  value: number;
};

export type LegacyHousingOverviewFixture = {
  region: string;
  requiredSeriesIds: readonly RequiredSeriesId[];
  missingSeriesIds: RequiredSeriesId[];
  metrics: OverviewMetric[];
  updatedAt: string | null;
};

const OBSERVATIONS: Observation[] = [
  { seriesId: "hvi.value.index", region: "AU", date: "2025-11-30", value: 168.9 },
  { seriesId: "hvi.value.index", region: "AU", date: "2025-12-31", value: 169.4 },
  { seriesId: "lending.oo.count", region: "AU", date: "2025-12-31", value: 42580 },
  { seriesId: "lending.oo.value_aud", region: "AU", date: "2025-12-31", value: 27300000000 },
  { seriesId: "lending.investor.count", region: "AU", date: "2025-12-31", value: 16950 },
  { seriesId: "lending.investor.value_aud", region: "AU", date: "2025-12-31", value: 12150000000 },
  { seriesId: "lending.avg_loan_size_aud", region: "AU", date: "2025-12-31", value: 736000 },
  { seriesId: "rates.oo.variable_pct", region: "AU", date: "2025-12-31", value: 6.08 },
  { seriesId: "rates.oo.fixed_pct", region: "AU", date: "2025-12-31", value: 5.79 },

  { seriesId: "hvi.value.index", region: "VIC", date: "2025-12-31", value: 172.4 },
  { seriesId: "lending.oo.count", region: "VIC", date: "2025-12-31", value: 10120 },
  { seriesId: "lending.oo.value_aud", region: "VIC", date: "2025-12-31", value: 7230000000 },
  { seriesId: "lending.investor.count", region: "VIC", date: "2025-12-31", value: 4180 },
  { seriesId: "lending.investor.value_aud", region: "VIC", date: "2025-12-31", value: 3150000000 },
  { seriesId: "lending.avg_loan_size_aud", region: "VIC", date: "2025-12-31", value: 756000 },
  { seriesId: "rates.oo.variable_pct", region: "VIC", date: "2025-12-31", value: 6.16 }
];

function getLatestObservation(
  region: string,
  seriesId: RequiredSeriesId
): Observation | null {
  const matches = OBSERVATIONS
    .filter((observation) => observation.region === region && observation.seriesId === seriesId)
    .sort((a, b) => b.date.localeCompare(a.date));

  return matches[0] ?? null;
}

export function getLegacyHousingOverviewFixture(
  region: string
): LegacyHousingOverviewFixture {
  const metrics: OverviewMetric[] = [];
  const missingSeriesIds: RequiredSeriesId[] = [];

  for (const seriesId of REQUIRED_SERIES_IDS) {
    const latest = getLatestObservation(region, seriesId);

    if (!latest) {
      missingSeriesIds.push(seriesId);
      continue;
    }

    metrics.push({
      seriesId: latest.seriesId,
      date: latest.date,
      value: latest.value
    });
  }

  const updatedAt =
    metrics
      .map((metric) => metric.date)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    region,
    requiredSeriesIds: REQUIRED_SERIES_IDS,
    missingSeriesIds,
    metrics,
    updatedAt
  };
}
