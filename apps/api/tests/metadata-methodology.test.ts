import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/v1/metadata/methodology", () => {
  test("returns methodology metadata for a known metric key", async () => {
    const response = await app.request(
      "/api/v1/metadata/methodology?metric=energy.compare.retail"
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      metric: "energy.compare.retail",
      methodologyVersion: expect.any(String),
      description: expect.any(String),
      requiredDimensions: expect.arrayContaining([
        "country",
        "peers",
        "tax_status",
        "consumption_band"
      ])
    });
  });

  test("returns not found for unknown metric keys", async () => {
    const response = await app.request(
      "/api/v1/metadata/methodology?metric=energy.compare.unknown"
    );
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNKNOWN_METRIC",
        message: "Unknown metric: energy.compare.unknown"
      }
    });
  });
});
