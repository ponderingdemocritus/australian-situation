import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import EnergyPage from "../app/dashboard/energy/page";
import { renderRoute } from "./render-route";

const queryMocks = vi.hoisted(() => ({
  getEnergyDashboardData: vi.fn()
}));

vi.mock("../lib/queries/energy-dashboard", () => ({
  getEnergyDashboardData: queryMocks.getEnergyDashboardData
}));

describe("EnergyPage", () => {
  beforeEach(() => {
    queryMocks.getEnergyDashboardData.mockReset();
    queryMocks.getEnergyDashboardData.mockResolvedValue({
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
      comparisons: [
        { label: "Retail comparison", value: "Rank 3 of 5", detail: "Nominal household electricity" },
        { label: "Wholesale comparison", value: "Rank 2 of 4", detail: "Cross-country annual market pricing" }
      ],
      mixes: [
        { title: "National mix", coverage: "AU annual", updatedAt: "2025-12-31", topRows: ["Coal 52.4%", "Solar 18.7%"] }
      ]
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the energy dashboard sections", async () => {
    await renderRoute(await EnergyPage());

    expect(screen.getByRole("heading", { name: "Energy system" })).toBeDefined();
    expect(screen.getByText("118.4 AUD/MWh")).toBeDefined();
    expect(screen.getByText("Rank 3 of 5")).toBeDefined();
    expect(screen.getByText("Coal 52.4%")).toBeDefined();
    expect(screen.getByText("119.3 AUD/MWh")).toBeDefined();
    expect(screen.getByText("1,998 AUD/year")).toBeDefined();
    expect(screen.getByText("Energy household estimate is disabled")).toBeDefined();
  });

  test("renders a fallback state when the energy query fails", async () => {
    queryMocks.getEnergyDashboardData.mockRejectedValueOnce(new Error("fetch failed"));

    await renderRoute(await EnergyPage());

    expect(screen.getByRole("heading", { name: "Energy system" })).toBeDefined();
    expect(screen.getByText("Energy data is temporarily unavailable.")).toBeDefined();
    expect(screen.getByText("Try again once the API is reachable.")).toBeDefined();
  });
});
