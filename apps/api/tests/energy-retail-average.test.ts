import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/energy/retail-average", () => {
  test("returns summary payload for supported regions", async () => {
    const response = await app.request(
      "/api/energy/retail-average?region=AU&customer_type=residential"
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      region: "AU",
      customerType: "residential",
      annualBillAudMean: expect.any(Number),
      annualBillAudMedian: expect.any(Number),
      freshness: expect.objectContaining({
        updatedAt: expect.any(String),
        status: expect.stringMatching(/fresh|stale|degraded/)
      })
    });
  });

  test("rejects unsupported region with structured error", async () => {
    const response = await app.request(
      "/api/energy/retail-average?region=XYZ&customer_type=residential"
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNSUPPORTED_REGION",
        message: "Unsupported region: XYZ"
      }
    });
  });
});
