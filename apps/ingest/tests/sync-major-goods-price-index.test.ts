import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import {
  buildMajorGoodsPriceIndexArtifacts,
  syncMajorGoodsPriceIndex
} from "../src/jobs/sync-major-goods-price-index";

const TEMP_DIRS: string[] = [];

function createTempStorePath(name: string) {
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

describe("major goods price index sync", () => {
  test("builds deterministic daily rollups and published price index observations", () => {
    const artifacts = buildMajorGoodsPriceIndexArtifacts({
      observedDate: "2026-02-27",
      ingestedAt: "2026-02-27T06:00:00Z"
    });

    expect(artifacts.rollupsDaily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rollupDate: "2026-02-27",
          regionCode: "AU",
          productSlug: "white-bread",
          sampleSize: 2,
          medianPrice: 3.95
        }),
        expect.objectContaining({
          rollupDate: "2026-02-27",
          regionCode: "AU",
          productSlug: "dishwashing-liquid",
          sampleSize: 1,
          meanUnitPrice: 4.1
        })
      ])
    );

    expect(artifacts.publicObservations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seriesId: "prices.major_goods.overall.index",
          regionCode: "AU",
          date: "2026-02-27",
          value: 107.53,
          methodologyVersion: "prices-major-goods-v1"
        }),
        expect.objectContaining({
          seriesId: "prices.major_goods.food.index",
          regionCode: "VIC",
          date: "2026-02-27",
          value: 108.09,
          methodologyVersion: "prices-major-goods-v1"
        }),
        expect.objectContaining({
          seriesId: "prices.au_made.all.index",
          regionCode: "AU",
          date: "2026-02-27",
          value: 107.24,
          methodologyVersion: "prices-major-goods-v1"
        }),
        expect.objectContaining({
          seriesId: "prices.ai_deflation.spread.au_made_vs_control.index",
          regionCode: "AU",
          date: "2026-02-27",
          value: -4.96,
          methodologyVersion: "prices-major-goods-v1"
        })
      ])
    );
  });

  test("publishes curated major goods observations idempotently into the store backend", async () => {
    const storePath = createTempStorePath("major-goods-store");

    await expect(
      syncMajorGoodsPriceIndex({
        ingestBackend: "store",
        storePath,
        sourceMode: "fixture",
        asOf: "2026-02-27T06:00:00Z"
      })
    ).resolves.toMatchObject({
      job: "sync-major-goods-price-index",
      status: "ok",
      rowsInserted: 16,
      rowsUpdated: 16
    });

    await expect(
      syncMajorGoodsPriceIndex({
        ingestBackend: "store",
        storePath,
        sourceMode: "fixture",
        asOf: "2026-02-27T06:00:00Z"
      })
    ).resolves.toMatchObject({
      rowsInserted: 0,
      rowsUpdated: 32
    });

    const store = readLiveStoreSync(storePath);
    expect(
      store.observations.filter(
        (observation) =>
          observation.seriesId === "prices.major_goods.overall.index" &&
          observation.regionCode === "AU"
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-02-26",
          value: 100
        }),
        expect.objectContaining({
          date: "2026-02-27",
          value: 107.53,
          methodologyVersion: "prices-major-goods-v1"
        })
      ])
    );
  });

  test("publishes live major-goods values from fetched points and records the payload timestamp as the source cursor", async () => {
    const storePath = createTempStorePath("major-goods-live-store");

    await expect(
      syncMajorGoodsPriceIndex({
        ingestBackend: "store",
        storePath,
        sourceMode: "live",
        asOf: "2026-02-27T06:00:00Z",
        endpoint: "https://example.test/major-goods.json",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            observed_at: "2026-02-27T09:30:00Z",
            items: [
              {
                merchant: "coles",
                merchant_name: "Coles",
                region_code: "AU",
                category_slug: "food",
                category_name: "Food",
                product_slug: "white-bread",
                canonical_name: "White Bread 700g",
                external_product_id: "bread-700",
                external_offer_id: "coles-bread-au",
                price_amount: 7.2,
                unit_price_amount: 10.29,
                normalized_quantity: 0.7,
                normalized_unit: "kg",
                price_type: "shelf"
              },
              {
                merchant: "woolworths",
                merchant_name: "Woolworths",
                region_code: "AU",
                category_slug: "food",
                category_name: "Food",
                product_slug: "milk-2l",
                canonical_name: "Full Cream Milk 2L",
                external_product_id: "milk-2l",
                external_offer_id: "ww-milk-au",
                price_amount: 8.4,
                unit_price_amount: 4.2,
                normalized_quantity: 2,
                normalized_unit: "l",
                price_type: "shelf"
              },
              {
                merchant: "aldi",
                merchant_name: "ALDI",
                region_code: "AU",
                category_slug: "household-supplies",
                category_name: "Household Supplies",
                product_slug: "dishwashing-liquid",
                canonical_name: "Dishwashing Liquid 1L",
                external_product_id: "dishwashing-liquid",
                external_offer_id: "aldi-dish-au",
                price_amount: 7.6,
                unit_price_amount: 7.6,
                normalized_quantity: 1,
                normalized_unit: "l",
                price_type: "shelf"
              }
            ]
          }),
          text: async () => ""
        })
      })
    ).resolves.toMatchObject({
      job: "sync-major-goods-price-index",
      status: "ok"
    });

    const store = readLiveStoreSync(storePath);
    expect(
      store.observations.find(
        (observation) =>
          observation.seriesId === "prices.major_goods.overall.index" &&
          observation.regionCode === "AU" &&
          observation.date === "2026-02-27"
      )
    ).toMatchObject({
      value: 200,
      publishedAt: "2026-02-27T06:00:00Z"
    });
    expect(store.sourceCursors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "major_goods_prices",
          cursor: "2026-02-27T09:30:00Z"
        })
      ])
    );
  });
});
