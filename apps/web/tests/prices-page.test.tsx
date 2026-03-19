import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderRoute } from "./render-route";

describe("PricesPage", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.doUnmock("../lib/queries/prices-dashboard");
  });

  test("renders a locked state when protected price credentials are unavailable", async () => {
    vi.resetModules();
    vi.doMock("../lib/queries/prices-dashboard", () => ({
      getPricesDashboardData: vi.fn().mockResolvedValue({
        hero: {
          title: "Prices and baskets",
          summary: "Protected price datasets stay server-side until credentials are configured."
        },
        message: "Set AUS_DASH_WEB_USERNAME and AUS_DASH_WEB_PASSWORD to enable protected price views.",
        mode: "locked"
      })
    }));

    const { default: LockedPricesPage } = await import("../app/dashboard/prices/page");
    await renderRoute(await LockedPricesPage());

    expect(screen.getByRole("heading", { name: "Prices and baskets" })).toBeDefined();
    expect(
      screen.getByText("Set AUS_DASH_WEB_USERNAME and AUS_DASH_WEB_PASSWORD to enable protected price views.")
    ).toBeDefined();
  });

  test("renders protected price indexes when credentials are configured", async () => {
    vi.resetModules();
    vi.doMock("../lib/queries/prices-dashboard", () => ({
      getPricesDashboardData: vi.fn().mockResolvedValue({
        hero: {
          title: "Prices and baskets",
          summary: "Protected price datasets stay server-side until credentials are configured."
        },
        mode: "ready",
        majorGoods: [{ label: "Overall", value: "104.2", date: "2026-03-01" }],
        aiDeflation: [{ label: "AU-made spread", value: "98.6", date: "2026-03-01" }],
        unresolvedItems: [
          {
            unresolvedItemId: "item-1",
            title: "Dishwashing liquid",
            merchantName: "Coles",
            priceAmount: 5.2,
            status: "open"
          }
        ],
        metadata: {
          freshness: "Major goods: fresh · AI deflation: fresh",
          methodSummary: "Weighted household basket.",
          secondarySummary: "AI-exposed and control cohorts."
        }
      })
    }));

    const { default: ReadyPricesPage } = await import("../app/dashboard/prices/page");
    await renderRoute(await ReadyPricesPage());

    expect(screen.getByText("104.2")).toBeDefined();
    expect(screen.getByText("AU-made spread")).toBeDefined();
    expect(screen.getByText("Major goods: fresh · AI deflation: fresh")).toBeDefined();
    expect(screen.getByText("Dishwashing liquid")).toBeDefined();
    expect(screen.getByRole("button", { name: "Submit intake" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reconcile" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Classify" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Promote" })).toBeDefined();
  });
});
