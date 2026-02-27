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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
