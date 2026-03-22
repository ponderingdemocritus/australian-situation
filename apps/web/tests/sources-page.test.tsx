import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as sourcesDashboard from "../lib/queries/sources-dashboard";
import SourcesPage from "../app/dashboard/sources/page";
import { renderRoute } from "./render-route";

vi.mock("../lib/queries/sources-dashboard", () => ({
  getSourcesDashboardData: vi.fn()
}));

const getSourcesDashboardDataMock = vi.mocked(sourcesDashboard.getSourcesDashboardData);

describe("SourcesPage", () => {
  beforeEach(() => {
    getSourcesDashboardDataMock.mockReset();
    getSourcesDashboardDataMock.mockResolvedValue({
      hero: {
        title: "Sources and freshness",
        summary: "Where each dashboard signal comes from, how often it updates, and where it is drifting."
      },
      summary: {
        freshness: "2 stale series",
        generatedAt: "Generated 2026-03-07"
      },
      sources: [
        {
          sourceId: "aemo_wholesale",
          name: "AEMO Wholesale",
          domain: "energy",
          cadence: "5m",
          url: "https://example.com/aemo"
        }
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
    });
  });

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

  test("does not emit duplicate-key warnings when source URLs repeat", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getSourcesDashboardDataMock.mockResolvedValueOnce({
      hero: {
        title: "Sources and freshness",
        summary: "Where each dashboard signal comes from, how often it updates, and where it is drifting."
      },
      summary: {
        freshness: "2 stale series",
        generatedAt: "Generated 2026-03-07"
      },
      sources: [
        {
          sourceId: "aemo_wholesale",
          name: "AEMO Wholesale",
          domain: "energy",
          cadence: "5m",
          url: "https://example.com/shared"
        },
        {
          sourceId: "aemo_nem_source_mix",
          name: "AEMO NEM fuel mix dashboard",
          domain: "energy",
          cadence: "5m",
          url: "https://example.com/shared"
        }
      ],
      staleSeries: []
    });

    await renderRoute(await SourcesPage());

    expect(screen.getByText("AEMO Wholesale")).toBeDefined();
    expect(screen.getByText("AEMO NEM fuel mix dashboard")).toBeDefined();
    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        typeof message === "string" && message.includes("same key")
      )
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
