import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSeedLiveStore, resolveLiveStorePath, writeLiveStoreSync } from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/series/:id", () => {
  const originalStorePath = process.env.AUS_DASH_STORE_PATH;

  afterEach(() => {
    if (originalStorePath) {
      process.env.AUS_DASH_STORE_PATH = originalStorePath;
      return;
    }

    delete process.env.AUS_DASH_STORE_PATH;
  });

  test("reads points from live store path and applies date filters", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-series-store-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const store = createSeedLiveStore();
    const targetPoint = store.observations.find(
      (observation) =>
        observation.seriesId === "hvi.value.index" &&
        observation.regionCode === "AU" &&
        observation.date === "2025-12-31"
    );
    expect(targetPoint).toBeTruthy();
    if (targetPoint) {
      targetPoint.value = 999.9;
    }

    writeLiveStoreSync(store, storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request(
      "/api/series/hvi.value.index?region=AU&from=2025-12-01&to=2025-12-31"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.seriesId).toBe("hvi.value.index");
    expect(body.region).toBe("AU");
    expect(body.points).toEqual([{ date: "2025-12-31", value: 999.9 }]);
  });

  test("returns ordered points and applies date filtering", async () => {
    const response = await app.request(
      "/api/series/hvi.value.index?region=AU&from=2025-11-01&to=2025-12-31"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.seriesId).toBe("hvi.value.index");
    expect(body.region).toBe("AU");
    expect(body.points).toEqual([
      { date: "2025-11-30", value: 168.9 },
      { date: "2025-12-31", value: 169.4 }
    ]);
  });

  test("rejects unsupported region with structured error", async () => {
    const response = await app.request(
      "/api/series/hvi.value.index?region=XYZ"
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "UNSUPPORTED_REGION",
        message: "Unsupported region: XYZ"
      }
    });
  });

  test("rejects unknown series id with structured error", async () => {
    const response = await app.request(
      "/api/series/unknown.series?region=AU"
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "UNKNOWN_SERIES_ID",
        message: "Unknown series id: unknown.series"
      }
    });
  });
});
