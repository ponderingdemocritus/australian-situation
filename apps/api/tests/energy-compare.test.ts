import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createSeedLiveStore,
  resolveLiveStorePath,
  writeLiveStoreSync
} from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { app } from "../src/app";

function createComparisonStorePath(name: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), `aus-dash-compare-${name}-`));
  return resolveLiveStorePath(path.join(tempDir, "live-store.json"));
}

function seedComparisonData(storePath: string) {
  const store = createSeedLiveStore();

  store.observations.push(
    {
      seriesId: "energy.retail.price.country.usd_kwh_nominal",
      regionCode: "AU",
      countryCode: "AU",
      market: "AU",
      metricFamily: "retail",
      date: "2026-02",
      value: 0.32,
      unit: "usd_kwh",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "AER",
      sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
      publishedAt: "2026-02-28T00:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.retail.price.country.usd_kwh_nominal",
      regionCode: "US",
      countryCode: "US",
      market: "US",
      metricFamily: "retail",
      date: "2026-02",
      value: 0.18,
      unit: "usd_kwh",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "EIA",
      sourceUrl: "https://www.eia.gov/opendata/documentation.php",
      publishedAt: "2026-02-28T00:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.retail.price.country.usd_kwh_nominal",
      regionCode: "DE",
      countryCode: "DE",
      market: "EUROSTAT",
      metricFamily: "retail",
      date: "2026-02",
      value: 0.3,
      unit: "usd_kwh",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "Eurostat",
      sourceUrl: "https://ec.europa.eu/eurostat/",
      publishedAt: "2026-02-28T00:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.retail.price.country.usd_kwh_ppp",
      regionCode: "AU",
      countryCode: "AU",
      market: "AU",
      metricFamily: "retail",
      date: "2026-02",
      value: 0.29,
      unit: "usd_kwh_ppp",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "AER",
      sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
      publishedAt: "2026-02-28T00:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.retail.price.country.usd_kwh_ppp",
      regionCode: "US",
      countryCode: "US",
      market: "US",
      metricFamily: "retail",
      date: "2026-02",
      value: 0.21,
      unit: "usd_kwh_ppp",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "EIA",
      sourceUrl: "https://www.eia.gov/opendata/documentation.php",
      publishedAt: "2026-02-28T00:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.retail.price.country.usd_kwh_ppp",
      regionCode: "DE",
      countryCode: "DE",
      market: "EUROSTAT",
      metricFamily: "retail",
      date: "2026-02",
      value: 0.27,
      unit: "usd_kwh_ppp",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "Eurostat",
      sourceUrl: "https://ec.europa.eu/eurostat/",
      publishedAt: "2026-02-28T00:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.wholesale.spot.country.usd_mwh",
      regionCode: "AU",
      countryCode: "AU",
      market: "AU",
      metricFamily: "wholesale",
      date: "2026-02-28T01:00:00Z",
      intervalStartUtc: "2026-02-28T00:00:00Z",
      intervalEndUtc: "2026-02-28T01:00:00Z",
      value: 120,
      unit: "usd_mwh",
      currency: "USD",
      sourceName: "AEMO",
      sourceUrl: "https://www.aemo.com.au/",
      publishedAt: "2026-02-28T01:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.wholesale.spot.country.usd_mwh",
      regionCode: "US",
      countryCode: "US",
      market: "US",
      metricFamily: "wholesale",
      date: "2026-02-28T01:00:00Z",
      intervalStartUtc: "2026-02-28T00:00:00Z",
      intervalEndUtc: "2026-02-28T01:00:00Z",
      value: 70,
      unit: "usd_mwh",
      currency: "USD",
      sourceName: "EIA",
      sourceUrl: "https://www.eia.gov/opendata/documentation.php",
      publishedAt: "2026-02-28T01:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    },
    {
      seriesId: "energy.wholesale.spot.country.usd_mwh",
      regionCode: "DE",
      countryCode: "DE",
      market: "ENTSOE",
      metricFamily: "wholesale",
      date: "2026-02-28T01:00:00Z",
      intervalStartUtc: "2026-02-28T00:00:00Z",
      intervalEndUtc: "2026-02-28T01:00:00Z",
      value: 95,
      unit: "usd_mwh",
      currency: "USD",
      sourceName: "ENTSO-E",
      sourceUrl: "https://transparency.entsoe.eu/",
      publishedAt: "2026-02-28T01:00:00Z",
      ingestedAt: "2026-02-28T01:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    }
  );

  writeLiveStoreSync(store, storePath);
}

describe("GET /api/v1/energy/compare/*", () => {
  const originalStorePath = process.env.AUS_DASH_STORE_PATH;

  afterEach(() => {
    if (originalStorePath) {
      process.env.AUS_DASH_STORE_PATH = originalStorePath;
      return;
    }

    delete process.env.AUS_DASH_STORE_PATH;
  });

  test("returns AU retail comparison with ranks and peer gaps", async () => {
    const storePath = createComparisonStorePath("retail");
    seedComparisonData(storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request(
      "/api/v1/energy/compare/retail?country=AU&peers=US,DE&basis=nominal&tax_status=incl_tax&consumption_band=household_mid"
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      country: "AU",
      peers: ["US", "DE"],
      basis: "nominal",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      auRank: 1,
      methodologyVersion: "energy-comparison-v1",
      rows: expect.arrayContaining([
        expect.objectContaining({ countryCode: "AU", value: 0.32, rank: 1 }),
        expect.objectContaining({ countryCode: "US", value: 0.18 }),
        expect.objectContaining({ countryCode: "DE", value: 0.3 })
      ]),
      comparisons: expect.arrayContaining([
        expect.objectContaining({ peerCountryCode: "US", gapPct: expect.any(Number) }),
        expect.objectContaining({ peerCountryCode: "DE", gapPct: expect.any(Number) })
      ])
    });
  });

  test("returns AU wholesale comparison with percentile and peer gaps", async () => {
    const storePath = createComparisonStorePath("wholesale");
    seedComparisonData(storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request(
      "/api/v1/energy/compare/wholesale?country=AU&peers=US,DE"
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      country: "AU",
      peers: ["US", "DE"],
      auRank: 1,
      auPercentile: 100,
      methodologyVersion: "energy-comparison-v1",
      rows: expect.arrayContaining([
        expect.objectContaining({ countryCode: "AU", value: 120, rank: 1 }),
        expect.objectContaining({ countryCode: "US", value: 70 }),
        expect.objectContaining({ countryCode: "DE", value: 95 })
      ])
    });
  });

  test("defaults peer list to empty when peers query is not provided", async () => {
    const storePath = createComparisonStorePath("wholesale-default-peers");
    seedComparisonData(storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request("/api/v1/energy/compare/wholesale?country=AU");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      country: "AU",
      peers: [],
      auRank: 1
    });
  });

  test("rejects unsupported comparison basis", async () => {
    const response = await app.request(
      "/api/v1/energy/compare/retail?country=AU&peers=US,DE&basis=fx"
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNSUPPORTED_BASIS",
        message: "Unsupported basis: fx"
      }
    });
  });

  test("rejects unsupported tax status filters", async () => {
    const response = await app.request(
      "/api/v1/energy/compare/retail?country=AU&peers=US,DE&tax_status=unknown_tax"
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNSUPPORTED_TAX_STATUS",
        message: "Unsupported tax status: unknown_tax"
      }
    });
  });

  test("rejects unsupported consumption band filters", async () => {
    const response = await app.request(
      "/api/v1/energy/compare/retail?country=AU&peers=US,DE&consumption_band=unknown_band"
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNSUPPORTED_CONSUMPTION_BAND",
        message: "Unsupported consumption band: unknown_band"
      }
    });
  });

  test("rejects unknown peer countries when no comparable data exists", async () => {
    const storePath = createComparisonStorePath("unknown-peer");
    seedComparisonData(storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request(
      "/api/v1/energy/compare/retail?country=AU&peers=ZZ"
    );
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "NO_COMPARABLE_PEER_DATA",
        message: "No comparable data for peers: ZZ"
      }
    });
  });

  test("rejects unknown wholesale peers when no comparable data exists", async () => {
    const storePath = createComparisonStorePath("unknown-wholesale-peer");
    seedComparisonData(storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request(
      "/api/v1/energy/compare/wholesale?country=AU&peers=ZZ"
    );
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "NO_COMPARABLE_PEER_DATA",
        message: "No comparable data for peers: ZZ"
      }
    });
  });

  test("returns null rank and percentile when selected country is not in comparable rows", async () => {
    const storePath = createComparisonStorePath("missing-country");
    seedComparisonData(storePath);
    process.env.AUS_DASH_STORE_PATH = storePath;

    const response = await app.request(
      "/api/v1/energy/compare/wholesale?country=FR&peers=US,DE"
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      country: "FR",
      peers: ["US", "DE"],
      auRank: null,
      auPercentile: null,
      methodologyVersion: "energy-comparison-v1",
      rows: expect.arrayContaining([
        expect.objectContaining({ countryCode: "US" }),
        expect.objectContaining({ countryCode: "DE" })
      ])
    });
  });
});
