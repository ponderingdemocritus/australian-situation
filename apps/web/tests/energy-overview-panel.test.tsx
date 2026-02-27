import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import HomePage from "../app/page";

const fetchMock = vi.fn();

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

    render(<HomePage />);

    expect(screen.getByText("ENERGY_OVERVIEW")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText("LIVE_RRP")).toBeDefined();
      expect(screen.getByText("118.0 AUD/MWh")).toBeDefined();
      expect(screen.getByText("1985 AUD")).toBeDefined();
      expect(screen.getByText("2025-Q4")).toBeDefined();
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

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("118.0 AUD/MWh")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Region"), {
      target: { value: "VIC" }
    });

    await waitFor(() => {
      expect(screen.getByText("100.0 AUD/MWh")).toBeDefined();
    });

    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls).toContain(
      "http://localhost:3001/api/energy/overview?region=AU"
    );
    expect(calledUrls).toContain(
      "http://localhost:3001/api/energy/overview?region=VIC"
    );
  });
});
