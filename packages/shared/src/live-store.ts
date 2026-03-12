import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type ObservationConfidence = "official" | "derived" | "qualitative";

export type LiveObservation = {
  seriesId: string;
  regionCode: string;
  countryCode?: string;
  market?: string;
  metricFamily?: string;
  date: string;
  intervalStartUtc?: string;
  intervalEndUtc?: string;
  value: number;
  unit: string;
  currency?: string;
  taxStatus?: string;
  consumptionBand?: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  ingestedAt: string;
  vintage: string;
  isModeled: boolean;
  confidence: ObservationConfidence;
  methodologyVersion?: string;
};

export type SourceCatalogItem = {
  sourceId: string;
  domain: "housing" | "energy" | "macro" | "prices";
  name: string;
  url: string;
  expectedCadence: string;
};

export type SourceReference = Pick<SourceCatalogItem, "sourceId" | "name" | "url">;

export type SourceCursor = {
  sourceId: string;
  cursor: string;
  updatedAt: string;
};

export type IngestionRun = {
  runId: string;
  job: string;
  status: "ok" | "failed" | "degraded";
  startedAt: string;
  finishedAt: string;
  rowsInserted: number;
  rowsUpdated: number;
  errorSummary?: string;
  bullJobId?: string;
  queueName?: string;
  attempt?: number;
  runMode?: "scheduled" | "manual" | "backfill";
};

export type RawSnapshot = {
  snapshotId: string;
  sourceId: string;
  checksumSha256: string;
  capturedAt: string;
  contentType: string;
  payload: string;
};

export type PriceIntakeItem = {
  observedAt: string;
  merchantName: string;
  merchantSlug?: string;
  regionCode: string;
  title: string;
  externalProductId?: string;
  externalOfferId: string;
  priceAmount: number;
  unitPriceAmount?: number;
  normalizedQuantity?: number;
  normalizedUnit?: string;
  listingUrl?: string;
  categoryHint?: string;
  productHint?: string;
};

export type PriceIntakeBatch = {
  batchId: string;
  sourceId: string;
  capturedAt: string;
  rawSnapshotId: string;
  itemCount: number;
  createdAt: string;
};

export type UnresolvedPriceItemStatus = "open" | "reconciled" | "promoted";

export type UnresolvedPriceItem = PriceIntakeItem & {
  unresolvedItemId: string;
  batchId: string;
  sourceId: string;
  rawSnapshotId: string;
  status: UnresolvedPriceItemStatus;
  createdAt: string;
  canonicalCategorySlug?: string;
  canonicalCategoryName?: string;
  canonicalProductSlug?: string;
  canonicalProductName?: string;
  productFamilySlug?: string;
  countryOfOrigin?: string;
  isAustralianMade?: boolean;
  manufacturerName?: string;
  domesticValueShareBand?: string;
  aiExposureLevel?: "low" | "medium" | "high";
  aiExposureReason?: string;
  comparableUnitBasis?: string;
  isControlCandidate?: boolean;
  cohortReady?: boolean;
  notes?: string;
  reconciledAt?: string;
  promotedAt?: string;
};

export type LiveStore = {
  version: 1;
  updatedAt: string;
  observations: LiveObservation[];
  rawSnapshots: RawSnapshot[];
  sources: SourceCatalogItem[];
  sourceCursors: SourceCursor[];
  ingestionRuns: IngestionRun[];
  priceIntakeBatches: PriceIntakeBatch[];
  unresolvedPriceItems: UnresolvedPriceItem[];
};

export type UpsertResult = {
  inserted: number;
  updated: number;
};

const SOURCE_ABS_URL =
  "https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide";
const SOURCE_AEMO_URL =
  "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem";
const SOURCE_AER_URL = "https://www.aer.gov.au/energy-product-reference-data";
const SOURCE_RBA_URL = "https://www.rba.gov.au/statistics/interest-rates/";
const SOURCE_ABS_CPI_URL =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release";
const SOURCE_MAJOR_GOODS_PRICES_URL = SOURCE_ABS_CPI_URL;
const SOURCE_EIA_URL = "https://www.eia.gov/opendata/documentation.php";
const SOURCE_EUROSTAT_URL =
  "https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm";
const SOURCE_ENTSOE_URL = "https://transparency.entsoe.eu/api";
const SOURCE_PLN_URL = "https://web.pln.co.id/cms/media/2025/12/tarif-listrik/";
const SOURCE_BJ_TARIFF_URL =
  "https://fgw.beijing.gov.cn/bmcx/djcx/jzldj/202110/t20211025_2520169.htm";
const SOURCE_NEA_CHINA_WHOLESALE_URL =
  "https://fjb.nea.gov.cn/dtyw/gjnyjdt/202309/t20230915_83144.html";
const SOURCE_WORLD_BANK_URL =
  "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation";
const SOURCE_DCCEEW_GENERATION_MIX_URL =
  "https://www.energy.gov.au/energy-data/australian-electricity-generation-fuel-mix";
const SOURCE_AEMO_WEM_URL =
  "https://www.aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/data-wem/data-dashboard-wem";

