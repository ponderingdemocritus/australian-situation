import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import HomePage from "../app/page";

const fetchMock = vi.fn();

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

    render(<HomePage />);

    expect(screen.getByText("HOUSING_OVERVIEW")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("HVI_INDEX")).toBeDefined();
      expect(screen.getByText("169.4")).toBeDefined();
      expect(screen.getByText("AVG_LOAN")).toBeDefined();
      expect(screen.getByText("$736,000")).toBeDefined();
      expect(screen.getByText("OO_VARIABLE_RATE")).toBeDefined();
      expect(screen.getByText("6.08%")).toBeDefined();
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

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("169.4")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Region"), {
      target: { value: "VIC" }
    });

    await waitFor(() => {
      expect(screen.getByText("172.4")).toBeDefined();
      expect(screen.getByText("$756,000")).toBeDefined();
      expect(screen.getByText("6.16%")).toBeDefined();
    });

    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls).toContain(
      "http://localhost:3001/api/housing/overview?region=AU"
    );
    expect(calledUrls).toContain(
      "http://localhost:3001/api/housing/overview?region=VIC"
    );
  });
});
