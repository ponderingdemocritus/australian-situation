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
      { label: "API health", value: "Operational", detail: "aus-dash-api" },
      { label: "Live wholesale", value: "118.4 AUD/MWh", detail: "11.8 c/kWh" },
      { label: "Retail average", value: "1,940 AUD/year", detail: "Median 1,885 AUD" },
      { label: "Housing coverage", value: "4 tracked metrics", detail: "Updated 2025-12-31" }
    ],
    metadata: {
      freshness: "2 stale series",
      generatedAt: "Generated 2026-03-07",
      methodSummary: "Combines wholesale, retail, benchmark, and CPI source data."
    }
  })
}));

describe("Dashboard shell", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders a structured dashboard home with domain navigation", async () => {
    await renderRoute(await DashboardPage());

    expect(screen.getByRole("heading", { name: "National dashboard" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Overview" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "Energy" }).getAttribute("href")).toBe(
      "/dashboard/energy"
    );
    expect(screen.getByRole("link", { name: "Housing" }).getAttribute("href")).toBe(
      "/dashboard/housing"
    );
    expect(screen.getByRole("link", { name: "Sources" }).getAttribute("href")).toBe(
      "/dashboard/sources"
    );
    expect(screen.getByRole("link", { name: "Prices" }).getAttribute("href")).toBe(
      "/dashboard/prices"
    );
  });

  test("explains what the dashboard is organized around", async () => {
    await renderRoute(await DashboardPage());

    expect(
      screen.getByText("Structured around the generated SDK, with each section tied to a real data domain.")
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Australia snapshot" })).toBeDefined();
    expect(screen.getAllByText("Freshness and provenance").length).toBeGreaterThan(0);
  });
});
