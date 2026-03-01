import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
    metrics: [],
    updatedAt: "2026-02-27"
  };
}

function createRetailPayload(basis: "nominal" | "ppp") {
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

function createWholesalePayload() {
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

function installHappyPathFetchMock() {
  fetchMock.mockImplementation(async (input: string | URL | Request) => {
    const url = String(input);

    if (url.includes("/api/energy/overview?region=AU")) {
      return {
        ok: true,
        status: 200,
        json: async () => createEnergyPayload("AU")
      };
    }
    if (url.includes("/api/housing/overview?region=AU")) {
      return {
        ok: true,
        status: 200,
        json: async () => createHousingPayload("AU")
      };
    }
    if (
      url.includes("/api/v1/energy/compare/retail") &&
      url.includes("basis=nominal")
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => createRetailPayload("nominal")
      };
    }
    if (url.includes("/api/v1/energy/compare/retail") && url.includes("basis=ppp")) {
      return {
        ok: true,
        status: 200,
        json: async () => createRetailPayload("ppp")
      };
    }
    if (url.includes("/api/v1/energy/compare/wholesale")) {
      return {
        ok: true,
        status: 200,
        json: async () => createWholesalePayload()
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
      ok: false,
      status: 404,
      json: async () => ({})
    };
  });
}

describe("dashboard energy comparison panel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders AU vs peers retail table from compare endpoint", async () => {
    installHappyPathFetchMock();

    await renderHomePage();

    await waitFor(() => {
      const panel = getEconomicPanel();
      expect(panel.getByText("AU_VS_GLOBAL_COMPARISON")).toBeDefined();
      expect(panel.getByText("DE")).toBeDefined();
      expect(panel.getByText("US")).toBeDefined();
      expect(panel.getByText("0.320 USD/kWh")).toBeDefined();
    });
  });

  test("switching nominal and ppp toggles displayed comparison values", async () => {
    installHappyPathFetchMock();

    await renderHomePage();

    await waitFor(() => {
      expect(getEconomicPanel().getByText("0.320 USD/kWh")).toBeDefined();
    });

    fireEvent.click(getEconomicPanel().getByRole("button", { name: "PPP" }));

    await waitFor(() => {
      expect(getEconomicPanel().getByText("0.290 USD/kWh PPP")).toBeDefined();
    });
  });

  test("shows methodology badges and freshness status", async () => {
    installHappyPathFetchMock();

    await renderHomePage();

    await waitFor(() => {
      const panel = getEconomicPanel();
      expect(panel.getByText("incl_tax")).toBeDefined();
      expect(panel.getByText("household_mid")).toBeDefined();
      expect(panel.getByText("energy-comparison-v1")).toBeDefined();
      expect(panel.getByText("AU_WHOLESALE_PERCENTILE")).toBeDefined();
    });
  });

  test("shows quality warning banner when comparison data is partial", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/v1/energy/compare/wholesale")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({})
        };
      }
      if (url.includes("/api/v1/energy/compare/retail") && url.includes("basis=ppp")) {
        return {
          ok: true,
          status: 200,
          json: async () => createRetailPayload("ppp")
        };
      }
      if (url.includes("/api/v1/energy/compare/retail")) {
        return {
          ok: true,
          status: 200,
          json: async () => createRetailPayload("nominal")
        };
      }
      if (url.includes("/api/v1/metadata/methodology?metric=energy.compare.retail")) {
        return {
          ok: true,
          status: 200,
          json: async () => createMethodologyPayload()
        };
      }
      if (url.includes("/api/energy/overview?region=AU")) {
        return {
          ok: true,
          status: 200,
          json: async () => createEnergyPayload("AU")
        };
      }
      if (url.includes("/api/housing/overview?region=AU")) {
        return {
          ok: true,
          status: 200,
          json: async () => createHousingPayload("AU")
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    });

    await renderHomePage();

    await waitFor(() => {
      expect(getEconomicPanel().getByText("PARTIAL_COMPARISON_DATA")).toBeDefined();
    });
  });
});