export const LIVE_SOURCE_CATALOG: SourceCatalogItem[] = [
  {
    sourceId: "abs_housing",
    domain: "housing",
    name: "Australian Bureau of Statistics",
    url: SOURCE_ABS_URL,
    expectedCadence: "monthly|quarterly"
  },
  {
    sourceId: "aemo_wholesale",
    domain: "energy",
    name: "AEMO NEM Wholesale",
    url: SOURCE_AEMO_URL,
    expectedCadence: "5m"
  },
  {
    sourceId: "aer_prd",
    domain: "energy",
    name: "AER Product Reference Data",
    url: SOURCE_AER_URL,
    expectedCadence: "daily"
  },
  {
    sourceId: "dcceew_generation_mix",
    domain: "energy",
    name: "DCCEEW Australian electricity generation fuel mix",
    url: SOURCE_DCCEEW_GENERATION_MIX_URL,
    expectedCadence: "annual"
  },
  {
    sourceId: "aemo_nem_source_mix",
    domain: "energy",
    name: "AEMO NEM fuel mix dashboard",
    url: SOURCE_AEMO_URL,
    expectedCadence: "5m"
  },
  {
    sourceId: "aemo_wem_source_mix",
    domain: "energy",
    name: "AEMO WEM fuel mix dashboard",
    url: SOURCE_AEMO_WEM_URL,
    expectedCadence: "5m"
  },
  {
    sourceId: "rba_rates",
    domain: "housing",
    name: "RBA Interest Rates",
    url: SOURCE_RBA_URL,
    expectedCadence: "monthly"
  },
  {
    sourceId: "abs_cpi",
    domain: "macro",
    name: "ABS CPI Electricity",
    url: SOURCE_ABS_CPI_URL,
    expectedCadence: "quarterly"
  },
  {
    sourceId: "major_goods_prices",
    domain: "prices",
    name: "Major Goods Retail Basket",
    url: SOURCE_MAJOR_GOODS_PRICES_URL,
    expectedCadence: "daily"
  },
  {
    sourceId: "eia_electricity",
    domain: "energy",
    name: "US EIA Electricity",
    url: SOURCE_EIA_URL,
    expectedCadence: "hourly|monthly"
  },
  {
    sourceId: "eurostat_retail",
    domain: "energy",
    name: "Eurostat Electricity Prices",
    url: SOURCE_EUROSTAT_URL,
    expectedCadence: "semiannual"
  },
  {
    sourceId: "entsoe_wholesale",
    domain: "energy",
    name: "ENTSO-E Wholesale",
    url: SOURCE_ENTSOE_URL,
    expectedCadence: "hourly"
  },
  {
    sourceId: "pln_tariff",
    domain: "energy",
    name: "PLN Household Tariffs",
    url: SOURCE_PLN_URL,
    expectedCadence: "quarterly"
  },
  {
    sourceId: "beijing_residential_tariff",
    domain: "energy",
    name: "Beijing Residential Tariff Proxy",
    url: SOURCE_BJ_TARIFF_URL,
    expectedCadence: "ad hoc"
  },
  {
    sourceId: "nea_china_wholesale_proxy",
    domain: "energy",
    name: "NEA China Wholesale Proxy",
    url: SOURCE_NEA_CHINA_WHOLESALE_URL,
    expectedCadence: "annual"
  },
  {
    sourceId: "world_bank_normalization",
    domain: "macro",
    name: "World Bank Indicators API",
    url: SOURCE_WORLD_BANK_URL,
    expectedCadence: "annual"
  }
];

const LIVE_SOURCE_CATALOG_BY_ID = new Map(
  LIVE_SOURCE_CATALOG.map((item) => [item.sourceId, item] as const)
);

export const ENERGY_SOURCE_MIX_KEYS = [
  "coal",
  "gas",
  "hydro",
  "oil",
  "other_renewables"
] as const;

export type EnergySourceMixKey = (typeof ENERGY_SOURCE_MIX_KEYS)[number];

export type AnnualSourceMixPoint = {
  regionCode: string;
  period: string;
  sourceKey: EnergySourceMixKey;
  generationGwh: number;
  sharePct: number;
};

export type OperationalSourceMixPoint = {
  regionCode: string;
  timestamp: string;
  sourceKey: EnergySourceMixKey;
  generationMw: number;
  sharePct: number;
};

export const OFFICIAL_SOURCE_MIX_PERIOD = "2024";
export const OPERATIONAL_SOURCE_MIX_TIMESTAMP = "2026-02-27T02:00:00Z";

const OFFICIAL_SOURCE_MIX_SHARES: Record<
  string,
  Record<EnergySourceMixKey, number>
> = {
  AU: {
    coal: 47,
    gas: 18,
    hydro: 6,
    oil: 1,
    other_renewables: 28
  },
  NSW: {
    coal: 68,
    gas: 4,
    hydro: 7,
    oil: 0,
    other_renewables: 21
  },
  VIC: {
    coal: 63,
    gas: 6,
    hydro: 5,
    oil: 0,
    other_renewables: 26
  },
  QLD: {
    coal: 73,
    gas: 10,
    hydro: 1,
    oil: 0,
    other_renewables: 16
  },
  SA: {
    coal: 0,
    gas: 21,
    hydro: 0,
    oil: 1,
    other_renewables: 78
  },
  WA: {
    coal: 23,
    gas: 62,
    hydro: 0,
    oil: 2,
    other_renewables: 13
  },
  TAS: {
    coal: 0,
    gas: 0,
    hydro: 79,
    oil: 0,
    other_renewables: 21
  },
  NT: {
    coal: 0,
    gas: 84,
    hydro: 0,
    oil: 8,
    other_renewables: 8
  }
};

