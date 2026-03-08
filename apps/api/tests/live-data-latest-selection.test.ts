import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createSeedLiveStore,
  resolveLiveStorePath,
  writeLiveStoreSync
} from "@aus-dash/shared";
import { describe, expect, test } from "vitest";
import {
  getEnergyRetailAverageFromStore,
  getEnergyRetailComparisonFromStore
} from "../src/repositories/live-store-repository";

function createStorePath(name: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), `aus-dash-latest-${name}-`));
  return resolveLiveStorePath(path.join(tempDir, "live-store.json"));
}

describe("latest observation selection", () => {
  test("prefers newer vintage when retail averages share the same date", () => {
    const storePath = createStorePath("retail-average");
    const store = createSeedLiveStore();
    store.observations = store.observations.filter(
      (observation) =>
        !(
          observation.regionCode === "AU" &&
          (observation.seriesId === "energy.retail.offer.annual_bill_aud.mean" ||
            observation.seriesId === "energy.retail.offer.annual_bill_aud.median")
        )
    );

    store.observations.push(
      {
        seriesId: "energy.retail.offer.annual_bill_aud.mean",
        regionCode: "AU",
        countryCode: "AU",
        market: "NEM",
        metricFamily: "retail",
        date: "2026-02-27",
        value: 1800,
        unit: "aud",
        currency: "AUD",
        taxStatus: "incl_tax",
        consumptionBand: "household_mid",
        sourceName: "AER",
        sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
        publishedAt: "2026-02-27T00:00:00Z",
        ingestedAt: "2026-02-27T01:00:00Z",
        vintage: "2026-02-27",
        isModeled: false,
        confidence: "official",
        methodologyVersion: "energy-retail-prd-v1"
      },
      {
        seriesId: "energy.retail.offer.annual_bill_aud.mean",
        regionCode: "AU",
        countryCode: "AU",
        market: "NEM",
        metricFamily: "retail",
        date: "2026-02-27",
        value: 2100,
        unit: "aud",
        currency: "AUD",
        taxStatus: "incl_tax",
        consumptionBand: "household_mid",
        sourceName: "AER",
        sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
        publishedAt: "2026-03-03T00:00:00Z",
        ingestedAt: "2026-03-03T01:00:00Z",
        vintage: "2026-03-03",
        isModeled: false,
        confidence: "official",
        methodologyVersion: "energy-retail-prd-v1"
      },
      {
        seriesId: "energy.retail.offer.annual_bill_aud.median",
        regionCode: "AU",
        countryCode: "AU",
        market: "NEM",
        metricFamily: "retail",
        date: "2026-02-27",
        value: 1750,
        unit: "aud",
        currency: "AUD",
        taxStatus: "incl_tax",
        consumptionBand: "household_mid",
        sourceName: "AER",
        sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
        publishedAt: "2026-02-27T00:00:00Z",
        ingestedAt: "2026-02-27T01:00:00Z",
        vintage: "2026-02-27",
        isModeled: false,
        confidence: "official",
        methodologyVersion: "energy-retail-prd-v1"
      },
      {
        seriesId: "energy.retail.offer.annual_bill_aud.median",
        regionCode: "AU",
        countryCode: "AU",
        market: "NEM",
        metricFamily: "retail",
        date: "2026-02-27",
        value: 2050,
        unit: "aud",
        currency: "AUD",
        taxStatus: "incl_tax",
        consumptionBand: "household_mid",
        sourceName: "AER",
        sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
        publishedAt: "2026-03-03T00:00:00Z",
        ingestedAt: "2026-03-03T01:00:00Z",
        vintage: "2026-03-03",
        isModeled: false,
        confidence: "official",
        methodologyVersion: "energy-retail-prd-v1"
      }
    );

    writeLiveStoreSync(store, storePath);

    const result = getEnergyRetailAverageFromStore("AU", storePath);

    expect(result.annualBillAudMean).toBe(2100);
    expect(result.annualBillAudMedian).toBe(2050);
  });

  test("prefers newer vintage for country comparisons when dates tie", () => {
    const storePath = createStorePath("retail-compare");
    const store = createSeedLiveStore();

    store.observations.push(
      {
        seriesId: "energy.retail.price.country.usd_kwh_nominal",
        regionCode: "DE",
        countryCode: "DE",
        market: "EUROSTAT",
        metricFamily: "retail",
        date: "2026-02",
        value: 0.28,
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
        seriesId: "energy.retail.price.country.usd_kwh_nominal",
        regionCode: "DE",
        countryCode: "DE",
        market: "EUROSTAT",
        metricFamily: "retail",
        date: "2026-02",
        value: 0.31,
        unit: "usd_kwh",
        currency: "USD",
        taxStatus: "incl_tax",
        consumptionBand: "household_mid",
        sourceName: "Eurostat",
        sourceUrl: "https://ec.europa.eu/eurostat/",
        publishedAt: "2026-03-03T00:00:00Z",
        ingestedAt: "2026-03-03T01:00:00Z",
        vintage: "2026-03-03",
        isModeled: false,
        confidence: "official",
        methodologyVersion: "energy-comparison-v1"
      }
    );

    writeLiveStoreSync(store, storePath);

    const result = getEnergyRetailComparisonFromStore({
      country: "DE",
      peers: [],
      basis: "nominal",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      storePath
    });

    expect(result.rows.find((row) => row.countryCode === "DE")?.value).toBe(0.31);
  });
});
