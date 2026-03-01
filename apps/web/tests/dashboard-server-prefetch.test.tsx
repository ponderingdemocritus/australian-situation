import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHomePage } from "./render-home-page";

const fetchMock = vi.fn();

function getEconomicPanel() {
  const panel = screen.getByText("Economic Feed").closest("section");
  if (!panel) {
    throw new Error("Economic panel not found");
  }
  return within(panel);
}

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

function createRetailComparisonPayload(basis: "nominal" | "ppp") {
  return {
    country: "AU",
    peers: ["US", "DE"],
    basis,
    taxStatus: "incl_tax",
    consumptionBand: "household_mid",
    auRank: 1,
    methodologyVersion: "energy-comparison-v1",
    rows: [
      { countryCode: "AU", value: basis === "nominal" ? 0.32 : 0.29, rank: 1 },
      { countryCode: "DE", value: basis === "nominal" ? 0.3 : 0.27, rank: 2 },
      { countryCode: "US", value: basis === "nominal" ? 0.18 : 0.21, rank: 3 }
    ],
    comparisons: []
  };
}

function createWholesaleComparisonPayload() {
  return {
    country: "AU",
    peers: ["US", "DE"],
    auRank: 1,
    auPercentile: 100,
    methodologyVersion: "energy-comparison-v1",
    rows: [
      { countryCode: "AU", value: 120, rank: 1 },
      { countryCode: "DE", value: 95, rank: 2 },
      { countryCode: "US", value: 70, rank: 3 }
    ],
    comparisons: []
  };
}

function createMethodologyPayload() {
  return {
    metric: "energy.compare.retail",
    methodologyVersion: "energy-comparison-v1",
    description: "Retail comparison methodology.",
    requiredDimensions: ["country", "peers", "tax_status", "consumption_band"]
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
      if (
        url.includes("/api/v1/energy/compare/retail") &&
        url.includes("basis=nominal")
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => createRetailComparisonPayload("nominal")
        };
      }
      if (url.includes("/api/v1/energy/compare/retail") && url.includes("basis=ppp")) {
        return {
          ok: true,
          status: 200,
          json: async () => createRetailComparisonPayload("ppp")
        };
      }
      if (url.includes("/api/v1/energy/compare/wholesale")) {
        return {
          ok: true,
          status: 200,
          json: async () => createWholesaleComparisonPayload()
        };
      }
      if (url.includes("/api/v1/metadata/methodology?metric=energy.compare.retail")) {
        return {
          ok: true,
          status: 200,
          json: async () => createMethodologyPayload()
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

    const panel = getEconomicPanel();
    expect(panel.getByText("118.0 AUD/MWh")).toBeDefined();
    expect(panel.getByText("0.320 USD/kWh")).toBeDefined();

    screen.getByRole("tab", { name: "Housing" }).click();
    await waitFor(() => {
      expect(panel.getByText("169.4")).toBeDefined();
    });

    expect(screen.queryByText("SYNCING...")).toBeNull();
    expect(screen.queryByText("COMPARISON_SYNCING...")).toBeNull();
  });
});
