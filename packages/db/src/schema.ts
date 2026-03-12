import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    regionType: text("region_type").notNull(),
    regionCode: text("region_code").notNull(),
    name: text("name").notNull(),
    parentRegionCode: text("parent_region_code")
  },
  (table) => ({
    regionsCodeUnique: unique("regions_region_code_unique").on(table.regionCode)
  })
);

export const series = pgTable("series", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  frequency: text("frequency").notNull(),
  source: text("source").notNull(),
  sourceSeriesCode: text("source_series_code")
});

export const observations = pgTable(
  "observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seriesId: text("series_id").notNull(),
    regionCode: text("region_code").notNull(),
    countryCode: text("country_code"),
    market: text("market"),
    metricFamily: text("metric_family"),
    date: text("date").notNull(),
    intervalStartUtc: timestamp("interval_start_utc", { withTimezone: true }),
    intervalEndUtc: timestamp("interval_end_utc", { withTimezone: true }),
    value: numeric("value", { precision: 20, scale: 6 }).notNull(),
    unit: text("unit").notNull(),
    currency: text("currency"),
    taxStatus: text("tax_status"),
    consumptionBand: text("consumption_band"),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
    vintage: text("vintage").notNull(),
    isModeled: boolean("is_modeled").notNull().default(false),
    confidence: text("confidence").notNull(),
    methodologyVersion: text("methodology_version")
  },
  (table) => ({
    observationsUnique: unique("observations_series_region_date_vintage_unique").on(
      table.seriesId,
      table.regionCode,
      table.date,
      table.vintage
    ),
    observationsSeriesRegionDateIdx: index("observations_series_region_date_idx").on(
      table.seriesId,
      table.regionCode,
      table.date
    ),
    observationsCountryMetricDateIdx: index("observations_country_metric_date_idx").on(
      table.countryCode,
      table.metricFamily,
      table.date
    )
  })
);

export const sources = pgTable("sources", {
  sourceId: text("source_id").primaryKey(),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  expectedCadence: text("expected_cadence").notNull()
});

export const sourceCursors = pgTable("source_cursors", {
  sourceId: text("source_id").primaryKey(),
  cursor: text("cursor").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    runId: text("run_id").primaryKey(),
    job: text("job").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    rowsInserted: integer("rows_inserted").notNull(),
    rowsUpdated: integer("rows_updated").notNull(),
    errorSummary: text("error_summary"),
    bullJobId: text("bull_job_id"),
    queueName: text("queue_name"),
    attempt: integer("attempt"),
    runMode: text("run_mode")
  },
  (table) => ({
    ingestionRunsJobIdx: index("ingestion_runs_job_idx").on(table.job, table.finishedAt),
    ingestionRunsQueueJobIdx: index("ingestion_runs_queue_job_idx").on(
      table.queueName,
      table.job,
      table.finishedAt
    )
  })
);

export const rawSnapshots = pgTable(
  "raw_snapshots",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    sourceId: text("source_id").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    contentType: text("content_type").notNull(),
    payload: text("payload").notNull()
  },
  (table) => ({
    rawSnapshotsSourceChecksumUnique: unique(
      "raw_snapshots_source_checksum_unique"
    ).on(table.sourceId, table.checksumSha256)
  })
);

export const productCategories = pgTable(
  "product_categories",
  {
    categoryId: uuid("category_id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentCategoryId: uuid("parent_category_id").references(
      (): AnyPgColumn => productCategories.categoryId
    ),
    absCpiCode: text("abs_cpi_code"),
    absCpiLevel: text("abs_cpi_level"),
    isMajorGood: boolean("is_major_good").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    productCategoriesSlugUnique: unique("product_categories_slug_unique").on(table.slug)
  })
);

export const products = pgTable(
  "products",
  {
    productId: uuid("product_id").primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.categoryId),
    slug: text("slug").notNull(),
    productFamilySlug: text("product_family_slug"),
    canonicalName: text("canonical_name").notNull(),
    brand: text("brand"),
    variant: text("variant"),
    sizeValue: numeric("size_value", { precision: 12, scale: 4 }),
    sizeUnit: text("size_unit"),
    packCount: integer("pack_count"),
    normalizedQuantity: numeric("normalized_quantity", { precision: 12, scale: 4 }),
    normalizedUnit: text("normalized_unit"),
    countryOfOrigin: text("country_of_origin"),
    isAustralianMade: boolean("is_australian_made"),
    manufacturerName: text("manufacturer_name"),
    domesticValueShareBand: text("domestic_value_share_band"),
    aiExposureLevel: text("ai_exposure_level"),
    aiExposureReason: text("ai_exposure_reason"),
    comparableUnitBasis: text("comparable_unit_basis"),
    isControlCandidate: boolean("is_control_candidate").notNull().default(false),
    cohortReady: boolean("cohort_ready").notNull().default(false),
    gtin: text("gtin"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    productsSlugUnique: unique("products_slug_unique").on(table.slug),
    productsCategoryIdx: index("products_category_idx").on(table.categoryId),
    productsGtinIdx: index("products_gtin_idx").on(table.gtin),
    productsIdentityUnique: uniqueIndex("products_identity_unique").on(
      sql`lower(${table.canonicalName})`,
      sql`coalesce(lower(${table.brand}), '')`,
      sql`coalesce(lower(${table.variant}), '')`,
      sql`coalesce(${table.sizeValue}, 0)`,
      sql`coalesce(lower(${table.sizeUnit}), '')`
    )
  })
);

