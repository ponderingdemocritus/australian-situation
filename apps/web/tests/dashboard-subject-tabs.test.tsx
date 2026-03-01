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
    metrics: [
      { seriesId: "hvi.value.index", date: "2025-12-31", value: 169.4 },
      { seriesId: "lending.avg_loan_size_aud", date: "2025-12-31", value: 736000 },
      { seriesId: "rates.oo.variable_pct", date: "2025-12-31", value: 6.08 },
      { seriesId: "lending.investor.count", date: "2025-12-31", value: 16950 }
    ],
    updatedAt: "2025-12-31"
  };
}

function createRetailPayload(basis: "nominal" | "ppp") {
  return {
    country: "AU",
    peers: ["DE"],
    basis,
    taxStatus: "incl_tax",
    consumptionBand: "household_mid",
    auRank: 1,
    methodologyVersion: "energy-comparison-v1",
    rows: [
      { countryCode: "AU", value: basis === "nominal" ? 0.32 : 0.29, rank: 1 },
      { countryCode: "DE", value: basis === "nominal" ? 0.3 : 0.27, rank: 2 }
    ],
    comparisons: []
  };
}

function createWholesalePayload() {
  return {
    country: "AU",
    peers: ["DE"],
    auRank: 1,
    auPercentile: 100,
    methodologyVersion: "energy-comparison-v1",
    rows: [
      { countryCode: "AU", value: 120, rank: 1 },
      { countryCode: "DE", value: 95, rank: 2 }
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

describe("dashboard subject tabs", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    installHappyPathFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  test("defaults to Energy tab and shows only energy-focused sections", async () => {
    await renderHomePage();

    await waitFor(() => {
      const panel = getEconomicPanel();
      expect(panel.getByText("AU_VS_GLOBAL_COMPARISON")).toBeDefined();
    });

    const panel = getEconomicPanel();
    expect(panel.queryByText("HOUSING_OVERVIEW")).toBeNull();
    expect(screen.getByRole("tab", { name: "Energy" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  test("activates Housing tab from URL subject query and hides comparison section", async () => {
    window.history.replaceState({}, "", "/?subject=housing");
    await renderHomePage();

    await waitFor(() => {
      const panel = getEconomicPanel();
      expect(panel.getByText("HOUSING_OVERVIEW")).toBeDefined();
    });

    const panel = getEconomicPanel();
    expect(panel.queryByText("AU_VS_GLOBAL_COMPARISON")).toBeNull();
    expect(screen.getByRole("tab", { name: "Housing" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  test("falls back to Energy tab for invalid subject query", async () => {
    window.history.replaceState({}, "", "/?subject=invalid");
    await renderHomePage();

    await waitFor(() => {
      expect(getEconomicPanel().getByText("AU_VS_GLOBAL_COMPARISON")).toBeDefined();
    });

    expect(screen.getByRole("tab", { name: "Energy" }).getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  test("updates URL and panel content when tabs are clicked", async () => {
    await renderHomePage();

    fireEvent.click(screen.getByRole("tab", { name: "Housing" }));

    await waitFor(() => {
      expect(getEconomicPanel().getByText("HOUSING_OVERVIEW")).toBeDefined();
    });
    expect(window.location.search).toContain("subject=housing");

    fireEvent.click(screen.getByRole("tab", { name: "Energy" }));

    await waitFor(() => {
      expect(getEconomicPanel().getByText("AU_VS_GLOBAL_COMPARISON")).toBeDefined();
    });
    expect(window.location.search).toContain("subject=energy");
  });

  test("supports keyboard activation and tab accessibility semantics", async () => {
    await renderHomePage();

    const tablist = screen.getByRole("tablist", { name: "Subject" });
    expect(tablist).toBeDefined();

    const housingTab = screen.getByRole("tab", { name: "Housing" });
    fireEvent.keyDown(housingTab, { key: "Enter" });

    await waitFor(() => {
      expect(housingTab.getAttribute("aria-selected")).toBe("true");
      expect(getEconomicPanel().getByText("HOUSING_OVERVIEW")).toBeDefined();
    });

    const energyTab = screen.getByRole("tab", { name: "Energy" });
    fireEvent.keyDown(energyTab, { key: " " });

    await waitFor(() => {
      expect(energyTab.getAttribute("aria-selected")).toBe("true");
      expect(getEconomicPanel().getByText("AU_VS_GLOBAL_COMPARISON")).toBeDefined();
    });
  });
});
