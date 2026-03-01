import { afterEach, describe, expect, test } from "vitest";
import { app } from "../src/app";

const ENV_KEY = "ENABLE_ENERGY_HOUSEHOLD_ESTIMATE";
const previousValue = process.env[ENV_KEY];

afterEach(() => {
  if (previousValue === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = previousValue;
  }
});

describe("GET /api/energy/household-estimate", () => {
  test("returns feature disabled error when flag is not enabled", async () => {
    delete process.env[ENV_KEY];
    const response = await app.request(
      "/api/energy/household-estimate?region=AU&usage_profile=default"
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "FEATURE_DISABLED",
        message: "Energy household estimate is disabled"
      }
    });
  });

  test("returns modeled estimate with provenance when flag is enabled", async () => {
    process.env[ENV_KEY] = "true";
    const response = await app.request(
      "/api/energy/household-estimate?region=AU&usage_profile=default"
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      region: "AU",
      usageProfile: "default",
      isModeled: true,
      confidence: "derived",
      methodologyVersion: expect.any(String),
      methodSummary: expect.any(String),
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          url: expect.any(String)
        })
      ]),
      monthlyAud: expect.any(Number),
      updatedAt: expect.any(String)
    });
  });

  test("rejects unsupported region even when feature flag is enabled", async () => {
    process.env[ENV_KEY] = "true";
    const response = await app.request(
      "/api/energy/household-estimate?region=XYZ&usage_profile=default"
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