const OFFICIAL_SOURCE_MIX_TOTALS_GWH: Record<string, number> = {
  AU: 364_000,
  NSW: 71_000,
  VIC: 50_000,
  QLD: 59_000,
  SA: 14_000,
  WA: 19_000,
  TAS: 11_000,
  NT: 2_000
};

export const OFFICIAL_SOURCE_MIX_FIXTURE: AnnualSourceMixPoint[] = Object.entries(
  OFFICIAL_SOURCE_MIX_SHARES
).flatMap(([regionCode, shares]) =>
  ENERGY_SOURCE_MIX_KEYS.map((sourceKey) => ({
    regionCode,
    period: OFFICIAL_SOURCE_MIX_PERIOD,
    sourceKey,
    generationGwh: Number(
      ((OFFICIAL_SOURCE_MIX_TOTALS_GWH[regionCode] * shares[sourceKey]) / 100).toFixed(2)
    ),
    sharePct: shares[sourceKey]
  }))
);

const NEM_OPERATIONAL_MIX_GENERATION_MW: Record<
  string,
  Record<EnergySourceMixKey, number>
> = {
  NSW: {
    coal: 5520,
    gas: 560,
    hydro: 400,
    oil: 0,
    other_renewables: 1520
  },
  VIC: {
    coal: 2900,
    gas: 300,
    hydro: 200,
    oil: 0,
    other_renewables: 1600
  },
  QLD: {
    coal: 4560,
    gas: 780,
    hydro: 60,
    oil: 0,
    other_renewables: 600
  },
  SA: {
    coal: 0,
    gas: 180,
    hydro: 0,
    oil: 0,
    other_renewables: 820
  },
  TAS: {
    coal: 0,
    gas: 0,
    hydro: 648,
    oil: 0,
    other_renewables: 152
  }
};

export const NEM_OPERATIONAL_SOURCE_MIX_FIXTURE: OperationalSourceMixPoint[] = Object.entries(
  NEM_OPERATIONAL_MIX_GENERATION_MW
).flatMap(([regionCode, mix]) => {
  const totalGenerationMw = ENERGY_SOURCE_MIX_KEYS.reduce(
    (sum, sourceKey) => sum + mix[sourceKey],
    0
  );

  return ENERGY_SOURCE_MIX_KEYS.map((sourceKey) => ({
    regionCode,
    timestamp: OPERATIONAL_SOURCE_MIX_TIMESTAMP,
    sourceKey,
    generationMw: mix[sourceKey],
    sharePct: totalGenerationMw > 0 ? Number(((mix[sourceKey] / totalGenerationMw) * 100).toFixed(1)) : 0
  }));
});

const WEM_OPERATIONAL_MIX_GENERATION_MW: Record<EnergySourceMixKey, number> = {
  coal: 420,
  gas: 1240,
  hydro: 0,
  oil: 80,
  other_renewables: 260
};

export const WEM_OPERATIONAL_SOURCE_MIX_FIXTURE: OperationalSourceMixPoint[] = (() => {
  const totalGenerationMw = ENERGY_SOURCE_MIX_KEYS.reduce(
    (sum, sourceKey) => sum + WEM_OPERATIONAL_MIX_GENERATION_MW[sourceKey],
    0
  );

  return ENERGY_SOURCE_MIX_KEYS.map((sourceKey) => ({
    regionCode: "WA",
    timestamp: OPERATIONAL_SOURCE_MIX_TIMESTAMP,
    sourceKey,
    generationMw: WEM_OPERATIONAL_MIX_GENERATION_MW[sourceKey],
    sharePct:
      totalGenerationMw > 0
        ? Number(
            ((WEM_OPERATIONAL_MIX_GENERATION_MW[sourceKey] / totalGenerationMw) * 100).toFixed(1)
          )
        : 0
  }));
})();

function buildOperationalAggregateFixture(
  points: OperationalSourceMixPoint[]
): OperationalSourceMixPoint[] {
  const generationBySource = new Map<EnergySourceMixKey, number>();
  for (const sourceKey of ENERGY_SOURCE_MIX_KEYS) {
    generationBySource.set(sourceKey, 0);
  }

  for (const point of points) {
    generationBySource.set(
      point.sourceKey,
      (generationBySource.get(point.sourceKey) ?? 0) + point.generationMw
    );
  }

  const totalGenerationMw = [...generationBySource.values()].reduce(
    (sum, value) => sum + value,
    0
  );

  return ENERGY_SOURCE_MIX_KEYS.map((sourceKey) => {
    const generationMw = generationBySource.get(sourceKey) ?? 0;
    return {
      regionCode: "AU",
      timestamp: OPERATIONAL_SOURCE_MIX_TIMESTAMP,
      sourceKey,
      generationMw,
      sharePct:
        totalGenerationMw > 0 ? Number(((generationMw / totalGenerationMw) * 100).toFixed(1)) : 0
    };
  });
}

export function energySourceMixSeriesId(
  view: "official" | "operational",
  sourceKey: EnergySourceMixKey
): string {
  return `energy.source_mix.${view}.share_pct.${sourceKey}`;
}

