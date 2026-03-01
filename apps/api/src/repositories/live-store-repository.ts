import { readLiveStoreSync, type LiveObservation } from "@aus-dash/shared";
import type { ComparableObservation } from "../domain/energy-comparison";
import {
  API_SUPPORTED_REGIONS,
  REQUIRED_HOUSING_OVERVIEW_SERIES_IDS
} from "../routes/api-domain-constants";
import { freshnessStatus, lagMinutes } from "./freshness";
import { SeriesRepositoryError } from "./series-repository-error";
import type {
  ComparisonResponse,
  EnergyLiveWholesaleResponse,
  EnergyOverviewResponse,
  EnergyRetailAverageResponse,
  EnergyWindow,
  GetEnergyRetailComparisonInput,
  GetEnergyWholesaleComparisonInput,
  GetSeriesInput,
  HousingOverviewResponse,
  MetadataFreshnessResponse,
  MetadataSourcesResponse,
  SeriesResponse
} from "./live-data-contract";

type RequiredHousingSeriesId = (typeof REQUIRED_HOUSING_OVERVIEW_SERIES_IDS)[number];

type QuerySeriesInput = GetSeriesInput & {
  storePath?: string;
};

type StoreRetailComparisonInput = GetEnergyRetailComparisonInput & {
  storePath?: string;
};

type StoreWholesaleComparisonInput = GetEnergyWholesaleComparisonInput & {
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

function listLatestCountryObservations(
  input: {
    seriesId: string;
    countries: string[];
    taxStatus?: string;
    consumptionBand?: string;
  },
  storePath?: string
): ComparableObservation[] {
  const countries = new Set(input.countries);
  const store = readLiveStoreSync(storePath);
  const latestByCountry = new Map<string, LiveObservation>();

  for (const observation of store.observations) {
    if (observation.seriesId !== input.seriesId) {
      continue;
    }
    if (!observation.countryCode || !countries.has(observation.countryCode)) {
      continue;
    }
    if (input.taxStatus && observation.taxStatus !== input.taxStatus) {
      continue;
    }
    if (input.consumptionBand && observation.consumptionBand !== input.consumptionBand) {
      continue;
    }

    const existing = latestByCountry.get(observation.countryCode);
    if (!existing || observation.date > existing.date) {
      latestByCountry.set(observation.countryCode, observation);
    }
  }

  return [...latestByCountry.values()].map((observation) => ({
    countryCode: observation.countryCode as string,
    date: observation.date,
    value: observation.value,
    methodologyVersion: observation.methodologyVersion ?? null
  }));
}

export function getSeriesFromStore(input: QuerySeriesInput): SeriesResponse {
  if (!API_SUPPORTED_REGIONS.has(input.region)) {
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

export function getHousingOverviewFromStore(
  region: string,
  storePath?: string
): HousingOverviewResponse {
  const metrics: Array<{
    seriesId: string;
    date: string;
    value: number;
  }> = [];
  const missingSeriesIds: RequiredHousingSeriesId[] = [];

  for (const seriesId of REQUIRED_HOUSING_OVERVIEW_SERIES_IDS) {
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
    requiredSeriesIds: REQUIRED_HOUSING_OVERVIEW_SERIES_IDS,
    missingSeriesIds,
    metrics,
    updatedAt
  };
}

export function getEnergyLiveWholesaleFromStore(
  region: string,
  window: EnergyWindow,
  storePath?: string
): EnergyLiveWholesaleResponse {
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

export function getEnergyRetailAverageFromStore(
  region: string,
  storePath?: string
): EnergyRetailAverageResponse {
  const regionCode = region;
  const mean =
    latestObservation("energy.retail.offer.annual_bill_aud.mean", regionCode, storePath) ??
    latestObservation("energy.retail.offer.annual_bill_aud.mean", "AU", storePath);
  const median =
    latestObservation("energy.retail.offer.annual_bill_aud.median", regionCode, storePath) ??
    latestObservation("energy.retail.offer.annual_bill_aud.median", "AU", storePath);
  const updatedAt = mean?.date ?? "1970-01-01";

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
      updatedAt,
      status: freshnessStatus("daily", lagMinutes(Date.now(), updatedAt))
    }
  };
}

export function getEnergyRetailComparisonFromStore(
  input: StoreRetailComparisonInput
): ComparisonResponse {
  const seriesId =
    input.basis === "ppp"
      ? "energy.retail.price.country.usd_kwh_ppp"
      : "energy.retail.price.country.usd_kwh_nominal";

  const countries = [input.country, ...input.peers];

  return {
    rows: listLatestCountryObservations(
      {
        seriesId,
        countries,
        taxStatus: input.taxStatus,
        consumptionBand: input.consumptionBand
      },
      input.storePath
    )
  };
}

export function getEnergyWholesaleComparisonFromStore(
  input: StoreWholesaleComparisonInput
): ComparisonResponse {
  const countries = [input.country, ...input.peers];
  return {
    rows: listLatestCountryObservations(
      {
        seriesId: "energy.wholesale.spot.country.usd_mwh",
        countries
      },
      input.storePath
    )
  };
}

export function getEnergyOverviewFromStore(
  region: string,
  storePath?: string
): EnergyOverviewResponse {
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

export function getMetadataFreshnessFromStore(
  storePath?: string
): MetadataFreshnessResponse {
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

export function getMetadataSourcesFromStore(storePath?: string): MetadataSourcesResponse {
  const store = readLiveStoreSync(storePath);
  return {
    generatedAt: new Date().toISOString(),
    sources: store.sources
  };
}
