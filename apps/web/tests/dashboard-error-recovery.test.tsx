import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import HomePage from "../app/page";

const fetchMock = vi.fn();

function energyPayload(region: string, valueAudMwh: number) {
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

function housingPayload(region: string) {
  return {
    region,
    requiredSeriesIds: [],
    missingSeriesIds: [],
    metrics: [],
    updatedAt: "2025-12-31"
  };
}

describe("dashboard data error recovery", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("shows DATA_UNAVAILABLE and clears it after successful refetch", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/energy/overview?region=AU")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({})
        };
      }
      if (url.includes("/api/energy/overview?region=VIC")) {
        return {
          ok: true,
          status: 200,
          json: async () => energyPayload("VIC", 100)
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => housingPayload(url.includes("VIC") ? "VIC" : "AU")
      };
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("DATA_UNAVAILABLE")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Region"), {
      target: { value: "VIC" }
    });

    await waitFor(() => {
      expect(screen.getByText("100.0 AUD/MWh")).toBeDefined();
    });

    expect(screen.queryByText("DATA_UNAVAILABLE")).toBeNull();
  });
});
