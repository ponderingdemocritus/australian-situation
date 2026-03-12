import { beforeEach, describe, expect, test, vi } from "vitest";
import { getEnergyDashboardData } from "../lib/queries/energy-dashboard";
import { getHousingDashboardData } from "../lib/queries/housing-dashboard";
import { getSourcesDashboardData } from "../lib/queries/sources-dashboard";

const sdkMocks = vi.hoisted(() => ({
  getApiEnergyOverview: vi.fn(),
  getApiHousingOverview: vi.fn(),
  getApiMetadataFreshness: vi.fn(),
  getApiMetadataSources: vi.fn(),
  getApiV1EnergyCompareRetail: vi.fn(),
  getApiV1EnergyCompareWholesale: vi.fn()
}));

vi.mock("@aus-dash/sdk", () => sdkMocks);

describe("dashboard domain queries", () => {
  beforeEach(() => {
    Object.values(sdkMocks).forEach((mock) => mock.mockReset());

    sdkMocks.getApiEnergyOverview.mockResolvedValue({
      region: "AU",
      methodSummary: "Combines wholesale, retail, benchmark, and CPI source data.",
      sourceRefs: [
        { sourceId: "aemo_wholesale", name: "AEMO Wholesale", url: "https://example.com/aemo" }
      ],
      sourceMixViews: [
        {
          viewId: "annual_official",
          title: "National mix",
          coverageLabel: "AU annual",
          updatedAt: "2025-12-31",
          sourceRefs: [],
          rows: [
            { sourceKey: "coal", label: "Coal", sharePct: 52.4 },
            { sourceKey: "solar", label: "Solar", sharePct: 18.7 }
          ]
        }
      ],
      panels: {
        liveWholesale: { valueAudMwh: 118.4, valueCKwh: 11.84 },
        retailAverage: { annualBillAudMean: 1940, annualBillAudMedian: 1885 },
        benchmark: { dmoAnnualBillAud: 1985 },
        cpiElectricity: { indexValue: 151.2, period: "2025-Q4" }
      },
      freshness: { updatedAt: "2026-03-07T03:00:00Z", status: "fresh" }
    });
    sdkMocks.getApiV1EnergyCompareRetail.mockResolvedValue({
      country: "AU",
      peers: ["US", "DE", "ID", "CN"],
      basis: "nominal",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      auRank: 3,
      methodologyVersion: "energy-comparison-v1",
      rows: []
    });
    sdkMocks.getApiV1EnergyCompareWholesale.mockResolvedValue({
      country: "AU",
      peers: ["US", "DE", "CN"],
      auRank: 2,
      auPercentile: 66,
      methodologyVersion: "energy-comparison-v1",
      rows: []
    });
    sdkMocks.getApiHousingOverview.mockResolvedValue({
      region: "AU",
      requiredSeriesIds: [],
      missingSeriesIds: ["rates.investor.variable_pct"],
      metrics: [
        { seriesId: "hvi.value.index", date: "2025-12-31", value: 169.4 },
        { seriesId: "lending.avg_loan_size_aud", date: "2025-12-31", value: 736000 },
        { seriesId: "rates.oo.variable_pct", date: "2025-12-31", value: 6.08 },
        { seriesId: "lending.investor.count", date: "2025-12-31", value: 16950 }
      ],
      updatedAt: "2025-12-31"
    });
    sdkMocks.getApiMetadataFreshness.mockResolvedValue({
      generatedAt: "2026-03-07T03:10:00Z",
      staleSeriesCount: 2,
      series: [
        {
          seriesId: "energy.live.wholesale.aud_mwh",
          regionCode: "NSW",
          expectedCadence: "5m",
          updatedAt: "2026-03-07T02:50:00Z",
          lagMinutes: 20,
          freshnessStatus: "stale"
        }
      ]
    });
    sdkMocks.getApiMetadataSources.mockResolvedValue({
      generatedAt: "2026-03-07T03:10:00Z",
      sources: [
        {
          sourceId: "aemo_wholesale",
          domain: "energy",
          name: "AEMO Wholesale",
          url: "https://example.com/aemo",
          expectedCadence: "5m"
        },
        {
          sourceId: "corelogic_hvi",
          domain: "housing",
          name: "CoreLogic HVI",
          url: "https://example.com/corelogic",
          expectedCadence: "monthly"
        }
      ]
    });
  });

  test("maps energy overview, comparisons, and source mix into a domain view", async () => {
    const result = await getEnergyDashboardData();

    expect(result.metrics[0]).toEqual({
      label: "Live wholesale",
      value: "118.4 AUD/MWh",
      detail: "11.8 c/kWh"
    });
    expect(result.comparisons).toEqual([
      {
        label: "Retail comparison",
        value: "Rank 3 of 5",
        detail: "Nominal household electricity"
      },
      {
        label: "Wholesale comparison",
        value: "Rank 2 of 4",
        detail: "Cross-country annual market pricing"
      }
    ]);
    expect(result.mixes[0]).toEqual({
      coverage: "AU annual",
      title: "National mix",
      topRows: ["Coal 52.4%", "Solar 18.7%"],
      updatedAt: "2025-12-31"
    });
  });

  test("maps housing series into readable metric cards and missing coverage notes", async () => {
    const result = await getHousingDashboardData();

    expect(result.metrics).toEqual([
      { label: "Home value index", value: "169.4", detail: "2025-12-31" },
      { label: "Average loan size", value: "736,000 AUD", detail: "2025-12-31" },
      { label: "Owner-occupier variable rate", value: "6.08%", detail: "2025-12-31" },
      { label: "Investor lending", value: "16,950", detail: "2025-12-31" }
    ]);
    expect(result.coverageNote).toBe("1 series currently missing from the housing overview.");
  });

  test("maps source catalog and freshness metadata into provenance sections", async () => {
    const result = await getSourcesDashboardData();

    expect(result.summary).toEqual({
      freshness: "2 stale series",
      generatedAt: "Generated 2026-03-07"
    });
    expect(result.sources[0]).toEqual({
      cadence: "5m",
      domain: "energy",
      name: "AEMO Wholesale",
      url: "https://example.com/aemo"
    });
    expect(result.staleSeries[0]).toEqual({
      cadence: "5m",
      lag: "20 min lag",
      region: "NSW",
      seriesId: "energy.live.wholesale.aud_mwh",
      updatedAt: "2026-03-07"
    });
  });
});