function buildSourceMixSeedObservations(): LiveObservation[] {
  const officialObservations = OFFICIAL_SOURCE_MIX_FIXTURE.map((point) =>
    makeObservation({
      seriesId: energySourceMixSeriesId("official", point.sourceKey),
      regionCode: point.regionCode,
      countryCode: "AU",
      market: "annual_official",
      metricFamily: "source_mix",
      date: point.period,
      value: point.sharePct,
      unit: "pct",
      sourceName: "DCCEEW",
      sourceUrl: SOURCE_DCCEEW_GENERATION_MIX_URL,
      publishedAt: "2025-09-01T00:00:00Z",
      methodologyVersion: "energy-source-mix-v1"
    })
  );

  const operationalObservations = [
    ...buildOperationalAggregateFixture([
      ...NEM_OPERATIONAL_SOURCE_MIX_FIXTURE,
      ...WEM_OPERATIONAL_SOURCE_MIX_FIXTURE
    ]).map((point) =>
      makeObservation({
        seriesId: energySourceMixSeriesId("operational", point.sourceKey),
        regionCode: "AU",
        countryCode: "AU",
        market: "NEM+WEM",
        metricFamily: "source_mix",
        date: point.timestamp,
        intervalStartUtc: point.timestamp,
        intervalEndUtc: point.timestamp,
        value: point.sharePct,
        unit: "pct",
        sourceName: "AEMO",
        sourceUrl: `${SOURCE_AEMO_URL}|${SOURCE_AEMO_WEM_URL}`,
        publishedAt: point.timestamp,
        isModeled: true,
        confidence: "derived",
        methodologyVersion: "energy-source-mix-v1"
      })
    ),
    ...NEM_OPERATIONAL_SOURCE_MIX_FIXTURE.map((point) =>
      makeObservation({
        seriesId: energySourceMixSeriesId("operational", point.sourceKey),
        regionCode: point.regionCode,
        countryCode: "AU",
        market: "NEM",
        metricFamily: "source_mix",
        date: point.timestamp,
        intervalStartUtc: point.timestamp,
        intervalEndUtc: point.timestamp,
        value: point.sharePct,
        unit: "pct",
        sourceName: "AEMO",
        sourceUrl: SOURCE_AEMO_URL,
        publishedAt: point.timestamp,
        methodologyVersion: "energy-source-mix-v1"
      })
    ),
    ...WEM_OPERATIONAL_SOURCE_MIX_FIXTURE.map((point) =>
      makeObservation({
        seriesId: energySourceMixSeriesId("operational", point.sourceKey),
        regionCode: point.regionCode,
        countryCode: "AU",
        market: "WEM",
        metricFamily: "source_mix",
        date: point.timestamp,
        intervalStartUtc: point.timestamp,
        intervalEndUtc: point.timestamp,
        value: point.sharePct,
        unit: "pct",
        sourceName: "AEMO",
        sourceUrl: SOURCE_AEMO_WEM_URL,
        publishedAt: point.timestamp,
        methodologyVersion: "energy-source-mix-v1"
      })
    )
  ];

  return [...officialObservations, ...operationalObservations];
}

type ObservationRecencyFields = Pick<
  LiveObservation,
  "date" | "vintage" | "publishedAt" | "ingestedAt"
> &
  Partial<Pick<LiveObservation, "sourceName" | "sourceUrl">>;

function nowIso(): string {
  return new Date().toISOString();
}

function compareDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function observationKey(observation: LiveObservation): string {
  return [
    observation.seriesId,
    observation.regionCode,
    observation.date,
    observation.vintage
  ].join("|");
}

function makeObservation(
  partial: Omit<LiveObservation, "ingestedAt" | "vintage" | "isModeled" | "confidence"> &
    Partial<
      Pick<LiveObservation, "ingestedAt" | "vintage" | "isModeled" | "confidence">
    >
): LiveObservation {
  return {
    ...partial,
    ingestedAt: partial.ingestedAt ?? "2026-02-27T02:05:00Z",
    vintage: partial.vintage ?? "2026-02-27",
    isModeled: partial.isModeled ?? false,
    confidence: partial.confidence ?? "official"
  };
}

export function getSourceCatalogItems(sourceIds?: string[]): SourceCatalogItem[] {
  if (!sourceIds) {
    return LIVE_SOURCE_CATALOG.map((item) => ({ ...item }));
  }

  return sourceIds.map((sourceId) => {
    const sourceItem = LIVE_SOURCE_CATALOG_BY_ID.get(sourceId);
    if (!sourceItem) {
      throw new Error(`Unknown source catalog item: ${sourceId}`);
    }
    return { ...sourceItem };
  });
}

