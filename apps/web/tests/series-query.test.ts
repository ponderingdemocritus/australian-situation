import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSeriesDashboardData } from "../lib/queries/series-dashboard";

const sdkMocks = vi.hoisted(() => ({
  getApiSeriesById: vi.fn()
}));

vi.mock("@aus-dash/sdk", () => sdkMocks);

describe("getSeriesDashboardData", () => {
  beforeEach(() => {
    sdkMocks.getApiSeriesById.mockReset();
    sdkMocks.getApiSeriesById.mockResolvedValue({
      seriesId: "prices.major_goods.overall.index",
      region: "AU",
      points: [{ date: "2026-02-27", value: 107.53 }]
    });
  });

  test("maps a series response into explorer-friendly rows", async () => {
    const result = await getSeriesDashboardData("prices.major_goods.overall.index");

    expect(result.hero.title).toBe("Series explorer");
    expect(result.seriesId).toBe("prices.major_goods.overall.index");
    expect(result.points).toEqual([{ date: "2026-02-27", value: "107.53" }]);
  });
});
