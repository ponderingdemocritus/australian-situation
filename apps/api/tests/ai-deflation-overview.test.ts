import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSeedLiveStore, resolveLiveStorePath, writeLiveStoreSync } from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { app } from "../src/app";

const BASIC_AUTH_HEADER = `Basic ${Buffer.from("agent:buildaustralia").toString("base64")}`;

describe("GET /api/prices/ai-deflation", () => {
  const originalStorePath = process.env.AUS_DASH_STORE_PATH;

  afterEach(() => {
    if (originalStorePath) {
      process.env.AUS_DASH_STORE_PATH = originalStorePath;
      return;
    }

    delete process.env.AUS_DASH_STORE_PATH;
  });

  test("requires basic auth", async () => {
    const response = await app.request("/api/prices/ai-deflation?region=AU");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Basic realm="AUS Dash Prices"');
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Basic auth is required"
      }
    });
  });

  test("returns the latest AI-deflation cohort snapshot with methodology metadata", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-ai-deflation-store-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    writeLiveStoreSync(createSeedLiveStore(), storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request("/api/prices/ai-deflation?region=AU", {
      headers: {
        Authorization: BASIC_AUTH_HEADER
      }
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      region: "AU",
      methodologyVersion: "prices-major-goods-v1",
      indexes: [
        expect.objectContaining({
          seriesId: "prices.au_made.all.index",
          value: 107.24
        }),
        expect.objectContaining({
          seriesId: "prices.au_made.ai_exposed.index",
          value: 104.76
        }),
        expect.objectContaining({
          seriesId: "prices.au_made.control.index",
          value: 109.72
        }),
        expect.objectContaining({
          seriesId: "prices.imported.matched_control.index",
          value: 107.89
        }),
        expect.objectContaining({
          seriesId: "prices.ai_deflation.spread.au_made_vs_control.index",
          value: -4.96
        })
      ]
    });
  });
});
