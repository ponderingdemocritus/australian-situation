import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/metadata/freshness", () => {
  test("returns stale-series inventory with cadence and lag details", async () => {
    const response = await app.request("/api/metadata/freshness");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      generatedAt: expect.any(String),
      staleSeriesCount: expect.any(Number),
      series: expect.arrayContaining([
        expect.objectContaining({
          seriesId: expect.any(String),
          regionCode: expect.any(String),
          expectedCadence: expect.any(String),
          updatedAt: expect.any(String),
          lagMinutes: expect.any(Number),
          freshnessStatus: expect.stringMatching(/fresh|stale|degraded/)
        })
      ])
    });

    expect(
      body.series.some((entry: { freshnessStatus: string }) =>
        entry.freshnessStatus === "stale"
      )
    ).toBe(true);
    expect(body.staleSeriesCount).toBeGreaterThan(0);
  });
});
