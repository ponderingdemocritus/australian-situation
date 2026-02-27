import { readLiveStoreSync, type LiveObservation } from "@aus-dash/shared";
import { SeriesRepositoryError } from "./series-repository-error";

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

const REQUIRED_HOUSING_SERIES_IDS = [
  "hvi.value.index",
  "lending.oo.count",
  "lending.oo.value_aud",
  "lending.investor.count",
  "lending.investor.value_aud",
  "lending.avg_loan_size_aud",
  "rates.oo.variable_pct",
  "rates.oo.fixed_pct"
] as const;

type RequiredHousingSeriesId = (typeof REQUIRED_HOUSING_SERIES_IDS)[number];

type Cadence = "5m" | "daily" | "monthly" | "quarterly";

type FreshnessStatus = "fresh" | "stale" | "degraded";

type SeriesPoint = {
  date: string;
  value: number;
};

type QuerySeriesInput = {
  seriesId: string;
  region: string;
  from?: string;
  to?: string;
  storePath?: string;
};

function sortByDateDesc<T extends { date: string }>(values: T[]): T[] {
  return [...values].sort((a, b) => b.date.localeCompare(a.date));
}

function latestObservation(
  seriesId: string,
  regionCode: string,
  storePath?: string
): LiveObservation | null {
  const store = readLiveStoreSync(storePath);
  const match = sortByDateDesc(
    store.observations.filter(
      (observation) =>
        observation.seriesId === seriesId && observation.regionCode === regionCode
    )
  )[0];
  return match ?? null;
}

