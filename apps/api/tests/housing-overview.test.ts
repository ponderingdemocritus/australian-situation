import { describe, expect, test } from "vitest";
import { app } from "../src/app";

const REQUIRED_SERIES_IDS = [
  "hvi.value.index",
  "lending.oo.count",
  "lending.oo.value_aud",
  "lending.investor.count",
  "lending.investor.value_aud",
  "lending.avg_loan_size_aud",
  "rates.oo.variable_pct",
  "rates.oo.fixed_pct"
] as const;

describe("GET /api/housing/overview", () => {
  test("returns latest points for required series", async () => {
    const response = await app.request("/api/housing/overview?region=AU");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.region).toBe("AU");
    expect(body.missingSeriesIds).toEqual([]);
    expect(body.requiredSeriesIds).toEqual(REQUIRED_SERIES_IDS);
    expect(body.metrics).toHaveLength(REQUIRED_SERIES_IDS.length);
    expect(body.metrics[0]).toMatchObject({
      seriesId: expect.any(String),
      date: expect.any(String),
      value: expect.any(Number)
    });
  });

  test("respects region filter and reports missing series fallback", async () => {
    const response = await app.request("/api/housing/overview?region=VIC");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.region).toBe("VIC");
    expect(body.missingSeriesIds).toContain("rates.oo.fixed_pct");
    expect(body.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ seriesId: "hvi.value.index", value: 172.4 })
      ])
    );
  });

  test("responds within performance budget for warm path", async () => {
    const start = performance.now();
    const response = await app.request("/api/housing/overview?region=AU");
    const elapsedMs = performance.now() - start;

    expect(response.status).toBe(200);
    expect(elapsedMs).toBeLessThan(300);
  });
});
