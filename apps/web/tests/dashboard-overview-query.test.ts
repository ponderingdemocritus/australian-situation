import { beforeEach, describe, expect, test, vi } from "vitest";
import * as sdk from "@aus-dash/sdk";
import { getDashboardOverview } from "../lib/queries/dashboard-overview";

vi.mock("@aus-dash/sdk", () => ({
  overview: vi.fn(),
  health: vi.fn(),
  overview2: vi.fn(),
  freshness: vi.fn(),
  sources: vi.fn()
}));

const sdkMocks = {
  overview: vi.mocked(sdk.overview),
  health: vi.mocked(sdk.health),
  overview2: vi.mocked(sdk.overview2),
  freshness: vi.mocked(sdk.freshness),
  sources: vi.mocked(sdk.sources)
};

describe("getDashboardOverview", () => {
  beforeEach(() => {
    sdkMocks.health.mockReset();
    sdkMocks.overview.mockReset();
    sdkMocks.overview2.mockReset();
    sdkMocks.freshness.mockReset();
    sdkMocks.sources.mockReset();

    sdkMocks.health.mockResolvedValue({
      service: "aus-dash-api",
      status: "ok"
    } as any);
    sdkMocks.overview.mockResolvedValue({
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
    } as any);
    sdkMocks.overview2.mockResolvedValue({
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
    } as any);
    sdkMocks.freshness.mockResolvedValue({
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
    } as any);
    sdkMocks.sources.mockResolvedValue({
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
    } as any);
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

    expect(sdkMocks.health).toHaveBeenCalledTimes(1);
    expect(sdkMocks.overview).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { region: "AU" },
        responseStyle: "data",
        throwOnError: true
      })
    );
    expect(sdkMocks.overview2).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { region: "AU" },
        responseStyle: "data",
        throwOnError: true
      })
    );
  });

  test("keeps the overview renderable when the energy overview panels are missing", async () => {
    sdkMocks.overview.mockResolvedValueOnce({
      region: "AU",
      methodSummary: "Combines wholesale, retail, benchmark, and CPI source data.",
      sourceRefs: [],
      sourceMixViews: [],
      panels: {
        liveWholesale: null,
        retailAverage: null,
        benchmark: null,
        cpiElectricity: null
      },
      freshness: {
        status: "stale",
        updatedAt: null
      }
    } as any);

    const overview = await getDashboardOverview();

    expect(overview.metrics).toEqual([
      {
        label: "API health",
        value: "Operational",
        detail: "aus-dash-api"
      },
      {
        label: "Live wholesale",
        value: "Unavailable",
        detail: "Overview panel unavailable"
      },
      {
        label: "Retail average",
        value: "Unavailable",
        detail: "Median unavailable"
      },
      {
        label: "Housing coverage",
        value: "4 tracked metrics",
        detail: "Updated 2025-12-31"
      }
    ]);
  });
});
