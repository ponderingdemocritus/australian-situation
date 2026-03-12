import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getPricesDashboardData } from "../lib/queries/prices-dashboard";

const sdkMocks = vi.hoisted(() => ({
  getApiPricesAiDeflation: vi.fn(),
  getApiPricesMajorGoods: vi.fn()
}));

vi.mock("@aus-dash/sdk", () => sdkMocks);

describe("getPricesDashboardData", () => {
  const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalUsername = process.env.AUS_DASH_WEB_USERNAME;
  const originalPassword = process.env.AUS_DASH_WEB_PASSWORD;

  beforeEach(() => {
    sdkMocks.getApiPricesAiDeflation.mockReset();
    sdkMocks.getApiPricesMajorGoods.mockReset();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.AUS_DASH_WEB_USERNAME;
    delete process.env.AUS_DASH_WEB_PASSWORD;
  });

  afterEach(() => {
    if (originalApiBaseUrl) {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    }

    if (originalUsername) {
      process.env.AUS_DASH_WEB_USERNAME = originalUsername;
    } else {
      delete process.env.AUS_DASH_WEB_USERNAME;
    }

    if (originalPassword) {
      process.env.AUS_DASH_WEB_PASSWORD = originalPassword;
    } else {
      delete process.env.AUS_DASH_WEB_PASSWORD;
    }
  });

  test("returns a locked state when web credentials are not configured for a non-local API", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.com";

    const result = await getPricesDashboardData();

    expect(result).toEqual({
      hero: {
        summary: "Protected price datasets stay server-side until credentials are configured.",
        title: "Prices and baskets"
      },
      message: "Set AUS_DASH_WEB_USERNAME and AUS_DASH_WEB_PASSWORD to enable protected price views.",
      mode: "locked"
    });
    expect(sdkMocks.getApiPricesMajorGoods).not.toHaveBeenCalled();
    expect(sdkMocks.getApiPricesAiDeflation).not.toHaveBeenCalled();
  });

  test("maps protected price endpoints into dashboard sections with local default auth", async () => {
    sdkMocks.getApiPricesMajorGoods.mockResolvedValue({
      region: "AU",
      methodologyVersion: "major-goods-v1",
      methodSummary: "Weighted household basket.",
      sourceRefs: [],
      indexes: [
        { seriesId: "prices.major_goods.overall.index", label: "Overall", date: "2026-03-01", value: 104.2 }
      ],
      freshness: {
        updatedAt: "2026-03-01T00:00:00Z",
        status: "fresh"
      }
    });
    sdkMocks.getApiPricesAiDeflation.mockResolvedValue({
      region: "AU",
      methodologyVersion: "ai-deflation-v1",
      methodSummary: "AI-exposed and control cohorts.",
      sourceRefs: [],
      indexes: [
        { seriesId: "prices.ai_deflation.spread.au_made_vs_control.index", label: "AU-made spread", date: "2026-03-01", value: 98.6 }
      ],
      freshness: {
        updatedAt: "2026-03-01T00:00:00Z",
        status: "fresh"
      }
    });

    const result = await getPricesDashboardData();

    expect(result.mode).toBe("ready");
    if (result.mode !== "ready") {
      throw new Error("Expected ready mode");
    }

    expect(result.majorGoods[0]).toEqual({
      date: "2026-03-01",
      label: "Overall",
      value: "104.2"
    });
    expect(result.aiDeflation[0]).toEqual({
      date: "2026-03-01",
      label: "AU-made spread",
      value: "98.6"
    });
    expect(result.metadata).toEqual({
      freshness: "Major goods: fresh · AI deflation: fresh",
      methodSummary: "Weighted household basket.",
      secondarySummary: "AI-exposed and control cohorts."
    });
    expect(sdkMocks.getApiPricesMajorGoods).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: expect.stringMatching(/^Basic /)
        }),
        query: { region: "AU" }
      })
    );
  });
});
