import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import EnergyPage from "../app/dashboard/energy/page";
import { renderRoute } from "./render-route";

vi.mock("../lib/queries/energy-dashboard", () => ({
  getEnergyDashboardData: vi.fn().mockResolvedValue({
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
    comparisons: [
      { label: "Retail comparison", value: "Rank 3 of 5", detail: "Nominal household electricity" },
      { label: "Wholesale comparison", value: "Rank 2 of 4", detail: "Cross-country annual market pricing" }
    ],
    mixes: [
      { title: "National mix", coverage: "AU annual", updatedAt: "2025-12-31", topRows: ["Coal 52.4%", "Solar 18.7%"] }
    ]
  })
}));

describe("EnergyPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the energy dashboard sections", async () => {
    await renderRoute(await EnergyPage());

    expect(screen.getByRole("heading", { name: "Energy system" })).toBeDefined();
    expect(screen.getByText("118.4 AUD/MWh")).toBeDefined();
    expect(screen.getByText("Rank 3 of 5")).toBeDefined();
    expect(screen.getByText("Coal 52.4%")).toBeDefined();
  });
});
