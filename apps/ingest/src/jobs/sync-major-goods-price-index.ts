import { createHash } from "node:crypto";
import {
  getSourceCatalogItems,
  type LiveObservation,
  type SourceCatalogItem,
  type StageRawPayloadInput
} from "@aus-dash/shared";
import type { MajorGoodsPricePoint, SourceFetch } from "../sources/live-source-clients";
import { fetchMajorGoodsPriceSnapshot } from "../sources/live-source-clients";
import { resolveIngestBackend } from "../repositories/ingest-backend";
import { persistIngestArtifacts } from "../repositories/ingest-persistence";
import { persistMajorGoodsPriceWarehouseInPostgres } from "../repositories/postgres-price-warehouse";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

const SOURCE_ID = "major_goods_prices";
const METHODOLOGY_VERSION = "prices-major-goods-v1";
const SOURCE_ITEM = getSourceCatalogItems([SOURCE_ID])[0]!;
const BASE_PERIOD = "2026-02-26";
const BASE_VALUE = 100;

type MajorGoodsIndexSeriesDefinition = {
  indexId: string;
  seriesId: string;
  label: string;
  categoryScope: string;
  weights: Record<string, number>;
};

type PriceWarehouseCategory = {
  categoryId: string;
  slug: string;
  name: string;
  parentCategoryId: string | null;
  absCpiCode: string | null;
  absCpiLevel: string | null;
  isMajorGood: boolean;
  createdAt: string;
  updatedAt: string;
};