function listObservations(
  seriesId: string,
  regionCode: string,
  storePath?: string
): LiveObservation[] {
  const store = readLiveStoreSync(storePath);
  return store.observations
    .filter(
      (observation) =>
        observation.seriesId === seriesId && observation.regionCode === regionCode
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function toTimestamp(date: string): number | null {
  const parsedDirect = Date.parse(date);
  if (!Number.isNaN(parsedDirect)) {
    return parsedDirect;
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(date);
  if (!quarterMatch) {
    return null;
  }

  const year = Number(quarterMatch[1]);
  const quarter = Number(quarterMatch[2]);
  const monthEnd = quarter * 3;
  return Date.parse(`${year}-${String(monthEnd).padStart(2, "0")}-01T00:00:00Z`);
}

function lagMinutes(nowMs: number, date: string): number {
  const ts = toTimestamp(date);
  if (ts === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((nowMs - ts) / 60000));
}

function freshnessStatus(
  cadence: Cadence,
  lagMins: number
): FreshnessStatus {
  const thresholdMinutes =
    cadence === "5m"
      ? 20
      : cadence === "daily"
        ? 48 * 60
        : cadence === "monthly"
          ? 72 * 60
          : 7 * 24 * 60;

  return lagMins > thresholdMinutes ? "stale" : "fresh";
}

export function getSeriesFromStore(input: QuerySeriesInput): {
  seriesId: string;
  region: string;
  points: SeriesPoint[];
} {
  if (!SUPPORTED_REGIONS.has(input.region)) {
    throw new SeriesRepositoryError(
      "UNSUPPORTED_REGION",
      `Unsupported region: ${input.region}`,
      400
    );
  }

  const store = readLiveStoreSync(input.storePath);
  const seriesExists = store.observations.some(
    (observation) => observation.seriesId === input.seriesId
  );
  if (!seriesExists) {
    throw new SeriesRepositoryError(
      "UNKNOWN_SERIES_ID",
      `Unknown series id: ${input.seriesId}`,
      404
    );
  }

  const points = store.observations
    .filter(
      (observation) =>
        observation.seriesId === input.seriesId &&
        observation.regionCode === input.region &&
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

export function getHousingOverviewFromStore(region: string, storePath?: string) {
  const metrics: Array<{
    seriesId: string;
    date: string;
    value: number;
  }> = [];
  const missingSeriesIds: RequiredHousingSeriesId[] = [];

  for (const seriesId of REQUIRED_HOUSING_SERIES_IDS) {
    const latest = latestObservation(seriesId, region, storePath);
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
    requiredSeriesIds: REQUIRED_HOUSING_SERIES_IDS,
    missingSeriesIds,
    metrics,
    updatedAt
  };
}

export function getEnergyLiveWholesaleFromStore(
  region: string,
  window: "5m" | "1h" | "24h",
  storePath?: string
) {
  const seriesId =
    region === "AU"
      ? "energy.wholesale.rrp.au_weighted_aud_mwh"
      : "energy.wholesale.rrp.region_aud_mwh";
  const regionCode = region === "AU" ? "AU" : region;

  let points = listObservations(seriesId, regionCode, storePath);
  if (points.length === 0 && region !== "AU") {
    points = listObservations(
      "energy.wholesale.rrp.au_weighted_aud_mwh",
      "AU",
      storePath
    );
  }

  const values = points.map((point) => point.value);
  const latest = points[points.length - 1];
  const latestValue = latest?.value ?? 0;
  const latestDate = latest?.date ?? new Date().toISOString();

  const oneHourWindow = values.slice(-12);
  const oneHourAvgAudMwh =
    oneHourWindow.length > 0
      ? oneHourWindow.reduce((sum, value) => sum + value, 0) / oneHourWindow.length
      : 0;
  const twentyFourHourAvgAudMwh =
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;

  const nowMs = Date.now();
  const lag = lagMinutes(nowMs, latestDate);
  const status = freshnessStatus("5m", lag);

  return {
    region,
    window,
    isModeled: false,
    methodSummary:
      "Wholesale reference prices aggregated using demand-weighted AU rollup.",
    sourceRefs: [
      {
        name: "AEMO NEM Wholesale",
        url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem"
      }
    ],
    latest: {
      timestamp: latestDate,
      valueAudMwh: latestValue,
      valueCKwh: latestValue / 10
    },
    rollups: {
      oneHourAvgAudMwh,
      twentyFourHourAvgAudMwh
    },
    freshness: {
      updatedAt: latestDate,
      status
    }
  };
}

export function getEnergyRetailAverageFromStore(region: string, storePath?: string) {
  const regionCode = region;
  const mean =
    latestObservation("energy.retail.offer.annual_bill_aud.mean", regionCode, storePath) ??
    latestObservation("energy.retail.offer.annual_bill_aud.mean", "AU", storePath);
  const median =
    latestObservation("energy.retail.offer.annual_bill_aud.median", regionCode, storePath) ??
    latestObservation("energy.retail.offer.annual_bill_aud.median", "AU", storePath);

  return {
    region,
    customerType: "residential",
    isModeled: false,
    methodSummary: "Daily aggregation of retail plan prices for residential offers.",
    sourceRefs: [
      {
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body"
      }
    ],
    annualBillAudMean: mean?.value ?? 0,
    annualBillAudMedian: median?.value ?? 0,
    usageRateCKwhMean: 31.2,
    dailyChargeAudDayMean: 1.08,
    freshness: {
      updatedAt: mean?.date ?? new Date().toISOString(),
      status: freshnessStatus("daily", lagMinutes(Date.now(), mean?.date ?? "1970-01-01"))
    }
  };
}

export function getEnergyOverviewFromStore(region: string, storePath?: string) {
  const wholesale = getEnergyLiveWholesaleFromStore(region, "5m", storePath);
  const retail = getEnergyRetailAverageFromStore(region, storePath);
  const benchmark =
    latestObservation("energy.benchmark.dmo.annual_bill_aud", region, storePath) ??
    latestObservation("energy.benchmark.dmo.annual_bill_aud", "AU", storePath);
  const cpi =
    latestObservation("energy.cpi.electricity.index", region, storePath) ??
    latestObservation("energy.cpi.electricity.index", "AU", storePath);

  return {
    region,
    methodSummary:
      "Combines wholesale market signal, retail offer averages, annual benchmark, and CPI context.",
    sourceRefs: [
      {
        name: "AEMO NEM Wholesale",
        url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem"
      },
      {
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body"
      },
      {
        name: "ABS CPI",
        url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release"
      }
    ],
    panels: {
      liveWholesale: {
        valueAudMwh: wholesale.latest.valueAudMwh,
        valueCKwh: wholesale.latest.valueCKwh
      },
      retailAverage: {
        annualBillAudMean: retail.annualBillAudMean,
        annualBillAudMedian: retail.annualBillAudMedian
      },
      benchmark: {
        dmoAnnualBillAud: benchmark?.value ?? 0
      },
      cpiElectricity: {
        indexValue: cpi?.value ?? 0,
        period: cpi?.date ?? "unknown"
      }
    },
    freshness: wholesale.freshness
  };
}

export function getMetadataFreshnessFromStore(storePath?: string) {
  const nowMs = Date.now();
  const keySeries = [
    {
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      expectedCadence: "5m" as const
    },
    {
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "AU",
      expectedCadence: "daily" as const
    },
    {
      seriesId: "energy.cpi.electricity.index",
      regionCode: "AU",
      expectedCadence: "quarterly" as const
    }
  ];

  const series = keySeries.map((seriesMeta) => {
    const latest = latestObservation(
      seriesMeta.seriesId,
      seriesMeta.regionCode,
      storePath
    );
    const updatedAt = latest?.date ?? "1970-01-01";
    const lagMins = lagMinutes(nowMs, updatedAt);
    return {
      seriesId: seriesMeta.seriesId,
      regionCode: seriesMeta.regionCode,
      expectedCadence: seriesMeta.expectedCadence,
      updatedAt,
      lagMinutes: lagMins,
      freshnessStatus: freshnessStatus(seriesMeta.expectedCadence, lagMins)
    };
  });

  const staleSeriesCount = series.filter(
    (item) => item.freshnessStatus === "stale"
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    staleSeriesCount,
    series
  };
}

export function getMetadataSourcesFromStore(storePath?: string) {
  const store = readLiveStoreSync(storePath);
  return {
    generatedAt: new Date().toISOString(),
    sources: store.sources
  };
}
