import {
  getDb,
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
} from "@aus-dash/db";
import { sql } from "drizzle-orm";
import type { MajorGoodsPriceIndexArtifacts } from "../jobs/sync-major-goods-price-index";
import {
  ensureSourceCatalogInPostgres,
  stageRawPayloadInPostgres
} from "./postgres-ingest-repository";

function parseDate(value: string): Date {
  return new Date(value);
}

function parseOptionalDate(value: string | null): Date | null {
  return value ? parseDate(value) : null;
}

function numericOrNull(value: number | null): string | null {
  return value === null ? null : String(value);
}

export async function persistMajorGoodsPriceWarehouseInPostgres(
  artifacts: MajorGoodsPriceIndexArtifacts
): Promise<void> {
  await ensureSourceCatalogInPostgres(artifacts.sourceCatalog);
  const stagedSnapshot = await stageRawPayloadInPostgres(artifacts.rawSnapshot);
  const snapshotId = stagedSnapshot.snapshot.snapshotId;
  const db = getDb();

  await db.transaction(async (tx) => {
    for (const category of artifacts.categories) {
      await tx
        .insert(productCategories)
        .values({
          categoryId: category.categoryId,
          slug: category.slug,
          name: category.name,
          parentCategoryId: category.parentCategoryId,
          absCpiCode: category.absCpiCode,
          absCpiLevel: category.absCpiLevel,
          isMajorGood: category.isMajorGood,
          createdAt: parseDate(category.createdAt),
          updatedAt: parseDate(category.updatedAt)
        })
        .onConflictDoUpdate({
          target: productCategories.categoryId,
          set: {
            slug: sql.raw("excluded.slug"),
            name: sql.raw("excluded.name"),
            parentCategoryId: sql.raw("excluded.parent_category_id"),
            absCpiCode: sql.raw("excluded.abs_cpi_code"),
            absCpiLevel: sql.raw("excluded.abs_cpi_level"),
            isMajorGood: sql.raw("excluded.is_major_good"),
            updatedAt: sql.raw("excluded.updated_at")
          }
        });
    }

    for (const product of artifacts.products) {
      await tx
        .insert(products)
        .values({
          productId: product.productId,
          categoryId: product.categoryId,
          slug: product.slug,
          productFamilySlug: product.productFamilySlug,
          canonicalName: product.canonicalName,
          brand: product.brand,
          variant: product.variant,
          sizeValue: numericOrNull(product.sizeValue),
          sizeUnit: product.sizeUnit,
          packCount: product.packCount,
          normalizedQuantity: String(product.normalizedQuantity),
          normalizedUnit: product.normalizedUnit,
          countryOfOrigin: product.countryOfOrigin,
          isAustralianMade: product.isAustralianMade,
          manufacturerName: product.manufacturerName,
          domesticValueShareBand: product.domesticValueShareBand,
          aiExposureLevel: product.aiExposureLevel,
          aiExposureReason: product.aiExposureReason,
          comparableUnitBasis: product.comparableUnitBasis,
          isControlCandidate: product.isControlCandidate,
          cohortReady: product.cohortReady,
          gtin: product.gtin,
          isActive: product.isActive,
          createdAt: parseDate(product.createdAt),
          updatedAt: parseDate(product.updatedAt)
        })
        .onConflictDoUpdate({
          target: products.productId,
          set: {
            categoryId: sql.raw("excluded.category_id"),
            slug: sql.raw("excluded.slug"),
            productFamilySlug: sql.raw("excluded.product_family_slug"),
            canonicalName: sql.raw("excluded.canonical_name"),
            brand: sql.raw("excluded.brand"),
            variant: sql.raw("excluded.variant"),
            sizeValue: sql.raw("excluded.size_value"),
            sizeUnit: sql.raw("excluded.size_unit"),
            packCount: sql.raw("excluded.pack_count"),
            normalizedQuantity: sql.raw("excluded.normalized_quantity"),
            normalizedUnit: sql.raw("excluded.normalized_unit"),
            countryOfOrigin: sql.raw("excluded.country_of_origin"),
            isAustralianMade: sql.raw("excluded.is_australian_made"),
            manufacturerName: sql.raw("excluded.manufacturer_name"),
            domesticValueShareBand: sql.raw("excluded.domestic_value_share_band"),
            aiExposureLevel: sql.raw("excluded.ai_exposure_level"),
            aiExposureReason: sql.raw("excluded.ai_exposure_reason"),
            comparableUnitBasis: sql.raw("excluded.comparable_unit_basis"),
            isControlCandidate: sql.raw("excluded.is_control_candidate"),
            cohortReady: sql.raw("excluded.cohort_ready"),
            gtin: sql.raw("excluded.gtin"),
            isActive: sql.raw("excluded.is_active"),
            updatedAt: sql.raw("excluded.updated_at")
          }
        });
    }

    for (const merchant of artifacts.merchants) {
      await tx
        .insert(merchants)
        .values({
          merchantId: merchant.merchantId,
          slug: merchant.slug,
          name: merchant.name,
          merchantType: merchant.merchantType,
          websiteUrl: merchant.websiteUrl,
          countryCode: merchant.countryCode,
          isActive: merchant.isActive,
          createdAt: parseDate(merchant.createdAt),
          updatedAt: parseDate(merchant.updatedAt)
        })
        .onConflictDoUpdate({
          target: merchants.merchantId,
          set: {
            slug: sql.raw("excluded.slug"),
            name: sql.raw("excluded.name"),
            merchantType: sql.raw("excluded.merchant_type"),
            websiteUrl: sql.raw("excluded.website_url"),
            countryCode: sql.raw("excluded.country_code"),
            isActive: sql.raw("excluded.is_active"),
            updatedAt: sql.raw("excluded.updated_at")
          }
        });
    }

    for (const location of artifacts.merchantLocations) {
      await tx
        .insert(merchantLocations)
        .values({
          locationId: location.locationId,
          merchantId: location.merchantId,
          locationCode: location.locationCode,
          name: location.name,
          regionCode: location.regionCode,
          postcode: location.postcode,
          suburb: location.suburb,
          state: location.state,
          latitude: numericOrNull(location.latitude),
          longitude: numericOrNull(location.longitude),
          isOnlineOnly: location.isOnlineOnly,
          openedAt: parseOptionalDate(location.openedAt),
          closedAt: parseOptionalDate(location.closedAt)
        })
        .onConflictDoUpdate({
          target: merchantLocations.locationId,
          set: {
            merchantId: sql.raw("excluded.merchant_id"),
            locationCode: sql.raw("excluded.location_code"),
            name: sql.raw("excluded.name"),
            regionCode: sql.raw("excluded.region_code"),
            postcode: sql.raw("excluded.postcode"),
            suburb: sql.raw("excluded.suburb"),
            state: sql.raw("excluded.state"),
            latitude: sql.raw("excluded.latitude"),
            longitude: sql.raw("excluded.longitude"),
            isOnlineOnly: sql.raw("excluded.is_online_only"),
            openedAt: sql.raw("excluded.opened_at"),
            closedAt: sql.raw("excluded.closed_at")
          }
        });
    }

    for (const alias of artifacts.productAliases) {
      await tx
        .insert(productAliases)
        .values({
          productAliasId: alias.productAliasId,
          sourceId: alias.sourceId,
          merchantId: alias.merchantId,
          externalProductId: alias.externalProductId,
          externalSku: alias.externalSku,
          productId: alias.productId,
          matchConfidence: alias.matchConfidence,
          matchMethod: alias.matchMethod,
          firstSeenAt: parseDate(alias.firstSeenAt),
          lastSeenAt: parseDate(alias.lastSeenAt)
        })
        .onConflictDoUpdate({
          target: productAliases.productAliasId,
          set: {
            productId: sql.raw("excluded.product_id"),
            matchConfidence: sql.raw("excluded.match_confidence"),
            matchMethod: sql.raw("excluded.match_method"),
            lastSeenAt: sql.raw("excluded.last_seen_at")
          }
        });
    }

    for (const offer of artifacts.offers) {
      await tx
        .insert(offers)
        .values({
          offerId: offer.offerId,
          sourceId: offer.sourceId,
          merchantId: offer.merchantId,
          locationId: offer.locationId,
          productAliasId: offer.productAliasId,
          productId: offer.productId,
          externalOfferId: offer.externalOfferId,
          listingUrl: offer.listingUrl,
          sellerSku: offer.sellerSku,
          currency: offer.currency,
          taxStatus: offer.taxStatus,
          unitCount: offer.unitCount,
          unitSizeValue: numericOrNull(offer.unitSizeValue),
          unitSizeMeasure: offer.unitSizeMeasure,
          isActive: offer.isActive,
          firstSeenAt: parseDate(offer.firstSeenAt),
          lastSeenAt: parseDate(offer.lastSeenAt)
        })
        .onConflictDoUpdate({
          target: offers.offerId,
          set: {
            locationId: sql.raw("excluded.location_id"),
            productAliasId: sql.raw("excluded.product_alias_id"),
            productId: sql.raw("excluded.product_id"),
            listingUrl: sql.raw("excluded.listing_url"),
            sellerSku: sql.raw("excluded.seller_sku"),
            currency: sql.raw("excluded.currency"),
            taxStatus: sql.raw("excluded.tax_status"),
            unitCount: sql.raw("excluded.unit_count"),
            unitSizeValue: sql.raw("excluded.unit_size_value"),
            unitSizeMeasure: sql.raw("excluded.unit_size_measure"),
            isActive: sql.raw("excluded.is_active"),
            lastSeenAt: sql.raw("excluded.last_seen_at")
          }
        });
    }

    for (const row of artifacts.priceObservations) {
      await tx
        .insert(priceObservations)
        .values({
          priceObservationId: row.priceObservationId,
          offerId: row.offerId,
          productId: row.productId,
          merchantId: row.merchantId,
          locationId: row.locationId,
          regionCode: row.regionCode,
          observedAt: parseDate(row.observedAt),
          observedDate: row.observedDate,
          availabilityStatus: row.availabilityStatus,
          inStock: row.inStock,
          priceType: row.priceType,
          priceAmount: String(row.priceAmount),
          currency: row.currency,
          unitPriceAmount: String(row.unitPriceAmount),
          unitPriceUnit: row.unitPriceUnit,
          promoLabel: row.promoLabel,
          multibuyQuantity: row.multibuyQuantity,
          multibuyTotalAmount: numericOrNull(row.multibuyTotalAmount),
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo,
          sourceRunId: row.sourceRunId,
          rawSnapshotId: snapshotId,
          observedChecksum: row.observedChecksum,
          qualityFlag: row.qualityFlag,
          createdAt: parseDate(row.createdAt)
        })
        .onConflictDoUpdate({
          target: priceObservations.priceObservationId,
          set: {
            priceAmount: sql.raw("excluded.price_amount"),
            unitPriceAmount: sql.raw("excluded.unit_price_amount"),
            rawSnapshotId: sql.raw("excluded.raw_snapshot_id"),
            observedChecksum: sql.raw("excluded.observed_checksum"),
            qualityFlag: sql.raw("excluded.quality_flag")
          }
        });
    }

    for (const rollup of artifacts.rollupsDaily) {
      await tx
        .insert(priceRollupsDaily)
        .values({
          rollupId: rollup.rollupId,
          rollupDate: rollup.rollupDate,
          productId: rollup.productId,
          categoryId: rollup.categoryId,
          regionCode: rollup.regionCode,
          merchantId: rollup.merchantId,
          sampleSize: rollup.sampleSize,
          distinctOfferCount: rollup.distinctOfferCount,
          minPrice: String(rollup.minPrice),
          maxPrice: String(rollup.maxPrice),
          meanPrice: String(rollup.meanPrice),
          medianPrice: String(rollup.medianPrice),
          p25Price: String(rollup.p25Price),
          p75Price: String(rollup.p75Price),
          meanUnitPrice: String(rollup.meanUnitPrice),
          medianUnitPrice: String(rollup.medianUnitPrice),
          methodologyVersion: rollup.methodologyVersion,
          computedAt: parseDate(rollup.computedAt)
        })
        .onConflictDoUpdate({
          target: priceRollupsDaily.rollupId,
          set: {
            sampleSize: sql.raw("excluded.sample_size"),
            distinctOfferCount: sql.raw("excluded.distinct_offer_count"),
            minPrice: sql.raw("excluded.min_price"),
            maxPrice: sql.raw("excluded.max_price"),
            meanPrice: sql.raw("excluded.mean_price"),
            medianPrice: sql.raw("excluded.median_price"),
            p25Price: sql.raw("excluded.p25_price"),
            p75Price: sql.raw("excluded.p75_price"),
            meanUnitPrice: sql.raw("excluded.mean_unit_price"),
            medianUnitPrice: sql.raw("excluded.median_unit_price"),
            computedAt: sql.raw("excluded.computed_at")
          }
        });
    }

    for (const definition of artifacts.indexDefinitions) {
      await tx
        .insert(indexDefinitions)
        .values({
          indexId: definition.indexId,
          name: definition.name,
          description: definition.description,
          categoryScope: definition.categoryScope,
          geographyLevel: definition.geographyLevel,
          frequency: definition.frequency,
          basePeriod: definition.basePeriod,
          baseValue: String(definition.baseValue),
          aggregationMethod: definition.aggregationMethod,
          publishedSeriesId: definition.publishedSeriesId,
          isPublic: definition.isPublic,
          createdAt: parseDate(definition.createdAt),
          updatedAt: parseDate(definition.updatedAt)
        })
        .onConflictDoUpdate({
          target: indexDefinitions.indexId,
          set: {
            name: sql.raw("excluded.name"),
            description: sql.raw("excluded.description"),
            categoryScope: sql.raw("excluded.category_scope"),
            geographyLevel: sql.raw("excluded.geography_level"),
            frequency: sql.raw("excluded.frequency"),
            basePeriod: sql.raw("excluded.base_period"),
            baseValue: sql.raw("excluded.base_value"),
            aggregationMethod: sql.raw("excluded.aggregation_method"),
            publishedSeriesId: sql.raw("excluded.published_series_id"),
            isPublic: sql.raw("excluded.is_public"),
            updatedAt: sql.raw("excluded.updated_at")
          }
        });
    }

    for (const basketVersion of artifacts.indexBasketVersions) {
      await tx
        .insert(indexBasketVersions)
        .values({
          basketVersionId: basketVersion.basketVersionId,
          indexId: basketVersion.indexId,
          effectiveFrom: basketVersion.effectiveFrom,
          effectiveTo: basketVersion.effectiveTo,
          weightSource: basketVersion.weightSource,
          methodologyVersion: basketVersion.methodologyVersion,
          notes: basketVersion.notes,
          createdAt: parseDate(basketVersion.createdAt)
        })
        .onConflictDoUpdate({
          target: indexBasketVersions.basketVersionId,
          set: {
            effectiveTo: sql.raw("excluded.effective_to"),
            weightSource: sql.raw("excluded.weight_source"),
            methodologyVersion: sql.raw("excluded.methodology_version"),
            notes: sql.raw("excluded.notes")
          }
        });
    }

    for (const weight of artifacts.indexWeights) {
      await tx
        .insert(indexWeights)
        .values({
          indexWeightId: weight.indexWeightId,
          basketVersionId: weight.basketVersionId,
          productId: weight.productId,
          categoryId: weight.categoryId,
          regionCode: weight.regionCode,
          weight: String(weight.weight),
          weightBasis: weight.weightBasis
        })
        .onConflictDoUpdate({
          target: indexWeights.indexWeightId,
          set: {
            productId: sql.raw("excluded.product_id"),
            categoryId: sql.raw("excluded.category_id"),
            regionCode: sql.raw("excluded.region_code"),
            weight: sql.raw("excluded.weight"),
            weightBasis: sql.raw("excluded.weight_basis")
          }
        });
    }
  });
}
