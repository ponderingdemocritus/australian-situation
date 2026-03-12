import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendPriceIntakeBatch,
  classifyUnresolvedPriceItem,
  createSeedLiveStore,
  readLiveStoreSync,
  reconcileUnresolvedPriceItem,
  resolveLiveStorePath,
  writeLiveStoreSync
} from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { promoteReconciledPriceItems } from "../src/jobs/promote-reconciled-price-items";
import { publishAiDeflationCohorts } from "../src/jobs/publish-ai-deflation-cohorts";

const TEMP_DIRS: string[] = [];

function createTempStorePath(name: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), `aus-dash-${name}-`));
  TEMP_DIRS.push(tempDir);
  return resolveLiveStorePath(path.join(tempDir, "live-store.json"));
}

afterEach(() => {
  while (TEMP_DIRS.length > 0) {
    const tempDir = TEMP_DIRS.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe("publish AI-deflation cohorts", () => {
  test("publishes cohort observations from promoted cohort-ready items", async () => {
    const storePath = createTempStorePath("publish-ai-deflation");
    const store = createSeedLiveStore();
    store.observations = [];
    writeLiveStoreSync(store, storePath);

    const baseStore = readLiveStoreSync(storePath);
    const baseBatch = appendPriceIntakeBatch(baseStore, {
      sourceId: "agent_test",
      capturedAt: "2026-03-11T00:00:00Z",
      items: [
        {
          observedAt: "2026-03-11T00:00:00Z",
          merchantName: "Bunnings",
          regionCode: "AU",
          title: "Bread",
          externalOfferId: "bread-base",
          priceAmount: 3.6
        },
        {
          observedAt: "2026-03-11T00:00:00Z",
          merchantName: "Bunnings",
          regionCode: "AU",
          title: "Milk",
          externalOfferId: "milk-base",
          priceAmount: 4.2
        },
        {
          observedAt: "2026-03-11T00:00:00Z",
          merchantName: "Bunnings",
          regionCode: "AU",
          title: "Dishwashing Liquid",
          externalOfferId: "dish-base",
          priceAmount: 3.8
        }
      ]
    });

    const currentBatch = appendPriceIntakeBatch(baseStore, {
      sourceId: "agent_test",
      capturedAt: "2026-03-12T00:00:00Z",
      items: [
        {
          observedAt: "2026-03-12T00:00:00Z",
          merchantName: "Bunnings",
          regionCode: "AU",
          title: "Bread",
          externalOfferId: "bread-current",
          priceAmount: 3.95
        },
        {
          observedAt: "2026-03-12T00:00:00Z",
          merchantName: "Bunnings",
          regionCode: "AU",
          title: "Milk",
          externalOfferId: "milk-current",
          priceAmount: 4.4
        },
        {
          observedAt: "2026-03-12T00:00:00Z",
          merchantName: "Bunnings",
          regionCode: "AU",
          title: "Dishwashing Liquid",
          externalOfferId: "dish-current",
          priceAmount: 4.1
        }
      ]
    });

    const cohortMetadata = [
      {
        canonicalCategorySlug: "food",
        canonicalCategoryName: "Food",
        canonicalProductSlug: "white-bread",
        canonicalProductName: "White Bread",
        productFamilySlug: "bakery-staples",
        countryOfOrigin: "AU",
        isAustralianMade: true,
        manufacturerName: "Local Bakery Network",
        domesticValueShareBand: "high",
        aiExposureLevel: "low" as const,
        aiExposureReason: "Control basket item",
        comparableUnitBasis: "per_item",
        isControlCandidate: true
      },
      {
        canonicalCategorySlug: "food",
        canonicalCategoryName: "Food",
        canonicalProductSlug: "milk-2l",
        canonicalProductName: "Milk 2L",
        productFamilySlug: "dairy-staples",
        countryOfOrigin: "AU",
        isAustralianMade: true,
        manufacturerName: "Domestic Dairy Processor",
        domesticValueShareBand: "high",
        aiExposureLevel: "high" as const,
        aiExposureReason: "AI-exposed treatment basket",
        comparableUnitBasis: "per_item",
        isControlCandidate: false
      },
      {
        canonicalCategorySlug: "cleaning",
        canonicalCategoryName: "Cleaning",
        canonicalProductSlug: "dishwashing-liquid",
        canonicalProductName: "Dishwashing Liquid",
        productFamilySlug: "cleaning-consumables",
        countryOfOrigin: "CN",
        isAustralianMade: false,
        manufacturerName: "Imported Household Supplier",
        domesticValueShareBand: "low",
        aiExposureLevel: "low" as const,
        aiExposureReason: "Imported control",
        comparableUnitBasis: "per_item",
        isControlCandidate: true
      }
    ];

    for (const batch of [baseBatch, currentBatch]) {
      batch.unresolvedItems.forEach((item, index) => {
        reconcileUnresolvedPriceItem(baseStore, item.unresolvedItemId, {
          canonicalCategorySlug: cohortMetadata[index]!.canonicalCategorySlug,
          canonicalCategoryName: cohortMetadata[index]!.canonicalCategoryName,
          canonicalProductSlug: cohortMetadata[index]!.canonicalProductSlug,
          canonicalProductName: cohortMetadata[index]!.canonicalProductName
        });
        classifyUnresolvedPriceItem(baseStore, item.unresolvedItemId, {
          productFamilySlug: cohortMetadata[index]!.productFamilySlug,
          countryOfOrigin: cohortMetadata[index]!.countryOfOrigin,
          isAustralianMade: cohortMetadata[index]!.isAustralianMade,
          manufacturerName: cohortMetadata[index]!.manufacturerName,
          domesticValueShareBand: cohortMetadata[index]!.domesticValueShareBand,
          aiExposureLevel: cohortMetadata[index]!.aiExposureLevel,
          aiExposureReason: cohortMetadata[index]!.aiExposureReason,
          comparableUnitBasis: cohortMetadata[index]!.comparableUnitBasis,
          isControlCandidate: cohortMetadata[index]!.isControlCandidate
        });
      });
    }
    writeLiveStoreSync(baseStore, storePath);

    await promoteReconciledPriceItems({
      storePath,
      sourceId: "agent_test",
      asOf: "2026-03-12T01:00:00Z"
    });

    await expect(
      publishAiDeflationCohorts({
        storePath,
        sourceId: "agent_test",
        asOf: "2026-03-12T02:00:00Z"
      })
    ).resolves.toMatchObject({
      job: "publish-ai-deflation-cohorts",
      status: "ok",
      rowsInserted: 10
    });

    const reread = readLiveStoreSync(storePath);
    expect(reread.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seriesId: "prices.au_made.all.index",
          regionCode: "AU",
          date: "2026-03-12",
          value: 107.24
        }),
        expect.objectContaining({
          seriesId: "prices.ai_deflation.spread.au_made_vs_control.index",
          regionCode: "AU",
          date: "2026-03-12",
          value: -4.96
        })
      ])
    );
  });
});