type PriceWarehouseProduct = {
  productId: string;
  categoryId: string;
  slug: string;
  productFamilySlug: string;
  canonicalName: string;
  brand: string | null;
  variant: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  packCount: number | null;
  normalizedQuantity: number;
  normalizedUnit: string;
  countryOfOrigin: string;
  isAustralianMade: boolean;
  manufacturerName: string;
  domesticValueShareBand: string;
  aiExposureLevel: string;
  aiExposureReason: string;
  comparableUnitBasis: string;
  isControlCandidate: boolean;
  cohortReady: boolean;
  gtin: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PriceWarehouseMerchant = {
  merchantId: string;
  slug: string;
  name: string;
  merchantType: string;
  websiteUrl: string | null;
  countryCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PriceWarehouseLocation = {
  locationId: string;
  merchantId: string;
  locationCode: string | null;
  name: string | null;
  regionCode: string;
  postcode: string | null;
  suburb: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  isOnlineOnly: boolean;
  openedAt: string | null;
  closedAt: string | null;
};

type PriceWarehouseAlias = {
  productAliasId: string;
  sourceId: string;
  merchantId: string;
  externalProductId: string;
  externalSku: string | null;
  productId: string;
  matchConfidence: string;
  matchMethod: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

type PriceWarehouseOffer = {
  offerId: string;
  sourceId: string;
  merchantId: string;
  locationId: string;
  productAliasId: string;
  productId: string;
  externalOfferId: string;
  listingUrl: string | null;
  sellerSku: string | null;
  currency: string;
  taxStatus: string;
  unitCount: number | null;
  unitSizeValue: number | null;
  unitSizeMeasure: string | null;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
};

type PriceWarehouseObservation = {
  priceObservationId: string;
  offerId: string;
  productId: string;
  merchantId: string;
  locationId: string;
  regionCode: string;
  observedAt: string;
  observedDate: string;
  availabilityStatus: string | null;
  inStock: boolean | null;
  priceType: string;
  priceAmount: number;
  currency: string;
  unitPriceAmount: number;
  unitPriceUnit: string;
  promoLabel: string | null;
  multibuyQuantity: number | null;
  multibuyTotalAmount: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceRunId: string | null;
  rawSnapshotId: string | null;
  observedChecksum: string;
  qualityFlag: string | null;
  createdAt: string;
};

type PriceRollupDaily = {
  rollupId: string;
  rollupDate: string;
  productId: string;
  productSlug: string;
  categoryId: string;
  categorySlug: string;
  regionCode: string;
  merchantId: string | null;
  sampleSize: number;
  distinctOfferCount: number;
  minPrice: number;
  maxPrice: number;
  meanPrice: number;
  medianPrice: number;
  p25Price: number;
  p75Price: number;
  meanUnitPrice: number;
  medianUnitPrice: number;
  methodologyVersion: string;
  computedAt: string;
};

type PriceIndexDefinition = {
  indexId: string;
  name: string;
  description: string;
  categoryScope: string;
  geographyLevel: string;
  frequency: string;
  basePeriod: string;
  baseValue: number;
  aggregationMethod: string;
  publishedSeriesId: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

type PriceIndexBasketVersion = {
  basketVersionId: string;
  indexId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  weightSource: string;
  methodologyVersion: string;
  notes: string;
  createdAt: string;
};

type PriceIndexWeight = {
  indexWeightId: string;
  basketVersionId: string;
  productId: string | null;
  categoryId: string | null;
  regionCode: string | null;
  weight: number;
  weightBasis: string;
};

export type MajorGoodsPriceIndexArtifacts = {
  sourceCatalog: SourceCatalogItem[];
  rawSnapshot: StageRawPayloadInput;
  sourceCursor: {
    sourceId: string;
    cursor: string;
  };
  categories: PriceWarehouseCategory[];
  products: PriceWarehouseProduct[];
  merchants: PriceWarehouseMerchant[];
  merchantLocations: PriceWarehouseLocation[];
  productAliases: PriceWarehouseAlias[];
  offers: PriceWarehouseOffer[];
  priceObservations: PriceWarehouseObservation[];
  rollupsDaily: PriceRollupDaily[];
  indexDefinitions: PriceIndexDefinition[];
  indexBasketVersions: PriceIndexBasketVersion[];
  indexWeights: PriceIndexWeight[];
  publicObservations: LiveObservation[];
};

export type SyncMajorGoodsPriceIndexResult = {
  job: "sync-major-goods-price-index";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncMajorGoodsPriceIndexOptions = IngestRunAuditOptions & {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  asOf?: string;
  endpoint?: string;
  fetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

const INDEX_SERIES: readonly MajorGoodsIndexSeriesDefinition[] = [
  {
    indexId: "major_goods_overall",
    seriesId: "prices.major_goods.overall.index",
    label: "Major Goods",
    categoryScope: "major_goods",
    weights: {
      "white-bread": 0.4,
      "milk-2l": 0.35,
      "dishwashing-liquid": 0.25
    }
  },
  {
    indexId: "major_goods_food",
    seriesId: "prices.major_goods.food.index",
    label: "Food",
    categoryScope: "food",
    weights: {
      "white-bread": 0.55,
      "milk-2l": 0.45
    }
  },
  {
    indexId: "major_goods_household_supplies",
    seriesId: "prices.major_goods.household_supplies.index",
    label: "Household Supplies",
    categoryScope: "household_supplies",
    weights: {
      "dishwashing-liquid": 1
    }
  }
] as const;

const PRODUCT_COHORT_METADATA: Record<
  string,
  {
    productFamilySlug: string;
    countryOfOrigin: string;
    isAustralianMade: boolean;
    manufacturerName: string;
    domesticValueShareBand: string;
    aiExposureLevel: "low" | "medium" | "high";
    aiExposureReason: string;
    comparableUnitBasis: string;
    isControlCandidate: boolean;
    cohortReady: boolean;
  }
> = {
  "white-bread": {
    productFamilySlug: "bakery-staples",
    countryOfOrigin: "AU",
    isAustralianMade: true,
    manufacturerName: "Local Bakery Network",
    domesticValueShareBand: "high",
    aiExposureLevel: "low",
    aiExposureReason: "Low direct AI leverage in standardized bakery production.",
    comparableUnitBasis: "per_kg",
    isControlCandidate: true,
    cohortReady: true
  },
  "milk-2l": {
    productFamilySlug: "dairy-staples",
    countryOfOrigin: "AU",
    isAustralianMade: true,
    manufacturerName: "Domestic Dairy Processor",
    domesticValueShareBand: "high",
    aiExposureLevel: "high",
    aiExposureReason:
      "AI exposure through forecasting, routing, packaging scheduling, and production planning.",
    comparableUnitBasis: "per_l",
    isControlCandidate: false,
    cohortReady: true
  },
  "dishwashing-liquid": {
    productFamilySlug: "cleaning-consumables",
    countryOfOrigin: "CN",
    isAustralianMade: false,
    manufacturerName: "Imported Household Supplier",
    domesticValueShareBand: "low",
    aiExposureLevel: "low",
    aiExposureReason: "Imported matched control product with low observed domestic AI linkage.",
    comparableUnitBasis: "per_l",
    isControlCandidate: true,
    cohortReady: true
  }
};

const MAJOR_GOODS_FIXTURE: readonly (Omit<MajorGoodsPricePoint, "observedAt"> & {
  fixtureDate: "base" | "current";
})[] = [
  {
    fixtureDate: "base",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "AU",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "ww-white-bread",
    externalOfferId: "ww-white-bread-au",
    priceAmount: 3.5,
    unitPriceAmount: 5,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/white-bread-au-base"
  },
  {
    fixtureDate: "base",
    merchantSlug: "coles",
    merchantName: "Coles",
    regionCode: "AU",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "coles-white-bread",
    externalOfferId: "coles-white-bread-au",
    priceAmount: 3.7,
    unitPriceAmount: 5.29,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.coles.com.au/product/white-bread-au-base"
  },
  {
    fixtureDate: "base",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "AU",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "milk-2l",
    canonicalName: "Full Cream Milk 2L",
    externalProductId: "ww-milk-2l",
    externalOfferId: "ww-milk-2l-au",
    priceAmount: 4.2,
    unitPriceAmount: 2.1,
    normalizedQuantity: 2,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/milk-2l-au-base"
  },
  {
    fixtureDate: "base",
    merchantSlug: "aldi",
    merchantName: "ALDI",
    regionCode: "AU",
    categorySlug: "household-supplies",
    categoryName: "Household Supplies",
    productSlug: "dishwashing-liquid",
    canonicalName: "Dishwashing Liquid 1L",
    externalProductId: "aldi-dishwashing-liquid",
    externalOfferId: "aldi-dishwashing-liquid-au",
    priceAmount: 3.8,
    unitPriceAmount: 3.8,
    normalizedQuantity: 1,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.aldi.com.au/groceries/dishwashing-liquid-au-base"
  },
  {
    fixtureDate: "current",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "AU",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "ww-white-bread",
    externalOfferId: "ww-white-bread-au",
    priceAmount: 3.85,
    unitPriceAmount: 5.5,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/white-bread-au-current"
  },
  {
    fixtureDate: "current",
    merchantSlug: "coles",
    merchantName: "Coles",
    regionCode: "AU",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "coles-white-bread",
    externalOfferId: "coles-white-bread-au",
    priceAmount: 4.05,
    unitPriceAmount: 5.79,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.coles.com.au/product/white-bread-au-current"
  },
  {
    fixtureDate: "current",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "AU",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "milk-2l",
    canonicalName: "Full Cream Milk 2L",
    externalProductId: "ww-milk-2l",
    externalOfferId: "ww-milk-2l-au",
    priceAmount: 4.4,
    unitPriceAmount: 2.2,
    normalizedQuantity: 2,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/milk-2l-au-current"
  },
  {
    fixtureDate: "current",
    merchantSlug: "aldi",
    merchantName: "ALDI",
    regionCode: "AU",
    categorySlug: "household-supplies",
    categoryName: "Household Supplies",
    productSlug: "dishwashing-liquid",
    canonicalName: "Dishwashing Liquid 1L",
    externalProductId: "aldi-dishwashing-liquid",
    externalOfferId: "aldi-dishwashing-liquid-au",
    priceAmount: 4.1,
    unitPriceAmount: 4.1,
    normalizedQuantity: 1,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.aldi.com.au/groceries/dishwashing-liquid-au-current"
  },
  {
    fixtureDate: "base",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "VIC",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "ww-white-bread-vic",
    externalOfferId: "ww-white-bread-vic",
    priceAmount: 3.4,
    unitPriceAmount: 4.86,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/white-bread-vic-base"
  },
  {
    fixtureDate: "base",
    merchantSlug: "coles",
    merchantName: "Coles",
    regionCode: "VIC",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "coles-white-bread-vic",
    externalOfferId: "coles-white-bread-vic",
    priceAmount: 3.6,
    unitPriceAmount: 5.14,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.coles.com.au/product/white-bread-vic-base"
  },
  {
    fixtureDate: "base",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "VIC",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "milk-2l",
    canonicalName: "Full Cream Milk 2L",
    externalProductId: "ww-milk-2l-vic",
    externalOfferId: "ww-milk-2l-vic",
    priceAmount: 4,
    unitPriceAmount: 2,
    normalizedQuantity: 2,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/milk-2l-vic-base"
  },
  {
    fixtureDate: "base",
    merchantSlug: "aldi",
    merchantName: "ALDI",
    regionCode: "VIC",
    categorySlug: "household-supplies",
    categoryName: "Household Supplies",
    productSlug: "dishwashing-liquid",
    canonicalName: "Dishwashing Liquid 1L",
    externalProductId: "aldi-dishwashing-liquid-vic",
    externalOfferId: "aldi-dishwashing-liquid-vic",
    priceAmount: 3.7,
    unitPriceAmount: 3.7,
    normalizedQuantity: 1,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.aldi.com.au/groceries/dishwashing-liquid-vic-base"
  },
  {
    fixtureDate: "current",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "VIC",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "ww-white-bread-vic",
    externalOfferId: "ww-white-bread-vic",
    priceAmount: 3.7,
    unitPriceAmount: 5.29,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/white-bread-vic-current"
  },
  {
    fixtureDate: "current",
    merchantSlug: "coles",
    merchantName: "Coles",
    regionCode: "VIC",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "white-bread",
    canonicalName: "White Bread 700g",
    externalProductId: "coles-white-bread-vic",
    externalOfferId: "coles-white-bread-vic",
    priceAmount: 3.9,
    unitPriceAmount: 5.57,
    normalizedQuantity: 0.7,
    normalizedUnit: "kg",
    priceType: "shelf",
    listingUrl: "https://www.coles.com.au/product/white-bread-vic-current"
  },
  {
    fixtureDate: "current",
    merchantSlug: "woolworths",
    merchantName: "Woolworths",
    regionCode: "VIC",
    categorySlug: "food",
    categoryName: "Food",
    productSlug: "milk-2l",
    canonicalName: "Full Cream Milk 2L",
    externalProductId: "ww-milk-2l-vic",
    externalOfferId: "ww-milk-2l-vic",
    priceAmount: 4.3,
    unitPriceAmount: 2.15,
    normalizedQuantity: 2,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.woolworths.com.au/shop/productdetails/milk-2l-vic-current"
  },
  {
    fixtureDate: "current",
    merchantSlug: "aldi",
    merchantName: "ALDI",
    regionCode: "VIC",
    categorySlug: "household-supplies",
    categoryName: "Household Supplies",
    productSlug: "dishwashing-liquid",
    canonicalName: "Dishwashing Liquid 1L",
    externalProductId: "aldi-dishwashing-liquid-vic",
    externalOfferId: "aldi-dishwashing-liquid-vic",
    priceAmount: 3.85,
    unitPriceAmount: 3.85,
    normalizedQuantity: 1,
    normalizedUnit: "l",
    priceType: "shelf",
    listingUrl: "https://www.aldi.com.au/groceries/dishwashing-liquid-vic-current"
  }
] as const;

function stableUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return 0;
  }

  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1]! + sorted[middleIndex]!) / 2;
  }

  return sorted[middleIndex] ?? 0;
}

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * percentileValue)));
  return sorted[index] ?? 0;
}

