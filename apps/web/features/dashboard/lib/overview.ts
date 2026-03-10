export const REGIONS = ["AU", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"] as const;

export type RegionCode = (typeof REGIONS)[number];

export const STATE_REGIONS = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"] as const;

export type StateRegionCode = (typeof STATE_REGIONS)[number];

export const DEFAULT_REGION: RegionCode = "AU";

export type SourceRef = {
  sourceId: string;
  name: string;
  url: string;
};

export type EnergySourceMixRow = {
  sourceKey: string;
  label: string;
  sharePct: number;
};

export type EnergySourceMixView = {
  viewId: "annual_official" | "operational_nem_wem";
  title: string;
  coverageLabel: string;
  updatedAt: string;
  sourceRefs: SourceRef[];
  rows: EnergySourceMixRow[];
};

export type EnergyOverviewResponse = {
  region: string;
  methodSummary: string | null;
  sourceRefs: SourceRef[];
  sourceMixViews: EnergySourceMixView[];
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

export type MetadataSource = {
  sourceId: string;
  domain: "housing" | "energy" | "macro";
  name: string;
  url: string;
  expectedCadence: string;
};

export type MetadataSourcesResponse = {
  generatedAt: string;
  sources: MetadataSource[];
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

function parseSourceRefs(value: unknown): SourceRef[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const sourceRefs: SourceRef[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    if (
      typeof item.sourceId !== "string" ||
      typeof item.name !== "string" ||
      typeof item.url !== "string"
    ) {
      return null;
    }

    sourceRefs.push({
      sourceId: item.sourceId,
      name: item.name,
      url: item.url
    });
  }

  return sourceRefs;
}

function parseSourceMixRows(value: unknown): EnergySourceMixRow[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const rows: EnergySourceMixRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    if (
      typeof item.sourceKey !== "string" ||
      typeof item.label !== "string" ||
      !isFiniteNumber(item.sharePct)
    ) {
      return null;
    }

    rows.push({
      sourceKey: item.sourceKey,
      label: item.label,
      sharePct: item.sharePct
    });
  }

  return rows;
}

function parseSourceMixViews(value: unknown): EnergySourceMixView[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const views: EnergySourceMixView[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const sourceRefs = parseSourceRefs(item.sourceRefs);
    const rows = parseSourceMixRows(item.rows);
    if (
      sourceRefs === null ||
      rows === null ||
      (item.viewId !== "annual_official" && item.viewId !== "operational_nem_wem") ||
      typeof item.title !== "string" ||
      typeof item.coverageLabel !== "string" ||
      typeof item.updatedAt !== "string"
    ) {
      return null;
    }

    views.push({
      viewId: item.viewId,
      title: item.title,
      coverageLabel: item.coverageLabel,
      updatedAt: item.updatedAt,
      sourceRefs,
      rows
    });
  }

  return views;
}

export function parseEnergyOverviewResponse(payload: unknown): EnergyOverviewResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { region, panels, freshness, methodSummary } = payload;
  const sourceRefs = parseSourceRefs(payload.sourceRefs);
  const sourceMixViews = parseSourceMixViews(payload.sourceMixViews);
  if (typeof region !== "string" || !isRecord(panels) || !isRecord(freshness)) {
    return null;
  }
  if (sourceRefs === null || sourceMixViews === null) {
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
    methodSummary: typeof methodSummary === "string" ? methodSummary : null,
    sourceRefs,
    sourceMixViews,
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

export function parseMetadataSourcesResponse(
  payload: unknown
): MetadataSourcesResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.generatedAt !== "string" || !Array.isArray(payload.sources)) {
    return null;
  }

  const sources: MetadataSource[] = [];
  for (const item of payload.sources) {
    if (!isRecord(item)) {
      return null;
    }
    if (
      typeof item.sourceId !== "string" ||
      (item.domain !== "housing" && item.domain !== "energy" && item.domain !== "macro") ||
      typeof item.name !== "string" ||
      typeof item.url !== "string" ||
      typeof item.expectedCadence !== "string"
    ) {
      return null;
    }

    sources.push({
      sourceId: item.sourceId,
      domain: item.domain,
      name: item.name,
      url: item.url,
      expectedCadence: item.expectedCadence
    });
  }

  return {
    generatedAt: payload.generatedAt,
    sources
  };
}
