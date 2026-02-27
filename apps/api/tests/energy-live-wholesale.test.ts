import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/energy/live-wholesale", () => {
  test("returns contract payload with source and freshness metadata", async () => {
    const response = await app.request(
      "/api/energy/live-wholesale?region=AU&window=5m"
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toMatchObject({
      region: "AU",
      window: "5m",
      isModeled: false,
      methodSummary: expect.any(String),
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          url: expect.any(String)
        })
      ]),
      latest: expect.objectContaining({
        timestamp: expect.any(String),
        valueAudMwh: expect.any(Number),
        valueCKwh: expect.any(Number)
      }),
      rollups: expect.objectContaining({
        oneHourAvgAudMwh: expect.any(Number),
        twentyFourHourAvgAudMwh: expect.any(Number)
      }),
      freshness: expect.objectContaining({
        updatedAt: expect.any(String),
        status: expect.stringMatching(/fresh|stale|degraded/)
      })
    });
  });
});