function buildFixturePointsOfType(
  fixtureDate: "base" | "current",
  observedAt: string,
  regions?: Set<string>
): MajorGoodsPricePoint[] {
  const targetObservedAt =
    fixtureDate === "base" ? `${BASE_PERIOD}T06:00:00Z` : observedAt;

  return MAJOR_GOODS_FIXTURE.filter(
    (point) =>
      point.fixtureDate === fixtureDate &&
      (regions === undefined || regions.has(point.regionCode))
  ).map(({ fixtureDate: _fixtureDate, ...point }) => ({
    ...point,
    observedAt: targetObservedAt
  }));
}

function buildFixturePoints(observedAt: string): MajorGoodsPricePoint[] {
  return [
    ...buildFixturePointsOfType("base", observedAt),
    ...buildFixturePointsOfType("current", observedAt)
  ];
}

export function buildMajorGoodsPriceIndexArtifacts(input: {
  observedDate?: string;
  points?: MajorGoodsPricePoint[];
  snapshotObservedAt?: string;
  ingestedAt: string;
}): MajorGoodsPriceIndexArtifacts {
  const observedAt =
    input.snapshotObservedAt ??
    `${(input.observedDate ?? input.ingestedAt.slice(0, 10))}T06:00:00Z`;
  const points = input.points ?? buildFixturePoints(observedAt);
  const categoriesBySlug = new Map<string, PriceWarehouseCategory>();
  const productsBySlug = new Map<string, PriceWarehouseProduct>();
  const merchantsBySlug = new Map<string, PriceWarehouseMerchant>();
  const locationsByKey = new Map<string, PriceWarehouseLocation>();
  const aliasesByKey = new Map<string, PriceWarehouseAlias>();
  const offersByKey = new Map<string, PriceWarehouseOffer>();
  const priceObservationRows: PriceWarehouseObservation[] = [];

  for (const point of points) {
    const categoryId = stableUuid(`category:${point.categorySlug}`);
    const productId = stableUuid(`product:${point.productSlug}`);
    const merchantId = stableUuid(`merchant:${point.merchantSlug}`);
    const locationKey = `${point.merchantSlug}:${point.regionCode}`;
    const locationId = stableUuid(`location:${locationKey}`);
    const productAliasKey = `${SOURCE_ID}:${point.merchantSlug}:${point.externalProductId}`;
    const productAliasId = stableUuid(`alias:${productAliasKey}`);
    const offerKey = `${SOURCE_ID}:${point.merchantSlug}:${point.externalOfferId}`;
    const offerId = stableUuid(`offer:${offerKey}`);
    const observedDate = point.observedAt.slice(0, 10);
    const cohortMetadata = PRODUCT_COHORT_METADATA[point.productSlug] ?? {
      productFamilySlug: point.productSlug,
      countryOfOrigin: "unknown",
      isAustralianMade: false,
      manufacturerName: point.merchantName,
      domesticValueShareBand: "unknown",
      aiExposureLevel: "low" as const,
      aiExposureReason: "Unclassified product metadata fallback.",
      comparableUnitBasis: `per_${point.normalizedUnit}`,
      isControlCandidate: false,
      cohortReady: false
    };

    categoriesBySlug.set(point.categorySlug, {
      categoryId,
      slug: point.categorySlug,
      name: point.categoryName,
      parentCategoryId: null,
      absCpiCode: null,
      absCpiLevel: null,
      isMajorGood: true,
      createdAt: input.ingestedAt,
      updatedAt: input.ingestedAt
    });

    productsBySlug.set(point.productSlug, {
      productId,
      categoryId,
      slug: point.productSlug,
      productFamilySlug: cohortMetadata.productFamilySlug,
      canonicalName: point.canonicalName,
      brand: null,
      variant: null,
      sizeValue: point.normalizedQuantity,
      sizeUnit: point.normalizedUnit,
      packCount: 1,
      normalizedQuantity: point.normalizedQuantity,
      normalizedUnit: point.normalizedUnit,
      countryOfOrigin: cohortMetadata.countryOfOrigin,
      isAustralianMade: cohortMetadata.isAustralianMade,
      manufacturerName: cohortMetadata.manufacturerName,
      domesticValueShareBand: cohortMetadata.domesticValueShareBand,
      aiExposureLevel: cohortMetadata.aiExposureLevel,
      aiExposureReason: cohortMetadata.aiExposureReason,
      comparableUnitBasis: cohortMetadata.comparableUnitBasis,
      isControlCandidate: cohortMetadata.isControlCandidate,
      cohortReady: cohortMetadata.cohortReady,
      gtin: null,
      isActive: true,
      createdAt: input.ingestedAt,
      updatedAt: input.ingestedAt
    });

    merchantsBySlug.set(point.merchantSlug, {
      merchantId,
      slug: point.merchantSlug,
      name: point.merchantName,
      merchantType: "supermarket",
      websiteUrl: point.listingUrl ?? null,
      countryCode: "AU",
      isActive: true,
      createdAt: input.ingestedAt,
      updatedAt: input.ingestedAt
    });

    locationsByKey.set(locationKey, {
      locationId,
      merchantId,
      locationCode: `${point.merchantSlug}-${point.regionCode.toLowerCase()}`,
      name: `${point.merchantName} ${point.regionCode}`,
      regionCode: point.regionCode,
      postcode: null,
      suburb: null,
      state: point.regionCode === "AU" ? null : point.regionCode,
      latitude: null,
      longitude: null,
      isOnlineOnly: point.regionCode === "AU",
      openedAt: null,
      closedAt: null
    });

    aliasesByKey.set(productAliasKey, {
      productAliasId,
      sourceId: SOURCE_ID,
      merchantId,
      externalProductId: point.externalProductId,
      externalSku: null,
      productId,
      matchConfidence: "high",
      matchMethod: "fixture_exact",
      firstSeenAt: point.observedAt,
      lastSeenAt: point.observedAt
    });

    offersByKey.set(offerKey, {
      offerId,
      sourceId: SOURCE_ID,
      merchantId,
      locationId,
      productAliasId,
      productId,
      externalOfferId: point.externalOfferId,
      listingUrl: point.listingUrl ?? null,
      sellerSku: null,
      currency: "AUD",
      taxStatus: "incl_tax",
      unitCount: 1,
      unitSizeValue: point.normalizedQuantity,
      unitSizeMeasure: point.normalizedUnit,
      isActive: true,
      firstSeenAt: point.observedAt,
      lastSeenAt: point.observedAt
    });

    priceObservationRows.push({
      priceObservationId: stableUuid(
        `price-observation:${offerId}:${point.observedAt}:${point.priceType}`
      ),
      offerId,
      productId,
      merchantId,
      locationId,
      regionCode: point.regionCode,
      observedAt: point.observedAt,
      observedDate,
      availabilityStatus: "available",
      inStock: true,
      priceType: point.priceType,
      priceAmount: point.priceAmount,
      currency: "AUD",
      unitPriceAmount: point.unitPriceAmount,
      unitPriceUnit: `aud_per_${point.normalizedUnit}`,
      promoLabel: null,
      multibuyQuantity: null,
      multibuyTotalAmount: null,
      effectiveFrom: observedDate,
      effectiveTo: null,
      sourceRunId: null,
      rawSnapshotId: null,
      observedChecksum: checksum(
        JSON.stringify({
          offerId,
          observedAt: point.observedAt,
          priceType: point.priceType,
          priceAmount: point.priceAmount
        })
      ),
      qualityFlag: "verified",
      createdAt: input.ingestedAt
    });
  }

  const rollupMap = new Map<string, PriceWarehouseObservation[]>();
  for (const row of priceObservationRows) {
    const product = [...productsBySlug.values()].find((entry) => entry.productId === row.productId)!;
    const key = `${row.observedDate}|${row.regionCode}|${product.slug}`;
    const existing = rollupMap.get(key);
    if (existing) {
      existing.push(row);
    } else {
      rollupMap.set(key, [row]);
    }
  }

  const rollupsDaily = [...rollupMap.entries()].map(([key, rows]) => {
    const [rollupDate, regionCode, productSlug] = key.split("|");
    const product = productsBySlug.get(productSlug)!;
    const category = [...categoriesBySlug.values()].find(
      (entry) => entry.categoryId === product.categoryId
    )!;
    const prices = rows.map((row) => row.priceAmount).sort((left, right) => left - right);
    const unitPrices = rows
      .map((row) => row.unitPriceAmount)
      .sort((left, right) => left - right);
    const distinctOfferCount = new Set(rows.map((row) => row.offerId)).size;

    return {
      rollupId: stableUuid(`rollup:${rollupDate}:${regionCode}:${productSlug}`),
      rollupDate,
      productId: product.productId,
      productSlug,
      categoryId: category.categoryId,
      categorySlug: category.slug,
      regionCode,
      merchantId: null,
      sampleSize: rows.length,
      distinctOfferCount,
      minPrice: round(prices[0] ?? 0, 2),
      maxPrice: round(prices[prices.length - 1] ?? 0, 2),
      meanPrice: round(average(prices), 2),
      medianPrice: round(median(prices), 2),
      p25Price: round(percentile(prices, 0.25), 2),
      p75Price: round(percentile(prices, 0.75), 2),
      meanUnitPrice: round(average(unitPrices), 2),
      medianUnitPrice: round(median(unitPrices), 2),
      methodologyVersion: METHODOLOGY_VERSION,
      computedAt: input.ingestedAt
    };
  });

  const indexDefinitions = INDEX_SERIES.map((definition) => ({
    indexId: definition.indexId,
    name: definition.label,
    description: `${definition.label} major goods price index.`,
    categoryScope: definition.categoryScope,
    geographyLevel: "region",
    frequency: "daily",
    basePeriod: BASE_PERIOD,
    baseValue: BASE_VALUE,
    aggregationMethod: "weighted_price_relative",
    publishedSeriesId: definition.seriesId,
    isPublic: true,
    createdAt: input.ingestedAt,
    updatedAt: input.ingestedAt
  }));

  const indexBasketVersions = INDEX_SERIES.map((definition) => ({
    basketVersionId: stableUuid(`basket:${definition.indexId}:${BASE_PERIOD}`),
    indexId: definition.indexId,
    effectiveFrom: BASE_PERIOD,
    effectiveTo: null,
    weightSource: "fixture_basket_v1",
    methodologyVersion: METHODOLOGY_VERSION,
    notes: "Fixture basket for major goods daily price index coverage.",
    createdAt: input.ingestedAt
  }));

  const indexWeights = INDEX_SERIES.flatMap((definition) => {
    const basketVersionId = stableUuid(`basket:${definition.indexId}:${BASE_PERIOD}`);
    return Object.entries(definition.weights).map(([productSlug, weight]) => ({
      indexWeightId: stableUuid(`weight:${definition.indexId}:${productSlug}`),
      basketVersionId,
      productId: productsBySlug.get(productSlug)!.productId,
      categoryId: null,
      regionCode: null,
      weight,
      weightBasis: "basket_share"
    }));
  });

  const baseRollups = new Map(
    rollupsDaily
      .filter((row) => row.rollupDate === BASE_PERIOD)
      .map((row) => [`${row.regionCode}:${row.productSlug}`, row] as const)
  );
  const currentRollups = new Map(
    rollupsDaily.map((row) => [`${row.rollupDate}:${row.regionCode}:${row.productSlug}`, row] as const)
  );
  const regions = [...new Set(rollupsDaily.map((row) => row.regionCode))];
  const dates = [...new Set(rollupsDaily.map((row) => row.rollupDate))].sort();

  const publicObservations: LiveObservation[] = [];
  for (const definition of INDEX_SERIES) {
    for (const regionCode of regions) {
      for (const date of dates) {
        let weightedValue = 0;
        let totalWeight = 0;

        for (const [productSlug, weight] of Object.entries(definition.weights)) {
          const baseRollup = baseRollups.get(`${regionCode}:${productSlug}`);
          const currentRollup = currentRollups.get(`${date}:${regionCode}:${productSlug}`);
          if (!baseRollup || !currentRollup || baseRollup.medianPrice === 0) {
            continue;
          }
          weightedValue += (currentRollup.medianPrice / baseRollup.medianPrice) * weight;
          totalWeight += weight;
        }

        if (totalWeight === 0) {
          continue;
        }

        publicObservations.push({
          seriesId: definition.seriesId,
          regionCode,
          market: "major_goods",
          metricFamily: "prices",
          date,
          value: round((weightedValue / totalWeight) * BASE_VALUE, 2),
          unit: "index",
          sourceName: SOURCE_ITEM.name,
          sourceUrl: SOURCE_ITEM.url,
          publishedAt: input.ingestedAt,
          ingestedAt: input.ingestedAt,
          vintage: input.ingestedAt.slice(0, 10),
          isModeled: false,
          confidence: "derived",
          methodologyVersion: METHODOLOGY_VERSION
        });
      }
    }
  }

  const productValuesByRegionDate = new Map<string, number>();
  for (const date of dates) {
    for (const regionCode of regions) {
      for (const [productSlug, product] of productsBySlug.entries()) {
        if (!product.cohortReady) {
          continue;
        }

        const baseRollup = baseRollups.get(`${regionCode}:${productSlug}`);
        const currentRollup = currentRollups.get(`${date}:${regionCode}:${productSlug}`);
        if (!baseRollup || !currentRollup || baseRollup.medianPrice === 0) {
          continue;
        }

        productValuesByRegionDate.set(
          `${date}:${regionCode}:${productSlug}`,
          round((currentRollup.medianPrice / baseRollup.medianPrice) * BASE_VALUE, 2)
        );
      }
    }
  }

  const cohortDefinitions = [
    {
      seriesId: "prices.au_made.all.index",
      label: "AU-made All",
      select: (product: PriceWarehouseProduct) => product.cohortReady && product.isAustralianMade
    },
    {
      seriesId: "prices.au_made.ai_exposed.index",
      label: "AU-made AI Exposed",
      select: (product: PriceWarehouseProduct) =>
        product.cohortReady && product.isAustralianMade && product.aiExposureLevel === "high"
    },
    {
      seriesId: "prices.au_made.control.index",
      label: "AU-made Control",
      select: (product: PriceWarehouseProduct) =>
        product.cohortReady && product.isAustralianMade && product.isControlCandidate
    },
    {
      seriesId: "prices.imported.matched_control.index",
      label: "Imported Matched Control",
      select: (product: PriceWarehouseProduct) =>
        product.cohortReady && !product.isAustralianMade && product.isControlCandidate
    }
  ] as const;

  for (const definition of cohortDefinitions) {
    const cohortProducts = [...productsBySlug.values()].filter(definition.select);
    for (const regionCode of regions) {
      for (const date of dates) {
        const values = cohortProducts
          .map((product) => productValuesByRegionDate.get(`${date}:${regionCode}:${product.slug}`))
          .filter((value): value is number => value !== undefined);
        if (values.length === 0) {
          continue;
        }

        publicObservations.push({
          seriesId: definition.seriesId,
          regionCode,
          market: "ai_deflation",
          metricFamily: "prices",
          date,
          value: round(average(values), 2),
          unit: "index",
          sourceName: SOURCE_ITEM.name,
          sourceUrl: SOURCE_ITEM.url,
          publishedAt: input.ingestedAt,
          ingestedAt: input.ingestedAt,
          vintage: input.ingestedAt.slice(0, 10),
          isModeled: false,
          confidence: "derived",
          methodologyVersion: METHODOLOGY_VERSION
        });
      }
    }
  }

  for (const regionCode of regions) {
    for (const date of dates) {
      const aiExposed = publicObservations.find(
        (item) =>
          item.seriesId === "prices.au_made.ai_exposed.index" &&
          item.regionCode === regionCode &&
          item.date === date
      );
      const control = publicObservations.find(
        (item) =>
          item.seriesId === "prices.au_made.control.index" &&
          item.regionCode === regionCode &&
          item.date === date
      );
      if (!aiExposed || !control) {
        continue;
      }

      publicObservations.push({
        seriesId: "prices.ai_deflation.spread.au_made_vs_control.index",
        regionCode,
        market: "ai_deflation",
        metricFamily: "prices",
        date,
        value: round(aiExposed.value - control.value, 2),
        unit: "index_points",
        sourceName: SOURCE_ITEM.name,
        sourceUrl: SOURCE_ITEM.url,
        publishedAt: input.ingestedAt,
        ingestedAt: input.ingestedAt,
        vintage: input.ingestedAt.slice(0, 10),
        isModeled: false,
        confidence: "derived",
        methodologyVersion: METHODOLOGY_VERSION
      });
    }
  }

  return {
    sourceCatalog: [SOURCE_ITEM],
    rawSnapshot: {
      sourceId: SOURCE_ID,
      payload: JSON.stringify({
        observed_at: observedAt,
        items: points.filter((point) => point.observedAt === observedAt)
      }),
      contentType: "application/json",
      capturedAt: input.ingestedAt
    },
    sourceCursor: {
      sourceId: SOURCE_ID,
      cursor: observedAt
    },
    categories: [...categoriesBySlug.values()],
    products: [...productsBySlug.values()],
    merchants: [...merchantsBySlug.values()],
    merchantLocations: [...locationsByKey.values()],
    productAliases: [...aliasesByKey.values()],
    offers: [...offersByKey.values()],
    priceObservations: priceObservationRows,
    rollupsDaily,
    indexDefinitions,
    indexBasketVersions,
    indexWeights,
    publicObservations
  };
}

