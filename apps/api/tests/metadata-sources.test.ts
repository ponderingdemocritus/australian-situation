import { getSourceCatalogItems } from "@aus-dash/shared";
import { describe, expect, test } from "vitest";
import { app, createApp } from "../src/app";
import type { LiveDataRepository } from "../src/repositories/live-data-contract";

function createStubRepository(
  overrides: Partial<LiveDataRepository> = {}
): LiveDataRepository {
  return {
    getHousingOverview: async () => ({
      region: "AU",
      requiredSeriesIds: [],
      missingSeriesIds: [],
      metrics: [],
      updatedAt: null
    }),
    getSeries: async () => ({
      seriesId: "stub.series",
      region: "AU",
      points: []
    }),
    getEnergyLiveWholesale: async () => ({
      region: "AU",
      window: "5m",
      isModeled: false,
      methodSummary: "stub",
      sourceRefs: [],
      latest: {
        timestamp: "2026-03-01T00:00:00Z",
        valueAudMwh: 0,
        valueCKwh: 0
      },
      rollups: {
        oneHourAvgAudMwh: 0,
        twentyFourHourAvgAudMwh: 0
      },
      freshness: {
        updatedAt: "2026-03-01T00:00:00Z",
        status: "fresh"
      }
    }),
    getEnergyRetailAverage: async () => ({
      region: "AU",
      customerType: "residential",
      isModeled: false,
      methodSummary: "stub",
      sourceRefs: [],
      annualBillAudMean: 0,
      annualBillAudMedian: 0,
      usageRateCKwhMean: 0,
      dailyChargeAudDayMean: 0,
      freshness: {
        updatedAt: "2026-03-01T00:00:00Z",
        status: "fresh"
      }
    }),
    getEnergyRetailComparison: async () => ({
      rows: []
    }),
    getEnergyWholesaleComparison: async () => ({
      rows: []
    }),
    getEnergyOverview: async () => ({
      region: "AU",
      methodSummary: "stub",
      sourceRefs: [],
      sourceMixViews: [],
      panels: {
        liveWholesale: {
          valueAudMwh: 0,
          valueCKwh: 0
        },
        retailAverage: {
          annualBillAudMean: 0,
          annualBillAudMedian: 0
        },
        benchmark: {
          dmoAnnualBillAud: 0
        },
        cpiElectricity: {
          indexValue: 0,
          period: "2026-Q1"
        }
      },
      freshness: {
        updatedAt: "2026-03-01T00:00:00Z",
        status: "fresh"
      }
    }),
    getMetadataFreshness: async () => ({
      generatedAt: "2026-03-01T00:00:00Z",
      staleSeriesCount: 0,
      series: []
    }),
    getMetadataSources: async () => ({
      generatedAt: "2026-03-01T00:00:00Z",
      sources: getSourceCatalogItems(["abs_housing"])
    }),
    ...overrides
  };
}

describe("GET /api/metadata/sources", () => {
  test("returns source catalog with domains and update cadence", async () => {
    const response = await app.request("/api/metadata/sources");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      generatedAt: expect.any(String),
      sources: expect.arrayContaining([
        expect.objectContaining({
          sourceId: expect.any(String),
          domain: expect.stringMatching(/housing|energy|macro/),
          name: expect.any(String),
          url: expect.any(String),
          expectedCadence: expect.any(String)
        })
      ])
    });
  });

  test("backfills missing canonical registry entries when a repository returns partial provenance metadata", async () => {
    const partialCatalogApp = createApp({
      createRepository: () => createStubRepository()
    });

    const response = await partialCatalogApp.request("/api/metadata/sources");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.sources.map((item: { sourceId: string }) => item.sourceId)).toEqual([
      "abs_cpi",
      "abs_housing",
      "aemo_nem_source_mix",
      "aemo_wem_source_mix",
      "aemo_wholesale",
      "aer_prd",
      "dcceew_generation_mix",
      "eia_electricity",
      "entsoe_wholesale",
      "eurostat_retail",
      "rba_rates",
      "world_bank_normalization"
    ]);
  });
});
