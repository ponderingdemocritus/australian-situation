import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/energy/overview", () => {
  test("returns merged wholesale, retail, benchmark, and cpi context", async () => {
    const response = await app.request("/api/energy/overview?region=AU");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      region: "AU",
      methodSummary: expect.any(String),
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          url: expect.any(String)
        })
      ]),
      panels: {
        liveWholesale: expect.objectContaining({
          valueAudMwh: expect.any(Number),
          valueCKwh: expect.any(Number)
        }),
        retailAverage: expect.objectContaining({
          annualBillAudMean: expect.any(Number),
          annualBillAudMedian: expect.any(Number)
        }),
        benchmark: expect.objectContaining({
          dmoAnnualBillAud: expect.any(Number)
        }),
        cpiElectricity: expect.objectContaining({
          indexValue: expect.any(Number),
          period: expect.any(String)
        })
      },
      freshness: expect.objectContaining({
        updatedAt: expect.any(String),
        status: expect.stringMatching(/fresh|stale|degraded/)
      })
    });
  });

  test("rejects unsupported region with structured error", async () => {
    const response = await app.request("/api/energy/overview?region=XYZ");
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
