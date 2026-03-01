import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, observations, sources } from "@aus-dash/db";
import {
  createSeedLiveStore,
  resolveLiveStorePath,
  writeLiveStoreSync
} from "@aus-dash/shared";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createApp } from "../src/app";
import { createLiveDataRepository } from "../src/repositories/live-data-repository";
import { createPostgresLiveDataRepository } from "../src/repositories/postgres-live-repository";

function parseDate(value: string): Date {
  return new Date(value);
}

function parseOptionalDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  return parseDate(value);
}

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase("postgres/store parity", () => {
  const previousStorePath = process.env.AUS_DASH_STORE_PATH;
  let storePath = "";

  const storeApp = createApp({
    createRepository: () => createLiveDataRepository("store")
  });
  const postgresApp = createApp({
    createRepository: () => createPostgresLiveDataRepository()
  });

  beforeAll(async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-api-parity-"));
    storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));

    const store = createSeedLiveStore();
    writeLiveStoreSync(store, storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const db = getDb();
    await db.delete(observations);
    await db.delete(sources);

    await db.insert(sources).values(store.sources);
    await db.insert(observations).values(
      store.observations.map((observation) => ({
        seriesId: observation.seriesId,
        regionCode: observation.regionCode,
        countryCode: observation.countryCode ?? null,
        market: observation.market ?? null,
        metricFamily: observation.metricFamily ?? null,
        date: observation.date,
        intervalStartUtc: parseOptionalDate(observation.intervalStartUtc),
        intervalEndUtc: parseOptionalDate(observation.intervalEndUtc),
        value: String(observation.value),
        unit: observation.unit,
        currency: observation.currency ?? null,
        taxStatus: observation.taxStatus ?? null,
        consumptionBand: observation.consumptionBand ?? null,
        sourceName: observation.sourceName,
        sourceUrl: observation.sourceUrl,
        publishedAt: parseDate(observation.publishedAt),
        ingestedAt: parseDate(observation.ingestedAt),
        vintage: observation.vintage,
        isModeled: observation.isModeled,
        confidence: observation.confidence,
        methodologyVersion: observation.methodologyVersion ?? null
      }))
    );
  });

  afterAll(() => {
    if (previousStorePath === undefined) {
      delete process.env.AUS_DASH_STORE_PATH;
    } else {
      process.env.AUS_DASH_STORE_PATH = previousStorePath;
    }
  });

  test("series endpoint matches for canonical filtered query", async () => {
    const requestPath =
      "/api/series/hvi.value.index?region=AU&from=2025-11-01&to=2025-12-31";
    const storeResponse = await storeApp.request(requestPath);
    const postgresResponse = await postgresApp.request(requestPath);

    expect(storeResponse.status).toBe(200);
    expect(postgresResponse.status).toBe(200);
    expect(await postgresResponse.json()).toEqual(await storeResponse.json());
  });

  test("energy retail average endpoint matches key contract fields", async () => {
    const requestPath = "/api/energy/retail-average?region=AU";
    const storeResponse = await storeApp.request(requestPath);
    const postgresResponse = await postgresApp.request(requestPath);

    const storeBody = await storeResponse.json();
    const postgresBody = await postgresResponse.json();

    expect(storeResponse.status).toBe(200);
    expect(postgresResponse.status).toBe(200);
    expect(postgresBody).toMatchObject({
      region: storeBody.region,
      annualBillAudMean: storeBody.annualBillAudMean,
      annualBillAudMedian: storeBody.annualBillAudMedian,
      freshness: {
        updatedAt: storeBody.freshness.updatedAt,
        status: storeBody.freshness.status
      }
    });
  });

  test("energy overview endpoint matches dashboard panel fields", async () => {
    const requestPath = "/api/energy/overview?region=AU";
    const storeResponse = await storeApp.request(requestPath);
    const postgresResponse = await postgresApp.request(requestPath);

    const storeBody = await storeResponse.json();
    const postgresBody = await postgresResponse.json();

    expect(storeResponse.status).toBe(200);
    expect(postgresResponse.status).toBe(200);
    expect(postgresBody).toMatchObject({
      region: storeBody.region,
      panels: storeBody.panels,
      freshness: storeBody.freshness
    });
  });

  test("metadata freshness endpoint matches per-series freshness states", async () => {
    const requestPath = "/api/metadata/freshness";
    const storeResponse = await storeApp.request(requestPath);
    const postgresResponse = await postgresApp.request(requestPath);

    const storeBody = await storeResponse.json();
    const postgresBody = await postgresResponse.json();

    expect(storeResponse.status).toBe(200);
    expect(postgresResponse.status).toBe(200);

    const simplifiedStoreSeries = storeBody.series.map(
      (entry: { seriesId: string; updatedAt: string; freshnessStatus: string }) => ({
        seriesId: entry.seriesId,
        updatedAt: entry.updatedAt,
        freshnessStatus: entry.freshnessStatus
      })
    );
    const simplifiedPostgresSeries = postgresBody.series.map(
      (entry: { seriesId: string; updatedAt: string; freshnessStatus: string }) => ({
        seriesId: entry.seriesId,
        updatedAt: entry.updatedAt,
        freshnessStatus: entry.freshnessStatus
      })
    );

    expect(simplifiedPostgresSeries).toEqual(simplifiedStoreSeries);
  });
});
