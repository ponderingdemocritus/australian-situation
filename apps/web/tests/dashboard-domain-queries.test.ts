import { beforeEach, describe, expect, test, vi } from "vitest";
import { getEnergyDashboardData } from "../lib/queries/energy-dashboard";
import { getHousingDashboardData } from "../lib/queries/housing-dashboard";
import { getSourcesDashboardData } from "../lib/queries/sources-dashboard";

  const sdkMocks = vi.hoisted(() => ({
  getApiEnergyHouseholdEstimate: vi.fn(),
  getApiEnergyLiveWholesale: vi.fn(),
  getApiEnergyOverview: vi.fn(),
  getApiEnergyRetailAverage: vi.fn(),
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

    sdkMocks.getApiEnergyLiveWholesale.mockResolvedValue({
      region: "AU",
      window: "5m",
      isModeled: false,
      methodSummary: "Wholesale reference prices aggregated using demand-weighted AU rollup.",
      sourceRefs: [],
      latest: {
        timestamp: "2026-02-27T02:00:00Z",
        valueAudMwh: 119.35,
        valueCKwh: 11.93
      },
      rollups: {
        oneHourAvgAudMwh: 116.47,
        twentyFourHourAvgAudMwh: 116.47
      },
      freshness: {
        updatedAt: "2026-02-27T02:00:00Z",
        status: "stale"
      }
    });
    sdkMocks.getApiEnergyRetailAverage.mockResolvedValue({
      region: "AU",
      customerType: "residential",
      isModeled: false,
      methodSummary: "Daily aggregation of retail plan prices for residential offers.",
      sourceRefs: [],
      annualBillAudMean: 1998.2,
      annualBillAudMedian: 2004,
      usageRateCKwhMean: 31.2,
      dailyChargeAudDayMean: 1.08,
      freshness: {
        updatedAt: "2026-02-27",
        status: "stale"
      }
    });
    sdkMocks.getApiEnergyHouseholdEstimate.mockRejectedValue({
      data: {
        error: {
          code: "FEATURE_DISABLED",
          message: "Energy household estimate is disabled"
        }
      }
    });
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

  test("maps region-scoped energy data and keeps national comparison detail", async () => {
    sdkMocks.getApiV1EnergyCompareRetail.mockResolvedValue({
      country: "AU",
      peers: ["US", "DE", "ID", "CN"],
      basis: "nominal",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      auRank: 3,
      methodologyVersion: "energy-comparison-v1",
      rows: [
        {
          countryCode: "US",
          date: "2026-02",
          value: 0.18,
          rank: 1,
          methodologyVersion: "energy-comparison-v1"
        },
        {
          countryCode: "DE",
          date: "2026-02",
          value: 0.3,
          rank: 2,
          methodologyVersion: "energy-comparison-v1"
        },
        {
          countryCode: "AU",
          date: "2026-02",
          value: 0.32,
          rank: 3,
          methodologyVersion: "energy-comparison-v1"
        }
      ],
      comparisons: [
        { peerCountryCode: "US", peerValue: 0.18, gap: 0.14, gapPct: 77.78 },
        { peerCountryCode: "DE", peerValue: 0.3, gap: 0.02, gapPct: 6.67 }
      ]
    });
    sdkMocks.getApiV1EnergyCompareWholesale.mockResolvedValue({
      country: "AU",
      peers: ["US", "DE", "CN"],
      auRank: 2,
      auPercentile: 66,
      methodologyVersion: "energy-comparison-v1",
      rows: [
        {
          countryCode: "US",
          date: "2026-02-28T01:00:00Z",
          value: 70,
          rank: 1,
          methodologyVersion: "energy-comparison-v1"
        },
        {
          countryCode: "AU",
          date: "2026-02-28T01:00:00Z",
          value: 120,
          rank: 2,
          methodologyVersion: "energy-comparison-v1"
        }
      ],
      comparisons: [{ peerCountryCode: "US", peerValue: 70, gap: 50, gapPct: 71.43 }]
    });

    const result = await getEnergyDashboardData("NSW");

    expect(sdkMocks.getApiEnergyOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { region: "NSW" }
      })
    );
    expect(sdkMocks.getApiEnergyLiveWholesale).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { region: "NSW", window: "5m" }
      })
    );
    expect(sdkMocks.getApiV1EnergyCompareRetail).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          country: "AU"
        })
      })
    );
    expect(result.region).toBe("NSW");
    expect(result.regionLabel).toBe("New South Wales");

    expect(result.metrics[0]).toEqual({
      label: "Live wholesale",
      value: "118.4 AUD/MWh",
      detail: "11.8 c/kWh"
    });
    expect(result.nationalComparisons[0]).toEqual({
      title: "Retail electricity",
      summary: "Australia ranks 3 of 5 peers",
      detail: "Nominal household electricity · energy-comparison-v1",
      peerGaps: ["US +77.8%", "DE +6.7%"],
      rows: [
        { countryCode: "US", rank: "1", value: "0.18 USD/kWh", updatedAt: "2026-02" },
        { countryCode: "DE", rank: "2", value: "0.30 USD/kWh", updatedAt: "2026-02" },
        { countryCode: "AU", rank: "3", value: "0.32 USD/kWh", updatedAt: "2026-02" }
      ]
    });
    expect(result.nationalComparisons[1].summary).toBe(
      "Australia ranks 2 of 4 peers · Percentile 66"
    );
    expect(result.mixes[0]).toEqual({
      coverage: "AU annual",
      title: "National mix",
      topRows: ["Coal 52.4%", "Solar 18.7%"],
      updatedAt: "2025-12-31"
    });
    expect(result.liveWholesale).toEqual({
      detail: "1h avg 116.5 AUD/MWh · 24h avg 116.5 AUD/MWh",
      label: "Latest interval",
      value: "119.4 AUD/MWh"
    });
    expect(result.retailAverage).toEqual({
      detail: "31.2 c/kWh · 1.1 AUD/day",
      label: "Residential mean bill",
      value: "1,998 AUD/year"
    });
    expect(result.householdEstimate).toEqual({
      detail: "Energy household estimate is disabled",
      label: "Household estimate",
      value: "Unavailable"
    });
  });

  test("keeps state dashboards available when direct live wholesale is unsupported", async () => {
    sdkMocks.getApiEnergyLiveWholesale.mockRejectedValueOnce(
      new Error("Unsupported region: WA")
    );

    const result = await getEnergyDashboardData("WA");

    expect(result.region).toBe("WA");
    expect(result.liveWholesale).toEqual({
      label: "Latest interval",
      value: "Unavailable",
      detail: "Direct live wholesale is not currently available for Western Australia."
    });
    expect(result.metrics[0]).toEqual({
      label: "Live wholesale",
      value: "Unavailable",
      detail: "Direct live wholesale is not currently available for Western Australia."
    });
  });

  test("keeps rendering energy metrics when comparison endpoints fail", async () => {
    sdkMocks.getApiV1EnergyCompareRetail.mockRejectedValueOnce(
      new Error("NO_COMPARABLE_PEER_DATA")
    );
    sdkMocks.getApiV1EnergyCompareWholesale.mockRejectedValueOnce(
      new Error("NO_COMPARABLE_PEER_DATA")
    );

    const result = await getEnergyDashboardData();

    expect(result.metrics[0].value).toBe("118.4 AUD/MWh");
    expect(result.nationalComparisons).toEqual([
      {
        title: "Retail electricity",
        summary: "Unavailable",
        detail: "Comparable peer data is not currently available.",
        peerGaps: [],
        rows: []
      },
      {
        title: "Wholesale electricity",
        summary: "Unavailable",
        detail: "Comparable peer data is not currently available.",
        peerGaps: [],
        rows: []
      }
    ]);
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
