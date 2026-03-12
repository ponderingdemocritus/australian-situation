import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSeedLiveStore, resolveLiveStorePath, writeLiveStoreSync } from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { app } from "../src/app";

const BASIC_AUTH_HEADER = `Basic ${Buffer.from("agent:buildaustralia").toString("base64")}`;

describe("GET /api/prices/major-goods", () => {
  const originalStorePath = process.env.AUS_DASH_STORE_PATH;

  afterEach(() => {
    if (originalStorePath) {
      process.env.AUS_DASH_STORE_PATH = originalStorePath;
      return;
    }

    delete process.env.AUS_DASH_STORE_PATH;
  });

  test("requires basic auth", async () => {
    const response = await app.request("/api/prices/major-goods?region=AU");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Basic realm="AUS Dash Prices"');
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Basic auth is required"
      }
    });
  });

  test("returns the latest major goods price index snapshot with methodology metadata", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-price-index-store-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    writeLiveStoreSync(createSeedLiveStore(), storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request("/api/prices/major-goods?region=AU", {
      headers: {
        Authorization: BASIC_AUTH_HEADER
      }
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      region: "AU",
      methodologyVersion: "prices-major-goods-v1",
      methodSummary: expect.any(String),
      sourceRefs: [
        expect.objectContaining({
          sourceId: "major_goods_prices"
        })
      ],
      indexes: [
        expect.objectContaining({
          seriesId: "prices.major_goods.overall.index",
          value: 107.53
        }),
        expect.objectContaining({
          seriesId: "prices.major_goods.food.index",
          value: 107.49
        }),
        expect.objectContaining({
          seriesId: "prices.major_goods.household_supplies.index",
          value: 107.89
        })
      ]
    });
  });

  test("rejects unsupported regions with a structured error", async () => {
    const response = await app.request("/api/prices/major-goods?region=ZZZ", {
      headers: {
        Authorization: BASIC_AUTH_HEADER
      }
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "UNSUPPORTED_REGION",
        message: "Unsupported region: ZZZ"
      }
    });
  });
});
