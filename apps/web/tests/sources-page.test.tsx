import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SourcesPage from "../app/dashboard/sources/page";
import { renderRoute } from "./render-route";

vi.mock("../lib/queries/sources-dashboard", () => ({
  getSourcesDashboardData: vi.fn().mockResolvedValue({
    hero: {
      title: "Sources and freshness",
      summary: "Where each dashboard signal comes from, how often it updates, and where it is drifting."
    },
    summary: {
      freshness: "2 stale series",
      generatedAt: "Generated 2026-03-07"
    },
    sources: [
      { name: "AEMO Wholesale", domain: "energy", cadence: "5m", url: "https://example.com/aemo" }
    ],
    staleSeries: [
      {
        seriesId: "energy.live.wholesale.aud_mwh",
        region: "NSW",
        cadence: "5m",
        updatedAt: "2026-03-07",
        lag: "20 min lag"
      }
    ]
  })
}));

describe("SourcesPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the sources dashboard sections", async () => {
    await renderRoute(await SourcesPage());

    expect(screen.getByRole("heading", { name: "Sources and freshness" })).toBeDefined();
    expect(screen.getByText("2 stale series")).toBeDefined();
    expect(screen.getByText("AEMO Wholesale")).toBeDefined();
    expect(screen.getByText(/20 min lag/)).toBeDefined();
  });
});
