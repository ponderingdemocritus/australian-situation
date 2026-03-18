import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import EnergyPage from "../app/dashboard/energy/page";
import { renderRoute } from "./render-route";

const queryMocks = vi.hoisted(() => ({
  getEnergyDashboardData: vi.fn()
}));

vi.mock("../lib/queries/energy-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/queries/energy-dashboard")>();
  return {
    ...actual,
    getEnergyDashboardData: queryMocks.getEnergyDashboardData
  };
});

describe("EnergyPage", () => {
  beforeEach(() => {
    queryMocks.getEnergyDashboardData.mockReset();
    queryMocks.getEnergyDashboardData.mockResolvedValue({
      region: "NSW",
      regionLabel: "New South Wales",
      hero: {
        title: "Energy system",
        summary: "Wholesale, retail, and generation signals from the public energy stack."
      },
      metrics: [
        { label: "Live wholesale", value: "118.4 AUD/MWh", detail: "11.8 c/kWh" },
        { label: "Retail average", value: "1,940 AUD/year", detail: "Median 1,885 AUD" },
        { label: "Benchmark bill", value: "1,985 AUD/year", detail: "Default market offer" },
        { label: "Electricity CPI", value: "151.2", detail: "2025-Q4" }
      ],
      liveWholesale: {
        label: "Latest interval",
        value: "119.3 AUD/MWh",
        detail: "1h avg 116.5 AUD/MWh · 24h avg 116.5 AUD/MWh"
      },
      retailAverage: {
        label: "Residential mean bill",
        value: "1,998 AUD/year",
        detail: "31.2 c/kWh · 1.08 AUD/day"
      },
      householdEstimate: {
        label: "Household estimate",
        value: "Unavailable",
        detail: "Energy household estimate is disabled"
      },
      nationalComparisons: [
        {
          title: "Retail electricity",
          summary: "Australia ranks 3 of 5 peers",
          detail: "Nominal household electricity · energy-comparison-v1",
          peerGaps: ["US +77.8%", "DE +6.7%"],
          rows: [
            { countryCode: "US", rank: "1", value: "0.18 USD/kWh", updatedAt: "2026-02" },
            { countryCode: "DE", rank: "2", value: "0.30 USD/kWh", updatedAt: "2026-02" },
            { countryCode: "AU", rank: "3", value: "0.32 USD/kWh", updatedAt: "2026-02" }
          ]
        },
        {
          title: "Wholesale electricity",
          summary: "Australia ranks 2 of 4 peers · Percentile 66",
          detail: "Cross-country annual market pricing · energy-comparison-v1",
          peerGaps: ["US +71.4%", "DE +26.3%"],
          rows: [
            { countryCode: "US", rank: "1", value: "70.0 USD/MWh", updatedAt: "2026-02-28" },
            { countryCode: "DE", rank: "2", value: "95.0 USD/MWh", updatedAt: "2026-02-28" },
            { countryCode: "AU", rank: "3", value: "120.0 USD/MWh", updatedAt: "2026-02-28" }
          ]
        }
      ],
      mixes: [
        {
          title: "Annual official source mix",
          coverage: "NSW official annual mix",
          updatedAt: "2025-12-31",
          topRows: ["Coal 52.4%", "Solar 18.7%"]
        }
      ]
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the energy dashboard sections", async () => {
    await renderRoute(await EnergyPage({ searchParams: Promise.resolve({ region: "NSW" }) }));

    expect(screen.getByRole("heading", { name: "Energy system" })).toBeDefined();
    expect(screen.getByText("Domestic view · New South Wales")).toBeDefined();
    expect(screen.getByRole("tab", { name: "NSW" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "AU" })).toBeDefined();
    expect(screen.getByText("118.4 AUD/MWh")).toBeDefined();
    expect(screen.getByText("National index against peers")).toBeDefined();
    expect(screen.getByText("Australia ranks 3 of 5 peers")).toBeDefined();
    expect(screen.getByText("0.32 USD/kWh")).toBeDefined();
    expect(screen.getByText("US +77.8%")).toBeDefined();
    expect(screen.getByText("Coal 52.4%")).toBeDefined();
    expect(screen.getByText("119.3 AUD/MWh")).toBeDefined();
    expect(screen.getByText("1,998 AUD/year")).toBeDefined();
    expect(screen.getByText("Energy household estimate is disabled")).toBeDefined();
  });

  test("renders a fallback state when the energy query fails", async () => {
    queryMocks.getEnergyDashboardData.mockRejectedValueOnce(new Error("fetch failed"));

    await renderRoute(await EnergyPage({ searchParams: Promise.resolve({ region: "NSW" }) }));

    expect(screen.getByRole("heading", { name: "Energy system" })).toBeDefined();
    expect(screen.getByText("Energy data is temporarily unavailable.")).toBeDefined();
    expect(screen.getByText("Try again once the API is reachable.")).toBeDefined();
  });
});
