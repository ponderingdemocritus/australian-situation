import { describe, expect, test } from "vitest";
import { createApp } from "../src/app";
import type { LiveDataRepository } from "../src/repositories/live-data-repository";

describe("Global error handling", () => {
  test("returns structured not-found errors for unknown routes", async () => {
    const app = createApp();
    const response = await app.request("/api/does-not-exist");
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found: /api/does-not-exist"
      }
    });
  });

  test("returns structured 500 errors for unexpected runtime failures", async () => {
    const repository: LiveDataRepository = {
      getHousingOverview: async () => {
        throw new Error("boom");
      },
      getSeries: async () => {
        throw new Error("boom");
      },
      getEnergyLiveWholesale: async () => {
        throw new Error("boom");
      },
      getEnergyRetailAverage: async () => {
        throw new Error("boom");
      },
      getEnergyRetailComparison: async () => {
        throw new Error("boom");
      },
      getEnergyWholesaleComparison: async () => {
        throw new Error("boom");
      },
      getEnergyOverview: async () => {
        throw new Error("boom");
      },
      getMetadataFreshness: async () => {
        throw new Error("boom");
      },
      getMetadataSources: async () => {
        throw new Error("boom");
      }
    };
    const app = createApp({
      createRepository: () => repository,
      env: {
        ...process.env,
        ENABLE_ENERGY_HOUSEHOLD_ESTIMATE: "true"
      },
      logger: {
        error: () => {}
      }
    });

    const response = await app.request("/api/metadata/freshness");
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  });

  test("returns structured 500 when series route throws a non-domain error", async () => {
    const repository: LiveDataRepository = {
      getHousingOverview: async () => {
        throw new Error("boom");
      },
      getSeries: async () => {
        throw new Error("boom");
      },
      getEnergyLiveWholesale: async () => {
        throw new Error("boom");
      },
      getEnergyRetailAverage: async () => {
        throw new Error("boom");
      },
      getEnergyRetailComparison: async () => {
        throw new Error("boom");
      },
      getEnergyWholesaleComparison: async () => {
        throw new Error("boom");
      },
      getEnergyOverview: async () => {
        throw new Error("boom");
      },
      getMetadataFreshness: async () => {
        throw new Error("boom");
      },
      getMetadataSources: async () => {
        throw new Error("boom");
      }
    };
    const app = createApp({
      createRepository: () => repository,
      logger: {
        error: () => {}
      }
    });

    const response = await app.request("/api/series/hvi.value.index?region=AU");
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  });
});