export function dedupeSourceCatalogItems(
  sourceCatalog: SourceCatalogItem[]
): SourceCatalogItem[] {
  const byId = new Map<string, SourceCatalogItem>();

  for (const sourceItem of sourceCatalog) {
    byId.set(sourceItem.sourceId, { ...sourceItem });
  }

  return [...byId.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

export function mergeSourceCatalogItems(
  sourceCatalog: SourceCatalogItem[]
): SourceCatalogItem[] {
  return dedupeSourceCatalogItems([...sourceCatalog, ...getSourceCatalogItems()]);
}

export function getSourceReferences(sourceIds: string[]): SourceReference[] {
  return sourceIds.map((sourceId) => {
    const sourceItem = LIVE_SOURCE_CATALOG_BY_ID.get(sourceId);
    if (!sourceItem) {
      throw new Error(`Unknown source catalog item: ${sourceId}`);
    }

    return {
      sourceId: sourceItem.sourceId,
      name: sourceItem.name,
      url: sourceItem.url
    };
  });
}

export function compareObservationRecency<T extends ObservationRecencyFields>(
  left: T,
  right: T
): number {
  return (
    compareDesc(left.date, right.date) ||
    compareDesc(left.vintage, right.vintage) ||
    compareDesc(left.publishedAt, right.publishedAt) ||
    compareDesc(left.ingestedAt, right.ingestedAt) ||
    compareDesc(left.sourceName ?? "", right.sourceName ?? "") ||
    compareDesc(left.sourceUrl ?? "", right.sourceUrl ?? "")
  );
}

export function pickLatestObservation<T extends ObservationRecencyFields>(
  observations: T[]
): T | null {
  return [...observations].sort(compareObservationRecency)[0] ?? null;
}

export function createSeedLiveStore(): LiveStore {
  const observations: LiveObservation[] = [
    makeObservation({
      seriesId: "hvi.value.index",
      regionCode: "AU",
      date: "2025-11-30",
      value: 168.9,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2025-12-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "hvi.value.index",
      regionCode: "AU",
      date: "2025-12-31",
      value: 169.4,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.count",
      regionCode: "AU",
      date: "2025-12-31",
      value: 42580,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.value_aud",
      regionCode: "AU",
      date: "2025-12-31",
      value: 27_300_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.count",
      regionCode: "AU",
      date: "2025-12-31",
      value: 16950,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.value_aud",
      regionCode: "AU",
      date: "2025-12-31",
      value: 12_150_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.avg_loan_size_aud",
      regionCode: "AU",
      date: "2025-12-31",
      value: 736000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "rates.oo.variable_pct",
      regionCode: "AU",
      date: "2025-12-31",
      value: 6.08,
      unit: "%",
      sourceName: "RBA",
      sourceUrl: SOURCE_RBA_URL,
      publishedAt: "2026-01-05T00:00:00Z"
    }),
    makeObservation({
      seriesId: "rates.oo.fixed_pct",
      regionCode: "AU",
      date: "2025-12-31",
      value: 5.79,
      unit: "%",
      sourceName: "RBA",
      sourceUrl: SOURCE_RBA_URL,
      publishedAt: "2026-01-05T00:00:00Z"
    }),
    makeObservation({
      seriesId: "hvi.value.index",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 172.4,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.count",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 10120,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.value_aud",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 7_230_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.count",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 4180,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.value_aud",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 3_150_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.avg_loan_size_aud",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 756000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "rates.oo.variable_pct",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 6.16,
      unit: "%",
      sourceName: "RBA",
      sourceUrl: SOURCE_RBA_URL,
      publishedAt: "2026-01-05T00:00:00Z"
    }),
    makeObservation({
      seriesId: "prices.major_goods.overall.index",
      regionCode: "AU",
      market: "major_goods",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 107.53,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.major_goods.food.index",
      regionCode: "AU",
      market: "major_goods",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 107.49,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.major_goods.household_supplies.index",
      regionCode: "AU",
      market: "major_goods",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 107.89,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.major_goods.overall.index",
      regionCode: "VIC",
      market: "major_goods",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 107.1,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.major_goods.food.index",
      regionCode: "VIC",
      market: "major_goods",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 108.09,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.major_goods.household_supplies.index",
      regionCode: "VIC",
      market: "major_goods",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 104.05,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.au_made.all.index",
      regionCode: "AU",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 107.24,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.au_made.ai_exposed.index",
      regionCode: "AU",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 104.76,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.au_made.control.index",
      regionCode: "AU",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 109.72,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.imported.matched_control.index",
      regionCode: "AU",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 107.89,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.ai_deflation.spread.au_made_vs_control.index",
      regionCode: "AU",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: -4.96,
      unit: "index_points",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.au_made.all.index",
      regionCode: "VIC",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 108.04,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.au_made.ai_exposed.index",
      regionCode: "VIC",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 107.5,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.au_made.control.index",
      regionCode: "VIC",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 108.57,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.imported.matched_control.index",
      regionCode: "VIC",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: 104.05,
      unit: "index",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "prices.ai_deflation.spread.au_made_vs_control.index",
      regionCode: "VIC",
      market: "ai_deflation",
      metricFamily: "prices",
      date: "2026-02-27",
      value: -1.07,
      unit: "index_points",
      sourceName: "Major Goods Retail Basket",
      sourceUrl: SOURCE_MAJOR_GOODS_PRICES_URL,
      publishedAt: "2026-02-27T06:00:00Z",
      methodologyVersion: "prices-major-goods-v1"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      date: "2026-02-27T01:50:00Z",
      value: 112.6,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T01:55:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      date: "2026-02-27T01:55:00Z",
      value: 116.9,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T02:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      date: "2026-02-27T02:00:00Z",
      value: 118,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.region_aud_mwh",
      regionCode: "VIC",
      date: "2026-02-27T02:00:00Z",
      value: 100,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.region_aud_mwh",
      regionCode: "NSW",
      date: "2026-02-27T02:00:00Z",
      value: 120,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.region_aud_mwh",
      regionCode: "QLD",
      date: "2026-02-27T02:00:00Z",
      value: 140,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.region_aud_mwh",
      regionCode: "SA",
      date: "2026-02-27T02:00:00Z",
      value: 138,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.region_aud_mwh",
      regionCode: "TAS",
      date: "2026-02-27T02:00:00Z",
      value: 104,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: SOURCE_AEMO_URL,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "AU",
      date: "2026-02-27",
      value: 1940,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "AU",
      date: "2026-02-27",
      value: 1885,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "VIC",
      date: "2026-02-27",
      value: 1868,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "VIC",
      date: "2026-02-27",
      value: 1821,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "NSW",
      date: "2026-02-27",
      value: 1960,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "NSW",
      date: "2026-02-27",
      value: 1960,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "QLD",
      date: "2026-02-27",
      value: 2015,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "QLD",
      date: "2026-02-27",
      value: 2015,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "SA",
      date: "2026-02-27",
      value: 2042,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "SA",
      date: "2026-02-27",
      value: 2042,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "WA",
      date: "2026-02-27",
      value: 2148,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "WA",
      date: "2026-02-27",
      value: 2148,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "TAS",
      date: "2026-02-27",
      value: 1887,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "TAS",
      date: "2026-02-27",
      value: 1887,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "ACT",
      date: "2026-02-27",
      value: 1998,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "ACT",
      date: "2026-02-27",
      value: 1998,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "NT",
      date: "2026-02-27",
      value: 2236,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "NT",
      date: "2026-02-27",
      value: 2236,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "AU",
      date: "2025-07-01",
      value: 1985,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "VIC",
      date: "2025-07-01",
      value: 1890,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "NSW",
      date: "2025-07-01",
      value: 2050,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "QLD",
      date: "2025-07-01",
      value: 2015,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "SA",
      date: "2025-07-01",
      value: 2080,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "WA",
      date: "2025-07-01",
      value: 2190,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "TAS",
      date: "2025-07-01",
      value: 1930,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "ACT",
      date: "2025-07-01",
      value: 2035,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "NT",
      date: "2025-07-01",
      value: 2290,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: SOURCE_AER_URL,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "AU",
      date: "2025-Q4",
      value: 151.2,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "VIC",
      date: "2025-Q4",
      value: 148.6,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "NSW",
      date: "2025-Q4",
      value: 152.8,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "QLD",
      date: "2025-Q4",
      value: 149.9,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "SA",
      date: "2025-Q4",
      value: 153.1,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "WA",
      date: "2025-Q4",
      value: 147.4,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "TAS",
      date: "2025-Q4",
      value: 146.8,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "ACT",
      date: "2025-Q4",
      value: 150.5,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "NT",
      date: "2025-Q4",
      value: 156.2,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: SOURCE_ABS_URL,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    ...buildSourceMixSeedObservations()
  ];

  return {
    version: 1,
    updatedAt: "2026-02-27T02:05:00Z",
    observations,
    rawSnapshots: [],
    sources: getSourceCatalogItems(),
    sourceCursors: [],
    ingestionRuns: [],
    priceIntakeBatches: [],
    unresolvedPriceItems: []
  };
}

export function resolveLiveStorePath(explicitPath?: string): string {
  if (explicitPath && explicitPath.length > 0) {
    return path.resolve(explicitPath);
  }

  if (process.env.AUS_DASH_STORE_PATH && process.env.AUS_DASH_STORE_PATH.length > 0) {
    return path.resolve(process.env.AUS_DASH_STORE_PATH);
  }

  return path.resolve(process.cwd(), "data/live-store.json");
}

export function writeLiveStoreSync(
  store: LiveStore,
  storePath: string = resolveLiveStorePath()
): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function isLiveStore(value: unknown): value is LiveStore {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<LiveStore>;
  return (
    maybe.version === 1 &&
    Array.isArray(maybe.observations) &&
    (Array.isArray(maybe.rawSnapshots) || maybe.rawSnapshots === undefined) &&
    Array.isArray(maybe.sources) &&
    Array.isArray(maybe.sourceCursors) &&
    Array.isArray(maybe.ingestionRuns) &&
    (Array.isArray(maybe.priceIntakeBatches) || maybe.priceIntakeBatches === undefined) &&
    (Array.isArray(maybe.unresolvedPriceItems) || maybe.unresolvedPriceItems === undefined)
  );
}

export function readLiveStoreSync(
  storePath: string = resolveLiveStorePath()
): LiveStore {
  if (!existsSync(storePath)) {
    const seeded = createSeedLiveStore();
    writeLiveStoreSync(seeded, storePath);
    return seeded;
  }

  const content = readFileSync(storePath, "utf8");
  const parsed = JSON.parse(content) as unknown;
  if (!isLiveStore(parsed)) {
    const seeded = createSeedLiveStore();
    writeLiveStoreSync(seeded, storePath);
    return seeded;
  }

  if (Array.isArray(parsed.rawSnapshots)) {
    const hasSourceMixObservations = parsed.observations.some((observation) =>
      observation.seriesId.startsWith("energy.source_mix.")
    );
    return {
      ...parsed,
      observations: hasSourceMixObservations
        ? parsed.observations
        : [...parsed.observations, ...buildSourceMixSeedObservations()],
      sources: mergeSourceCatalogItems(parsed.sources),
      priceIntakeBatches: parsed.priceIntakeBatches ?? [],
      unresolvedPriceItems: parsed.unresolvedPriceItems ?? []
    };
  }

  // Backfill stores created before raw snapshot support.
  const hasSourceMixObservations = parsed.observations.some((observation) =>
    observation.seriesId.startsWith("energy.source_mix.")
  );
  return {
    ...parsed,
    observations: hasSourceMixObservations
      ? parsed.observations
      : [...parsed.observations, ...buildSourceMixSeedObservations()],
    rawSnapshots: [],
    sources: mergeSourceCatalogItems(parsed.sources),
    priceIntakeBatches: parsed.priceIntakeBatches ?? [],
    unresolvedPriceItems: parsed.unresolvedPriceItems ?? []
  };
}

export function upsertObservations(
  store: LiveStore,
  incoming: LiveObservation[]
): UpsertResult {
  const indexByKey = new Map<string, number>();
  store.observations.forEach((observation, index) => {
    indexByKey.set(observationKey(observation), index);
  });

  let inserted = 0;
  let updated = 0;

  for (const nextObservation of incoming) {
    const key = observationKey(nextObservation);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      store.observations.push(nextObservation);
      indexByKey.set(key, store.observations.length - 1);
      inserted += 1;
      continue;
    }

    store.observations[existingIndex] = nextObservation;
    updated += 1;
  }

  if (inserted > 0 || updated > 0) {
    store.updatedAt = nowIso();
  }

  return { inserted, updated };
}

export function setSourceCursor(
  store: LiveStore,
  sourceId: string,
  cursor: string
): void {
  const existing = store.sourceCursors.find((item) => item.sourceId === sourceId);
  if (existing) {
    existing.cursor = cursor;
    existing.updatedAt = nowIso();
    store.updatedAt = existing.updatedAt;
    return;
  }

  const updatedAt = nowIso();
  store.sourceCursors.push({ sourceId, cursor, updatedAt });
  store.updatedAt = updatedAt;
}

export function upsertSourceCatalog(
  store: LiveStore,
  sourceCatalog: SourceCatalogItem[]
): void {
  if (sourceCatalog.length === 0) {
    return;
  }

  const merged = mergeSourceCatalogItems([...store.sources, ...sourceCatalog]);
  const changed = JSON.stringify(store.sources) !== JSON.stringify(merged);
  if (!changed) {
    return;
  }

  store.sources = merged;
  store.updatedAt = nowIso();
}

export function appendIngestionRun(
  store: LiveStore,
  run: Omit<IngestionRun, "runId">
): IngestionRun {
  const ingestionRun: IngestionRun = {
    runId: `${run.job}-${Date.now()}`,
    ...run
  };
  store.ingestionRuns.push(ingestionRun);
  store.updatedAt = run.finishedAt;
  return ingestionRun;
}

export type StageRawPayloadInput = {
  sourceId: string;
  payload: string;
  contentType: string;
  capturedAt: string;
};

export type StageRawPayloadResult = {
  staged: boolean;
  snapshot: RawSnapshot;
};

export type AppendPriceIntakeBatchInput = {
  sourceId: string;
  capturedAt: string;
  items: PriceIntakeItem[];
};

export type AppendPriceIntakeBatchResult = {
  batch: PriceIntakeBatch;
  unresolvedItems: UnresolvedPriceItem[];
  snapshot: RawSnapshot;
};

export type ReconcileUnresolvedPriceItemInput = {
  canonicalCategorySlug: string;
  canonicalCategoryName: string;
  canonicalProductSlug: string;
  canonicalProductName: string;
  notes?: string;
};

export type ClassifyUnresolvedPriceItemInput = {
  productFamilySlug?: string;
  countryOfOrigin?: string;
  isAustralianMade?: boolean;
  manufacturerName?: string;
  domesticValueShareBand?: string;
  aiExposureLevel?: "low" | "medium" | "high";
  aiExposureReason?: string;
  comparableUnitBasis?: string;
  isControlCandidate?: boolean;
};

export type UnresolvedPriceItemMutationResult =
  | {
      kind: "ok";
      item: UnresolvedPriceItem;
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "invalid_state";
      currentStatus: UnresolvedPriceItemStatus;
    };

function notFoundUnresolvedPriceItem(): UnresolvedPriceItemMutationResult {
  return { kind: "not_found" };
}

function invalidUnresolvedPriceItemState(
  currentStatus: UnresolvedPriceItemStatus
): UnresolvedPriceItemMutationResult {
  return {
    kind: "invalid_state",
    currentStatus
  };
}

export function promoteReconciledPriceItemsInStore(
  store: LiveStore,
  input: {
    sourceId?: string;
    promotedAt: string;
  }
): UnresolvedPriceItem[] {
  const promoted: UnresolvedPriceItem[] = [];

  for (const item of store.unresolvedPriceItems) {
    if (item.status !== "reconciled") {
      continue;
    }
    if (input.sourceId && item.sourceId !== input.sourceId) {
      continue;
    }

    const next = promoteUnresolvedPriceItem(
      store,
      item.unresolvedItemId,
      input.promotedAt
    );
    if (next.kind === "ok") {
      promoted.push(next.item);
    }
  }

  if (promoted.length > 0) {
    store.updatedAt = input.promotedAt;
  }

  return promoted;
}

export function payloadChecksumSha256(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function stageRawPayload(
  store: LiveStore,
  input: StageRawPayloadInput
): StageRawPayloadResult {
  const checksumSha256 = payloadChecksumSha256(input.payload);
  const existing = store.rawSnapshots.find(
    (snapshot) =>
      snapshot.sourceId === input.sourceId &&
      snapshot.checksumSha256 === checksumSha256
  );

  if (existing) {
    return {
      staged: false,
      snapshot: existing
    };
  }

  const snapshot: RawSnapshot = {
    snapshotId: `${input.sourceId}-${Date.now()}-${store.rawSnapshots.length + 1}`,
    sourceId: input.sourceId,
    checksumSha256,
    capturedAt: input.capturedAt,
    contentType: input.contentType,
    payload: input.payload
  };
  store.rawSnapshots.push(snapshot);
  store.updatedAt = nowIso();

  return {
    staged: true,
    snapshot
  };
}

export function appendPriceIntakeBatch(
  store: LiveStore,
  input: AppendPriceIntakeBatchInput
): AppendPriceIntakeBatchResult {
  const payload = JSON.stringify({
    sourceId: input.sourceId,
    capturedAt: input.capturedAt,
    items: input.items
  });
  const staged = stageRawPayload(store, {
    sourceId: input.sourceId,
    payload,
    contentType: "application/json",
    capturedAt: input.capturedAt
  });

  const batch: PriceIntakeBatch = {
    batchId: `${input.sourceId}-batch-${input.capturedAt.replace(/[^0-9A-Za-z]/g, "")}-${store.priceIntakeBatches.length + 1}`,
    sourceId: input.sourceId,
    capturedAt: input.capturedAt,
    rawSnapshotId: staged.snapshot.snapshotId,
    itemCount: input.items.length,
    createdAt: input.capturedAt
  };

  const unresolvedItems = input.items.map((item, index) => ({
    unresolvedItemId: `${batch.batchId}-item-${index + 1}`,
    batchId: batch.batchId,
    sourceId: input.sourceId,
    rawSnapshotId: staged.snapshot.snapshotId,
    status: "open" as const,
    createdAt: input.capturedAt,
    ...item
  }));

  store.priceIntakeBatches.push(batch);
  store.unresolvedPriceItems.push(...unresolvedItems);
  store.updatedAt = input.capturedAt;

  return {
    batch,
    unresolvedItems,
    snapshot: staged.snapshot
  };
}

export function listUnresolvedPriceItems(
  store: LiveStore,
  status: UnresolvedPriceItemStatus = "open"
): UnresolvedPriceItem[] {
  return store.unresolvedPriceItems.filter((item) => item.status === status);
}

export function reconcileUnresolvedPriceItem(
  store: LiveStore,
  unresolvedItemId: string,
  input: ReconcileUnresolvedPriceItemInput
): UnresolvedPriceItemMutationResult {
  const item = store.unresolvedPriceItems.find(
    (entry) => entry.unresolvedItemId === unresolvedItemId
  );
  if (!item) {
    return notFoundUnresolvedPriceItem();
  }
  if (item.status === "promoted") {
    return invalidUnresolvedPriceItemState(item.status);
  }

  item.status = "reconciled";
  item.canonicalCategorySlug = input.canonicalCategorySlug;
  item.canonicalCategoryName = input.canonicalCategoryName;
  item.canonicalProductSlug = input.canonicalProductSlug;
  item.canonicalProductName = input.canonicalProductName;
  item.notes = input.notes;
  item.reconciledAt = nowIso();
  store.updatedAt = item.reconciledAt;
  return {
    kind: "ok",
    item
  };
}

export function classifyUnresolvedPriceItem(
  store: LiveStore,
  unresolvedItemId: string,
  input: ClassifyUnresolvedPriceItemInput
): UnresolvedPriceItemMutationResult {
  const item = store.unresolvedPriceItems.find(
    (entry) => entry.unresolvedItemId === unresolvedItemId
  );
  if (!item) {
    return notFoundUnresolvedPriceItem();
  }
  if (item.status !== "reconciled") {
    return invalidUnresolvedPriceItemState(item.status);
  }

  item.productFamilySlug = input.productFamilySlug;
  item.countryOfOrigin = input.countryOfOrigin;
  item.isAustralianMade = input.isAustralianMade;
  item.manufacturerName = input.manufacturerName;
  item.domesticValueShareBand = input.domesticValueShareBand;
  item.aiExposureLevel = input.aiExposureLevel;
  item.aiExposureReason = input.aiExposureReason;
  item.comparableUnitBasis = input.comparableUnitBasis;
  item.isControlCandidate = input.isControlCandidate;
  item.cohortReady = Boolean(
    item.productFamilySlug &&
      item.countryOfOrigin &&
      typeof item.isAustralianMade === "boolean" &&
      item.manufacturerName &&
      item.domesticValueShareBand &&
      item.aiExposureLevel &&
      item.aiExposureReason &&
      item.comparableUnitBasis &&
      typeof item.isControlCandidate === "boolean"
  );
  store.updatedAt = nowIso();
  return {
    kind: "ok",
    item
  };
}

export function promoteUnresolvedPriceItem(
  store: LiveStore,
  unresolvedItemId: string,
  promotedAt: string
): UnresolvedPriceItemMutationResult {
  const item = store.unresolvedPriceItems.find(
    (entry) => entry.unresolvedItemId === unresolvedItemId
  );
  if (!item) {
    return notFoundUnresolvedPriceItem();
  }
  if (item.status !== "reconciled") {
    return invalidUnresolvedPriceItemState(item.status);
  }

  item.status = "promoted";
  item.promotedAt = promotedAt;
  store.updatedAt = promotedAt;
  return {
    kind: "ok",
    item
  };
}
