import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHomePage } from "./render-home-page";

const fetchMock = vi.fn();

const STATE_VALUES: Record<string, number> = {
  NSW: 1960,
  VIC: 1868,
  QLD: 2015,
  SA: 2042,
  WA: 2148,
  TAS: 1887,
  ACT: 1998,
  NT: 2236,
  AU: 2019
};

function createEnergyPayload(region: string) {
  const bill = STATE_VALUES[region] ?? STATE_VALUES.AU;
  return {
    region,
    methodSummary: "Regional energy snapshot.",
    sourceRefs: [
      {
        sourceId: "aer_prd",
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/energy-product-reference-data"
      }
    ],
    panels: {
      liveWholesale: {
        valueAudMwh: region === "NSW" ? 120 : region === "VIC" ? 100 : 118,
        valueCKwh: region === "NSW" ? 12 : region === "VIC" ? 10 : 11.8
      },
      retailAverage: {
        annualBillAudMean: bill,
        annualBillAudMedian: bill - 20
      },
      benchmark: {
        dmoAnnualBillAud: bill + 55
      },
      cpiElectricity: {
        indexValue: 150.2,
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

describe("state-by-state energy panel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      const regionMatch = /region=([A-Z]+)/.exec(url);
      const region = regionMatch?.[1] ?? "AU";

      if (url.includes("/api/energy/overview")) {
        return {
          ok: true,
          status: 200,
          json: async () => createEnergyPayload(region)
        };
      }

      if (url.includes("/api/housing/overview")) {
        return {
          ok: true,
          status: 200,
          json: async () => createHousingPayload(region)
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders only the selected region annual bill row", async () => {
    await renderHomePage("WA");

    await waitFor(() => {
      const panel = within(screen.getByText("State electricity snapshot").closest("section") as HTMLElement);
      expect(panel.getByText("State electricity snapshot")).toBeDefined();
      expect(panel.getByRole("button", { name: /Western Australia/i })).toBeDefined();
      expect(panel.getByText("$2,148")).toBeDefined();
      expect(panel.queryByText("New South Wales")).toBeNull();
      expect(panel.queryByText("Victoria")).toBeNull();
      expect(panel.queryByText("Northern Territory")).toBeNull();
    });
  });

  test("shows the energy drill-down panels together in the secondary column", async () => {
    await renderHomePage();

    await waitFor(() => {
      expect(screen.getByText("State electricity snapshot")).toBeDefined();
      expect(screen.getByText("Electricity mix by source")).toBeDefined();
    });
  });

  test("shows the AU summary row when the national view is selected", async () => {
    await renderHomePage("AU");

    await waitFor(() => {
      const panel = within(screen.getByText("State electricity snapshot").closest("section") as HTMLElement);
      expect(panel.getByRole("button", { name: /Australia/i })).toBeDefined();
      expect(panel.getByText("$2,019")).toBeDefined();
      expect(panel.queryByText("New South Wales")).toBeNull();
      expect(panel.queryByText("Western Australia")).toBeNull();
    });
  });
});
