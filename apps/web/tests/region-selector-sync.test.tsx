import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHomePage } from "./render-home-page";

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
  return {
    region,
    requiredSeriesIds: [],
    missingSeriesIds: [],
    metrics: [],
    updatedAt: "2026-02-27"
  };
}

describe("Region selector sync", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("one region selector updates housing and energy panels", async () => {
    await renderHomePage();

    const selector = screen.getByLabelText("Region");
    expect(screen.getByText("Housing region: AU")).toBeDefined();
    expect(screen.getByText("Energy region: AU")).toBeDefined();

    fireEvent.change(selector, { target: { value: "VIC" } });

    expect(screen.getByText("Housing region: VIC")).toBeDefined();
    expect(screen.getByText("Energy region: VIC")).toBeDefined();
  });

  test("map click updates region labels and refetches housing + energy", async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      const region = url.includes("region=VIC") ? "VIC" : "AU";

      if (url.includes("/api/energy/overview")) {
        return {
          ok: true,
          json: async () => createEnergyPayload(region)
        };
      }

      return {
        ok: true,
        json: async () => createHousingPayload(region)
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderHomePage();

    fireEvent.click(screen.getByRole("button", { name: "Select region VIC" }));

    expect(screen.getByText("Housing region: VIC")).toBeDefined();
    expect(screen.getByText("Energy region: VIC")).toBeDefined();

    await waitFor(() => {
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calledUrls.some((url) => url.includes("/api/housing/overview?region=VIC"))
      ).toBe(true);
      expect(
        calledUrls.some((url) => url.includes("/api/energy/overview?region=VIC"))
      ).toBe(true);
    });
  });
});
