import { beforeEach, describe, expect, test, vi } from "vitest";
import { getDashboardOverview } from "../lib/queries/dashboard-overview";

const sdkMocks = vi.hoisted(() => ({
  getApiEnergyOverview: vi.fn(),
  getApiHealth: vi.fn(),
  getApiHousingOverview: vi.fn(),
  getApiMetadataFreshness: vi.fn(),
  getApiMetadataSources: vi.fn()
}));

vi.mock("@aus-dash/sdk", () => sdkMocks);

describe("getDashboardOverview", () => {
  beforeEach(() => {
    sdkMocks.getApiHealth.mockReset();
    sdkMocks.getApiEnergyOverview.mockReset();
    sdkMocks.getApiHousingOverview.mockReset();
    sdkMocks.getApiMetadataFreshness.mockReset();
    sdkMocks.getApiMetadataSources.mockReset();

    sdkMocks.getApiHealth.mockResolvedValue({
      service: "aus-dash-api",
      status: "ok"
    });
    sdkMocks.getApiEnergyOverview.mockResolvedValue({
      region: "AU",
      methodSummary: "Combines wholesale, retail, benchmark, and CPI source data.",
      sourceRefs: [
        { sourceId: "aemo_wholesale", name: "AEMO Wholesale", url: "https://example.com/aemo" }
      ],
      sourceMixViews: [],
      panels: {
        liveWholesale: {
          valueAudMwh: 118.4,
          valueCKwh: 11.84
        },
        retailAverage: {
          annualBillAudMean: 1940,
          annualBillAudMedian: 1885
        },
        benchmark: {
          dmoAnnualBillAud: 1985
        },
        cpiElectricity: {
          indexValue: 151.2,
          period: "2025-Q4"
        }
      },
      freshness: {
        status: "fresh",
        updatedAt: "2026-03-07T03:00:00Z"
      }
    });
    sdkMocks.getApiHousingOverview.mockResolvedValue({
      region: "AU",
      requiredSeriesIds: [],
      missingSeriesIds: [],
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
          regionCode: "AU",
          expectedCadence: "5m",
          updatedAt: "2026-03-07T03:00:00Z",
          lagMinutes: 10,
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

  test("maps SDK responses into dashboard-ready overview cards", async () => {
    const overview = await getDashboardOverview();

    expect(overview.hero.detail).toBe("2 public sources");
    expect(overview.metrics).toEqual([
      {
        label: "API health",
        value: "Operational",
        detail: "aus-dash-api"
      },
      {
        label: "Live wholesale",
        value: "118.4 AUD/MWh",
        detail: "11.8 c/kWh"
      },
      {
        label: "Retail average",
        value: "1,940 AUD/year",
        detail: "Median 1,885 AUD"
      },
      {
        label: "Housing coverage",
        value: "4 tracked metrics",
        detail: "Updated 2025-12-31"
      }
    ]);
    expect(overview.metadata).toEqual({
      freshness: "2 stale series",
      generatedAt: "Generated 2026-03-07",
      methodSummary: "Combines wholesale, retail, benchmark, and CPI source data."
    });
    expect(overview.chart).toEqual([{ label: "wholesale.aud_mwh", lag: 10 }]);
  });

  test("requests public overview data for the Australian national view", async () => {
    await getDashboardOverview();

    expect(sdkMocks.getApiHealth).toHaveBeenCalledTimes(1);
    expect(sdkMocks.getApiEnergyOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { region: "AU" },
        responseStyle: "data",
        throwOnError: true
      })
    );
    expect(sdkMocks.getApiHousingOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { region: "AU" },
        responseStyle: "data",
        throwOnError: true
      })
    );
  });
});
