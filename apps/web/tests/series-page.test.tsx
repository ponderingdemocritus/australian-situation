import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SeriesPage from "../app/dashboard/series/page";
import { renderRoute } from "./render-route";

vi.mock("../lib/queries/series-dashboard", () => ({
  getSeriesDashboardData: vi.fn().mockResolvedValue({
    hero: {
      title: "Series explorer",
      summary: "Direct access to SDK series points for selected public metrics."
    },
    seriesId: "prices.major_goods.overall.index",
    region: "AU",
    points: [{ date: "2026-02-27", value: "107.53" }]
  })
}));

describe("SeriesPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders series point data", async () => {
    await renderRoute(await SeriesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Series explorer" })).toBeDefined();
    expect(screen.getByText("prices.major_goods.overall.index")).toBeDefined();
    expect(screen.getByText("107.53")).toBeDefined();
  });
});
