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
        valueAudMwh: region === "VIC" ? 100 : 118,
        valueCKwh: region === "VIC" ? 10 : 11.8
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
  const isVic = region === "VIC";
  return {
    region,
    requiredSeriesIds: [],
    missingSeriesIds: [],
    metrics: [
      { seriesId: "hvi.value.index", date: "2025-12-31", value: isVic ? 172.4 : 169.4 },
      { seriesId: "lending.avg_loan_size_aud", date: "2025-12-31", value: isVic ? 756000 : 736000 },
      { seriesId: "rates.oo.variable_pct", date: "2025-12-31", value: isVic ? 6.16 : 6.08 },
      { seriesId: "lending.investor.count", date: "2025-12-31", value: isVic ? 4180 : 16950 }
    ],
    updatedAt: "2025-12-31"
  };
}

describe("Housing overview right panel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders right-side HOUSING_OVERVIEW metrics from API", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/housing/overview?region=AU")) {
        return {
          ok: true,
          json: async () => createHousingPayload("AU")
        };
      }

      return {
        ok: true,
        json: async () => createEnergyPayload("AU")
      };
    });

    await renderHomePage();

    fireEvent.click(screen.getByRole("tab", { name: "Housing" }));
    expect(getEconomicPanel().getByText("HOUSING_OVERVIEW")).toBeDefined();

    await waitFor(() => {
      const panel = getEconomicPanel();
      expect(panel.getByText("HVI_INDEX")).toBeDefined();
      expect(panel.getByText("169.4")).toBeDefined();
      expect(panel.getByText("AVG_LOAN")).toBeDefined();
      expect(panel.getByText("$736,000")).toBeDefined();
      expect(panel.getByText("OO_VARIABLE_RATE")).toBeDefined();
      expect(panel.getByText("6.08%")).toBeDefined();
    });
  });

  test("refetches housing overview on region change and updates right panel", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/housing/overview?region=VIC")) {
        return {
          ok: true,
          json: async () => createHousingPayload("VIC")
        };
      }
      if (url.includes("/api/housing/overview?region=AU")) {
        return {
          ok: true,
          json: async () => createHousingPayload("AU")
        };
      }

      return {
        ok: true,
        json: async () => createEnergyPayload(url.includes("VIC") ? "VIC" : "AU")
      };
    });

    await renderHomePage();

    fireEvent.click(screen.getByRole("tab", { name: "Housing" }));
    await waitFor(() => {
      expect(getEconomicPanel().getByText("169.4")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Region"), {
      target: { value: "VIC" }
    });

    await waitFor(() => {
      const panel = getEconomicPanel();
      expect(panel.getByText("172.4")).toBeDefined();
      expect(panel.getByText("$756,000")).toBeDefined();
      expect(panel.getByText("6.16%")).toBeDefined();
    });

    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(
      calledUrls.some((url) => url.includes("/api/housing/overview?region=AU"))
    ).toBe(true);
    expect(
      calledUrls.some((url) => url.includes("/api/housing/overview?region=VIC"))
    ).toBe(true);
  });
});
