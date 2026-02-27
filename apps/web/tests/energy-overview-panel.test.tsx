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

function createOverviewPayload(region: string, valueAudMwh: number) {
  return {
    region,
    panels: {
      liveWholesale: {
        valueAudMwh,
        valueCKwh: valueAudMwh / 10
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

describe("Energy overview top-left panel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders top-left ENERGY_OVERVIEW panel with fetched data", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/energy/overview?region=AU")) {
        return {
          ok: true,
          json: async () => createOverviewPayload("AU", 118)
        };
      }

      return {
        ok: true,
        json: async () => createHousingPayload("AU")
      };
    });

    await renderHomePage();

    expect(getEconomicPanel().getByText("ENERGY_OVERVIEW")).toBeDefined();
    await waitFor(() => {
      const panel = getEconomicPanel();
      expect(panel.getByText("LIVE_RRP")).toBeDefined();
      expect(panel.getByText("118.0 AUD/MWh")).toBeDefined();
      expect(panel.getByText("1985 AUD")).toBeDefined();
      expect(panel.getByText("2025-Q4")).toBeDefined();
    });
  });

  test("refetches overview when region changes and updates panel", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/energy/overview?region=AU")) {
        return {
          ok: true,
          json: async () => createOverviewPayload("AU", 118)
        };
      }
      if (url.includes("/api/energy/overview?region=VIC")) {
        return {
          ok: true,
          json: async () => createOverviewPayload("VIC", 100)
        };
      }

      return {
        ok: true,
        json: async () => createHousingPayload(url.includes("VIC") ? "VIC" : "AU")
      };
    });

    await renderHomePage();

    await waitFor(() => {
      expect(getEconomicPanel().getByText("118.0 AUD/MWh")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Region"), {
      target: { value: "VIC" }
    });

    await waitFor(() => {
      expect(getEconomicPanel().getByText("100.0 AUD/MWh")).toBeDefined();
    });

    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(
      calledUrls.some((url) => url.includes("/api/energy/overview?region=AU"))
    ).toBe(true);
    expect(
      calledUrls.some((url) => url.includes("/api/energy/overview?region=VIC"))
    ).toBe(true);
  });
});
