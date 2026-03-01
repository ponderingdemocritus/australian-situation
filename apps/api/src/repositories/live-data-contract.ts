import type { ComparableObservation } from "../domain/energy-comparison";

export type EnergyWindow = "5m" | "1h" | "24h";
export type RetailComparisonBasis = "nominal" | "ppp";
export type Cadence = "5m" | "daily" | "monthly" | "quarterly";
export type FreshnessStatus = "fresh" | "stale" | "degraded";

export type SourceRef = {
  name: string;
  url: string;
};

export type Freshness = {
  updatedAt: string;
  status: FreshnessStatus;
};

export type HousingOverviewMetric = {
  seriesId: string;
  date: string;
  value: number;
};

export type HousingOverviewResponse = {
  region: string;
  requiredSeriesIds: readonly string[];
  missingSeriesIds: readonly string[];
  metrics: HousingOverviewMetric[];
  updatedAt: string | null;
};

export type SeriesPoint = {
  date: string;
  value: number;
};

export type SeriesResponse = {
  seriesId: string;
  region: string;
  points: SeriesPoint[];
};

export type EnergyLiveWholesaleResponse = {
  region: string;
  window: EnergyWindow;
  isModeled: boolean;
  methodSummary: string;
  sourceRefs: SourceRef[];
  latest: {
    timestamp: string;
    valueAudMwh: number;
    valueCKwh: number;
  };
  rollups: {
    oneHourAvgAudMwh: number;
    twentyFourHourAvgAudMwh: number;
  };
  freshness: Freshness;
};

export type EnergyRetailAverageResponse = {
  region: string;
  customerType: string;
  isModeled: boolean;
  methodSummary: string;
  sourceRefs: SourceRef[];
  annualBillAudMean: number;
  annualBillAudMedian: number;
  usageRateCKwhMean: number;
  dailyChargeAudDayMean: number;
  freshness: Freshness;
};

export type EnergyOverviewResponse = {
  region: string;
  methodSummary: string;
  sourceRefs: SourceRef[];
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
  freshness: Freshness;
};

export type ComparisonResponse = {
  rows: ComparableObservation[];
};

export type MetadataFreshnessSeries = {
  seriesId: string;
  regionCode: string;
  expectedCadence: Cadence;
  updatedAt: string;
  lagMinutes: number;
  freshnessStatus: FreshnessStatus;
};

export type MetadataFreshnessResponse = {
  generatedAt: string;
  staleSeriesCount: number;
  series: MetadataFreshnessSeries[];
};

export type MetadataSource = {
  sourceId: string;
  domain: string;
  name: string;
  url: string;
  expectedCadence: string;
};

export type MetadataSourcesResponse = {
  generatedAt: string;
  sources: MetadataSource[];
};

export type GetSeriesInput = {
  seriesId: string;
  region: string;
  from?: string;
  to?: string;
};

export type GetEnergyRetailComparisonInput = {
  country: string;
  peers: string[];
  basis: RetailComparisonBasis;
  taxStatus?: string;
  consumptionBand?: string;
};

export type GetEnergyWholesaleComparisonInput = {
  country: string;
  peers: string[];
};

export type LiveDataRepository = {
  getHousingOverview(region: string): Promise<HousingOverviewResponse>;
  getSeries(input: GetSeriesInput): Promise<SeriesResponse>;
  getEnergyLiveWholesale(
    region: string,
    window: EnergyWindow
  ): Promise<EnergyLiveWholesaleResponse>;
  getEnergyRetailAverage(region: string): Promise<EnergyRetailAverageResponse>;
  getEnergyRetailComparison(
    input: GetEnergyRetailComparisonInput
  ): Promise<ComparisonResponse>;
  getEnergyWholesaleComparison(
    input: GetEnergyWholesaleComparisonInput
  ): Promise<ComparisonResponse>;
  getEnergyOverview(region: string): Promise<EnergyOverviewResponse>;
  getMetadataFreshness(): Promise<MetadataFreshnessResponse>;
  getMetadataSources(): Promise<MetadataSourcesResponse>;
};