export const merchants = pgTable(
  "merchants",
  {
    merchantId: uuid("merchant_id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    merchantType: text("merchant_type").notNull(),
    websiteUrl: text("website_url"),
    countryCode: text("country_code").notNull().default("AU"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    merchantsSlugUnique: unique("merchants_slug_unique").on(table.slug)
  })
);

export const merchantLocations = pgTable(
  "merchant_locations",
  {
    locationId: uuid("location_id").primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.merchantId),
    locationCode: text("location_code"),
    name: text("name"),
    regionCode: text("region_code")
      .notNull()
      .references(() => regions.regionCode),
    postcode: text("postcode"),
    suburb: text("suburb"),
    state: text("state"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    isOnlineOnly: boolean("is_online_only").notNull().default(false),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true })
  },
  (table) => ({
    merchantLocationsMerchantRegionIdx: index("merchant_locations_merchant_region_idx").on(
      table.merchantId,
      table.regionCode
    ),
    merchantLocationsRegionIdx: index("merchant_locations_region_idx").on(table.regionCode),
    merchantLocationsMerchantLocationUnique: uniqueIndex(
      "merchant_locations_merchant_location_unique"
    ).on(table.merchantId, sql`coalesce(${table.locationCode}, '')`)
  })
);

export const productAliases = pgTable(
  "product_aliases",
  {
    productAliasId: uuid("product_alias_id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.sourceId),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.merchantId),
    externalProductId: text("external_product_id").notNull(),
    externalSku: text("external_sku"),
    productId: uuid("product_id").references(() => products.productId),
    matchConfidence: text("match_confidence").notNull(),
    matchMethod: text("match_method").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    productAliasesSourceMerchantExternalUnique: unique(
      "product_aliases_source_merchant_external_unique"
    ).on(table.sourceId, table.merchantId, table.externalProductId),
    productAliasesProductIdx: index("product_aliases_product_idx").on(table.productId)
  })
);

export const offers = pgTable(
  "offers",
  {
    offerId: uuid("offer_id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.sourceId),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.merchantId),
    locationId: uuid("location_id").references(() => merchantLocations.locationId),
    productAliasId: uuid("product_alias_id").references(() => productAliases.productAliasId),
    productId: uuid("product_id").references(() => products.productId),
    externalOfferId: text("external_offer_id").notNull(),
    listingUrl: text("listing_url"),
    sellerSku: text("seller_sku"),
    currency: text("currency").notNull().default("AUD"),
    taxStatus: text("tax_status").notNull().default("incl_tax"),
    unitCount: integer("unit_count"),
    unitSizeValue: numeric("unit_size_value", { precision: 12, scale: 4 }),
    unitSizeMeasure: text("unit_size_measure"),
    isActive: boolean("is_active").notNull().default(true),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    offersSourceMerchantExternalUnique: unique("offers_source_merchant_external_unique").on(
      table.sourceId,
      table.merchantId,
      table.externalOfferId
    ),
    offersProductIdx: index("offers_product_idx").on(table.productId),
    offersMerchantLocationIdx: index("offers_merchant_location_idx").on(
      table.merchantId,
      table.locationId
    ),
    offersProductAliasIdx: index("offers_product_alias_idx").on(table.productAliasId)
  })
);

export const priceObservations = pgTable(
  "price_observations",
  {
    priceObservationId: uuid("price_observation_id").primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.offerId),
    productId: uuid("product_id").references(() => products.productId),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.merchantId),
    locationId: uuid("location_id").references(() => merchantLocations.locationId),
    regionCode: text("region_code")
      .notNull()
      .references(() => regions.regionCode),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    observedDate: date("observed_date").notNull(),
    availabilityStatus: text("availability_status"),
    inStock: boolean("in_stock"),
    priceType: text("price_type").notNull(),
    priceAmount: numeric("price_amount", { precision: 12, scale: 4 }).notNull(),
    currency: text("currency").notNull().default("AUD"),
    unitPriceAmount: numeric("unit_price_amount", { precision: 12, scale: 6 }),
    unitPriceUnit: text("unit_price_unit"),
    promoLabel: text("promo_label"),
    multibuyQuantity: integer("multibuy_quantity"),
    multibuyTotalAmount: numeric("multibuy_total_amount", { precision: 12, scale: 4 }),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    sourceRunId: text("source_run_id").references(() => ingestionRuns.runId),
    rawSnapshotId: text("raw_snapshot_id").references(() => rawSnapshots.snapshotId),
    observedChecksum: text("observed_checksum"),
    qualityFlag: text("quality_flag"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    priceObservationsOfferObservedPriceTypeUnique: unique(
      "price_observations_offer_observed_price_type_unique"
    ).on(table.offerId, table.observedAt, table.priceType),
    priceObservationsProductDateRegionIdx: index(
      "price_observations_product_date_region_idx"
    ).on(table.productId, table.observedDate, table.regionCode),
    priceObservationsMerchantDateRegionIdx: index(
      "price_observations_merchant_date_region_idx"
    ).on(table.merchantId, table.observedDate, table.regionCode),
    priceObservationsRegionDateIdx: index("price_observations_region_date_idx").on(
      table.regionCode,
      table.observedDate
    ),
    priceObservationsObservedAtIdx: index("price_observations_observed_at_idx").on(
      table.observedAt
    )
  })
);

