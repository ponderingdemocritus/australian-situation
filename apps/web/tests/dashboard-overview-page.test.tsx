import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import DashboardPage from "../app/dashboard/page";
import { renderRoute } from "./render-route";

vi.mock("../lib/queries/dashboard-overview", () => ({
  getDashboardOverview: vi.fn().mockResolvedValue({
    hero: {
      title: "Australia snapshot",
      description: "Live conditions drawn directly from the generated SDK.",
      detail: "7 public sources"
    },
    metrics: [
      {
        label: "API health",
        value: "Operational",
        detail: "aus-dash-api"
      },
      {
        label: "Live wholesale",
        value: "118.4 AUD/MWh",
        detail: "11.8 c/kWh"
      },
      {
        label: "Retail average",
        value: "1,940 AUD/year",
        detail: "Median 1,885 AUD"
      },
      {
        label: "Housing coverage",
        value: "4 tracked metrics",
        detail: "Updated 2025-12-31"
      }
    ],
    metadata: {
      freshness: "2 stale series",
      generatedAt: "Generated 2026-03-07",
      methodSummary: "Combines wholesale, retail, benchmark, and CPI source data."
    }
  })
}));

describe("Dashboard overview page", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the SDK-backed overview metrics on the dashboard home", async () => {
    await renderRoute(await DashboardPage());

    expect(screen.getByText("Australia snapshot")).toBeDefined();
    expect(screen.getByText("7 public sources")).toBeDefined();
    expect(screen.getByText("118.4 AUD/MWh")).toBeDefined();
    expect(screen.getByText("1,940 AUD/year")).toBeDefined();
    expect(screen.getByText("4 tracked metrics")).toBeDefined();
    expect(screen.getByText("2 stale series")).toBeDefined();
  });
});
