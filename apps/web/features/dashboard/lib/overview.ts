export const REGIONS = ["AU", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"] as const;

export type RegionCode = (typeof REGIONS)[number];

export const DEFAULT_REGION: RegionCode = "AU";

export type EnergyOverviewResponse = {
  region: string;
  panels: {
    liveWholesale: {
      valueAudMwh: number;
      valueCKwh: number;
    };
    retailAverage: {
      annualBillAudMean: number;
      annualBillAudMedian: number;
    };
    benchmark: {
      dmoAnnualBillAud: number;
    };
    cpiElectricity: {
      indexValue: number;
      period: string;
    };
  };
  freshness: {
    updatedAt: string;
    status: "fresh" | "stale" | "degraded";
  };
};

export type HousingOverviewResponse = {
  region: string;
  metrics: Array<{
    seriesId: string;
    date: string;
    value: number;
  }>;
  missingSeriesIds: string[];
  updatedAt: string | null;
};

export type ComparisonBasis = "nominal" | "ppp";

export type RetailComparisonRow = {
  countryCode: string;
  value: number;
  rank: number;
};

export type RetailComparisonResponse = {
  country: string;
  peers: string[];
  basis: ComparisonBasis;
  taxStatus: string;
  consumptionBand: string;
  auRank: number | null;
  methodologyVersion: string;
  rows: RetailComparisonRow[];
};

export type WholesaleComparisonRow = {
  countryCode: string;
  value: number;
  rank: number;
};

export type WholesaleComparisonResponse = {
  country: string;
  peers: string[];
  auRank: number | null;
  auPercentile: number | null;
  methodologyVersion: string;
  rows: WholesaleComparisonRow[];
};

export type MethodologyMetadataResponse = {
  metric: string;
  methodologyVersion: string;
  description: string;
  requiredDimensions: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseComparisonRows(value: unknown): Array<{
  countryCode: string;
  value: number;
  rank: number;
}> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows: Array<{
    countryCode: string;
    value: number;
    rank: number;
  }> = [];

  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    if (
      typeof item.countryCode !== "string" ||
      !isFiniteNumber(item.value) ||
      !isFiniteNumber(item.rank)
    ) {
      return null;
    }

    rows.push({
      countryCode: item.countryCode,
      value: item.value,
      rank: item.rank
    });
  }

  return rows;
}

export function parseEnergyOverviewResponse(payload: unknown): EnergyOverviewResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { region, panels, freshness } = payload;
  if (typeof region !== "string" || !isRecord(panels) || !isRecord(freshness)) {
    return null;
  }

  const liveWholesale = panels.liveWholesale;
  const retailAverage = panels.retailAverage;
  const benchmark = panels.benchmark;
  const cpiElectricity = panels.cpiElectricity;

  if (
    !isRecord(liveWholesale) ||
    !isRecord(retailAverage) ||
    !isRecord(benchmark) ||
    !isRecord(cpiElectricity)
  ) {
    return null;
  }

  if (
    !isFiniteNumber(liveWholesale.valueAudMwh) ||
    !isFiniteNumber(liveWholesale.valueCKwh) ||
    !isFiniteNumber(retailAverage.annualBillAudMean) ||
    !isFiniteNumber(retailAverage.annualBillAudMedian) ||
    !isFiniteNumber(benchmark.dmoAnnualBillAud) ||
    !isFiniteNumber(cpiElectricity.indexValue) ||
    typeof cpiElectricity.period !== "string"
  ) {
    return null;
  }

  if (
    typeof freshness.updatedAt !== "string" ||
    (freshness.status !== "fresh" &&
      freshness.status !== "stale" &&
      freshness.status !== "degraded")
  ) {
    return null;
  }

  return {
    region,
    panels: {
      liveWholesale: {
        valueAudMwh: liveWholesale.valueAudMwh,
        valueCKwh: liveWholesale.valueCKwh
      },
      retailAverage: {
        annualBillAudMean: retailAverage.annualBillAudMean,
        annualBillAudMedian: retailAverage.annualBillAudMedian
      },
      benchmark: {
        dmoAnnualBillAud: benchmark.dmoAnnualBillAud
      },
      cpiElectricity: {
        indexValue: cpiElectricity.indexValue,
        period: cpiElectricity.period
      }
    },
    freshness: {
      updatedAt: freshness.updatedAt,
      status: freshness.status
    }
  };
}

export function parseHousingOverviewResponse(payload: unknown): HousingOverviewResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { region, metrics, missingSeriesIds, updatedAt } = payload;
  if (
    typeof region !== "string" ||
    !Array.isArray(metrics) ||
    !isStringArray(missingSeriesIds) ||
    (typeof updatedAt !== "string" && updatedAt !== null)
  ) {
    return null;
  }

  const parsedMetrics: HousingOverviewResponse["metrics"] = [];
  for (const metric of metrics) {
    if (!isRecord(metric)) {
      return null;
    }

    if (
      typeof metric.seriesId !== "string" ||
      typeof metric.date !== "string" ||
      !isFiniteNumber(metric.value)
    ) {
      return null;
    }

    parsedMetrics.push({
      seriesId: metric.seriesId,
      date: metric.date,
      value: metric.value
    });
  }

  return {
    region,
    metrics: parsedMetrics,
    missingSeriesIds,
    updatedAt
  };
}

export function parseRetailComparisonResponse(
  payload: unknown
): RetailComparisonResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    typeof payload.country !== "string" ||
    !isStringArray(payload.peers) ||
    (payload.basis !== "nominal" && payload.basis !== "ppp") ||
    typeof payload.taxStatus !== "string" ||
    typeof payload.consumptionBand !== "string" ||
    (payload.auRank !== null && !isFiniteNumber(payload.auRank)) ||
    typeof payload.methodologyVersion !== "string"
  ) {
    return null;
  }

  const rows = parseComparisonRows(payload.rows);
  if (!rows) {
    return null;
  }

  return {
    country: payload.country,
    peers: payload.peers,
    basis: payload.basis,
    taxStatus: payload.taxStatus,
    consumptionBand: payload.consumptionBand,
    auRank: payload.auRank,
    methodologyVersion: payload.methodologyVersion,
    rows
  };
}

export function parseWholesaleComparisonResponse(
  payload: unknown
): WholesaleComparisonResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    typeof payload.country !== "string" ||
    !isStringArray(payload.peers) ||
    (payload.auRank !== null && !isFiniteNumber(payload.auRank)) ||
    (payload.auPercentile !== null && !isFiniteNumber(payload.auPercentile)) ||
    typeof payload.methodologyVersion !== "string"
  ) {
    return null;
  }

  const rows = parseComparisonRows(payload.rows);
  if (!rows) {
    return null;
  }

  return {
    country: payload.country,
    peers: payload.peers,
    auRank: payload.auRank,
    auPercentile: payload.auPercentile,
    methodologyVersion: payload.methodologyVersion,
    rows
  };
}

export function parseMethodologyMetadataResponse(
  payload: unknown
): MethodologyMetadataResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    typeof payload.metric !== "string" ||
    typeof payload.methodologyVersion !== "string" ||
    typeof payload.description !== "string" ||
    !isStringArray(payload.requiredDimensions)
  ) {
    return null;
  }

  return {
    metric: payload.metric,
    methodologyVersion: payload.methodologyVersion,
    description: payload.description,
    requiredDimensions: payload.requiredDimensions
  };
}
