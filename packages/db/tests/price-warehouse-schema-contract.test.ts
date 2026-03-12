import { describe, expect, test } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  indexBasketVersions,
  indexDefinitions,
  indexWeights,
  merchantLocations,
  merchants,
  offers,
  priceObservations,
  priceRollupsDaily,
  productAliases,
  productCategories,
  products
} from "../src/schema";

describe("price warehouse schema contracts", () => {
  test("defines canonical warehouse dimensions and fact tables", () => {
    expect(productCategories.categoryId).toBeDefined();
    expect(productCategories.slug).toBeDefined();
    expect(products.productId).toBeDefined();
    expect(products.categoryId).toBeDefined();
    expect(productAliases.productAliasId).toBeDefined();
    expect(productAliases.externalProductId).toBeDefined();
    expect(merchants.merchantId).toBeDefined();
    expect(merchantLocations.locationId).toBeDefined();
    expect(offers.offerId).toBeDefined();
    expect(priceObservations.priceObservationId).toBeDefined();
    expect(priceRollupsDaily.rollupId).toBeDefined();
    expect(indexDefinitions.indexId).toBeDefined();
    expect(indexBasketVersions.basketVersionId).toBeDefined();
    expect(indexWeights.indexWeightId).toBeDefined();
  });

  test("products support cohort metadata for AI-deflation publication", () => {
    expect(products.productFamilySlug).toBeDefined();
    expect(products.countryOfOrigin).toBeDefined();
    expect(products.isAustralianMade).toBeDefined();
    expect(products.manufacturerName).toBeDefined();
    expect(products.domesticValueShareBand).toBeDefined();
    expect(products.aiExposureLevel).toBeDefined();
    expect(products.aiExposureReason).toBeDefined();
    expect(products.comparableUnitBasis).toBeDefined();
    expect(products.isControlCandidate).toBeDefined();
    expect(products.cohortReady).toBeDefined();
  });

  test("preserves idempotent uniqueness keys for price aliases, offers, and observations", () => {
    const aliasConfig = getTableConfig(productAliases);
    const offerConfig = getTableConfig(offers);
    const observationConfig = getTableConfig(priceObservations);

    expect(
      aliasConfig.uniqueConstraints.find(
        (entry) => entry.name === "product_aliases_source_merchant_external_unique"
      )?.columns.map((column) => column.name)
    ).toEqual(["source_id", "merchant_id", "external_product_id"]);

    expect(
      offerConfig.uniqueConstraints.find(
        (entry) => entry.name === "offers_source_merchant_external_unique"
      )?.columns.map((column) => column.name)
    ).toEqual(["source_id", "merchant_id", "external_offer_id"]);

    expect(
      observationConfig.uniqueConstraints.find(
        (entry) => entry.name === "price_observations_offer_observed_price_type_unique"
      )?.columns.map((column) => column.name)
    ).toEqual(["offer_id", "observed_at", "price_type"]);
  });

  test("indexes rollups and published index metadata for read-heavy queries", () => {
    const rollupConfig = getTableConfig(priceRollupsDaily);
    const definitionConfig = getTableConfig(indexDefinitions);
    const basketConfig = getTableConfig(indexBasketVersions);

    expect(rollupConfig.indexes.map((entry) => entry.config.name)).toEqual(
      expect.arrayContaining([
        "price_rollups_daily_product_region_date_idx",
        "price_rollups_daily_category_region_date_idx"
      ])
    );
    expect(definitionConfig.uniqueConstraints.map((entry) => entry.name)).toContain(
      "index_definitions_published_series_unique"
    );
    expect(basketConfig.indexes.map((entry) => entry.config.name)).toContain(
      "index_basket_versions_index_effective_from_idx"
    );
  });
});