export async function syncMajorGoodsPriceIndex(
  options: SyncMajorGoodsPriceIndexOptions = {}
): Promise<SyncMajorGoodsPriceIndexResult> {
  const ingestedAt = options.asOf ?? new Date().toISOString();
  const observedDate = ingestedAt.slice(0, 10);
  const startedAt = ingestedAt;
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let artifacts: MajorGoodsPriceIndexArtifacts;

  if (useLiveSource) {
    const snapshot = await fetchMajorGoodsPriceSnapshot({
      endpoint: options.endpoint,
      fetchImpl: options.fetchImpl
    });

    const liveRegions = new Set(snapshot.points.map((point) => point.regionCode));
    const basePoints =
      liveRegions.size === 0
        ? []
        : buildFixturePointsOfType("base", snapshot.observedAt, liveRegions);

    artifacts = buildMajorGoodsPriceIndexArtifacts({
      points: [...basePoints, ...snapshot.points],
      snapshotObservedAt: snapshot.observedAt,
      ingestedAt
    });
    artifacts = {
      ...artifacts,
      rawSnapshot: {
        sourceId: SOURCE_ID,
        payload: snapshot.rawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    };
  } else {
    artifacts = buildMajorGoodsPriceIndexArtifacts({
      observedDate,
      ingestedAt
    });
  }

  if (ingestBackend === "postgres") {
    await persistMajorGoodsPriceWarehouseInPostgres(artifacts);
  }

  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: artifacts.sourceCatalog,
    rawSnapshots: [artifacts.rawSnapshot],
    observations: artifacts.publicObservations,
    sourceCursors: [artifacts.sourceCursor],
    ingestionRun: {
      job: "sync-major-goods-price-index-daily",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-major-goods-price-index",
    status: "ok",
    pointsIngested: artifacts.priceObservations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: ingestedAt
  };
}