export const priceRollupsDaily = pgTable(
  "price_rollups_daily",
  {
    rollupId: uuid("rollup_id").primaryKey(),
    rollupDate: date("rollup_date").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.categoryId),
    regionCode: text("region_code")
      .notNull()
      .references(() => regions.regionCode),
    merchantId: uuid("merchant_id").references(() => merchants.merchantId),
    sampleSize: integer("sample_size").notNull(),
    distinctOfferCount: integer("distinct_offer_count").notNull(),
    minPrice: numeric("min_price", { precision: 12, scale: 4 }).notNull(),
    maxPrice: numeric("max_price", { precision: 12, scale: 4 }).notNull(),
    meanPrice: numeric("mean_price", { precision: 12, scale: 4 }).notNull(),
    medianPrice: numeric("median_price", { precision: 12, scale: 4 }).notNull(),
    p25Price: numeric("p25_price", { precision: 12, scale: 4 }),
    p75Price: numeric("p75_price", { precision: 12, scale: 4 }),
    meanUnitPrice: numeric("mean_unit_price", { precision: 12, scale: 6 }),
    medianUnitPrice: numeric("median_unit_price", { precision: 12, scale: 6 }),
    methodologyVersion: text("methodology_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    priceRollupsDailyProductRegionDateIdx: index(
      "price_rollups_daily_product_region_date_idx"
    ).on(table.productId, table.regionCode, table.rollupDate),
    priceRollupsDailyCategoryRegionDateIdx: index(
      "price_rollups_daily_category_region_date_idx"
    ).on(table.categoryId, table.regionCode, table.rollupDate),
    priceRollupsDailyIdentityUnique: uniqueIndex("price_rollups_daily_identity_unique").on(
      table.rollupDate,
      table.productId,
      table.regionCode,
      sql`coalesce(${table.merchantId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.methodologyVersion
    )
  })
);

export const indexDefinitions = pgTable(
  "index_definitions",
  {
    indexId: text("index_id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    categoryScope: text("category_scope").notNull(),
    geographyLevel: text("geography_level").notNull(),
    frequency: text("frequency").notNull(),
    basePeriod: text("base_period").notNull(),
    baseValue: numeric("base_value", { precision: 12, scale: 4 }).notNull().default("100"),
    aggregationMethod: text("aggregation_method").notNull(),
    publishedSeriesId: text("published_series_id"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    indexDefinitionsPublishedSeriesUnique: unique(
      "index_definitions_published_series_unique"
    ).on(table.publishedSeriesId)
  })
);

export const indexBasketVersions = pgTable(
  "index_basket_versions",
  {
    basketVersionId: uuid("basket_version_id").primaryKey(),
    indexId: text("index_id")
      .notNull()
      .references(() => indexDefinitions.indexId),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    weightSource: text("weight_source").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    indexBasketVersionsIndexEffectiveFromIdx: index(
      "index_basket_versions_index_effective_from_idx"
    ).on(table.indexId, table.effectiveFrom)
  })
);

export const indexWeights = pgTable(
  "index_weights",
  {
    indexWeightId: uuid("index_weight_id").primaryKey(),
    basketVersionId: uuid("basket_version_id")
      .notNull()
      .references(() => indexBasketVersions.basketVersionId),
    productId: uuid("product_id").references(() => products.productId),
    categoryId: uuid("category_id").references(() => productCategories.categoryId),
    regionCode: text("region_code").references(() => regions.regionCode),
    weight: numeric("weight", { precision: 18, scale: 8 }).notNull(),
    weightBasis: text("weight_basis").notNull()
  },
  (table) => ({
    indexWeightsBasketIdx: index("index_weights_basket_idx").on(table.basketVersionId),
    indexWeightsIdentityUnique: uniqueIndex("index_weights_identity_unique").on(
      table.basketVersionId,
      sql`coalesce(${table.productId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.categoryId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${table.regionCode}, 'AU')`
    ),
    indexWeightsProductOrCategoryCheck: check(
      "index_weights_product_or_category_check",
      sql`(${table.productId} is not null or ${table.categoryId} is not null) and not (${table.productId} is not null and ${table.categoryId} is not null)`
    )
  })
);

export const scenarios = pgTable("scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  paramsJson: text("params_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const watchlistItems = pgTable("watchlist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  regionCode: text("region_code").notNull(),
  label: text("label").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  confidence: text("confidence").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull()
});
