import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHomePage } from "./render-home-page";

const fetchMock = vi.fn();

function createEnergyPayload(region: string) {
  return {
    region,
    panels: {
      liveWholesale: {
        valueAudMwh: 118,
        valueCKwh: 11.8
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
      updatedAt: "2026-02-27T02:00:00Z",
      status: "fresh"
    }
  };
}

function createHousingPayload(region: string) {
  return {
    region,
    requiredSeriesIds: [],
    missingSeriesIds: [],
    metrics: [
      { seriesId: "hvi.value.index", date: "2025-12-31", value: 169.4 },
      { seriesId: "lending.avg_loan_size_aud", date: "2025-12-31", value: 736000 },
      { seriesId: "rates.oo.variable_pct", date: "2025-12-31", value: 6.08 },
      { seriesId: "lending.investor.count", date: "2025-12-31", value: 16950 }
    ],
    updatedAt: "2025-12-31"
  };
}

describe("dashboard server prefetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/energy/overview?region=AU")) {
        return {
          ok: true,
          status: 200,
          json: async () => createEnergyPayload("AU")
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => createHousingPayload("AU")
      };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders initial dashboard values without waiting for client effects", async () => {
    await renderHomePage();

    expect(screen.getByText("118.0 AUD/MWh")).toBeDefined();
    expect(screen.getByText("169.4")).toBeDefined();
    expect(screen.queryByText("SYNCING...")).toBeNull();
  });
});
