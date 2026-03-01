import { describe, expect, test } from "vitest";
import { mapObservationForPostgres } from "../src/repositories/postgres-ingest-repository";

describe("postgres observation mapping", () => {
  test("maps optional comparison metadata fields when provided", () => {
    const mapped = mapObservationForPostgres({
      seriesId: "energy.retail.price.country.usd_kwh_ppp",
      regionCode: "AU",
      countryCode: "AU",
      market: "NEM",
      metricFamily: "retail",
      date: "2026-02-28",
      intervalStartUtc: "2026-02-28T00:00:00Z",
      intervalEndUtc: "2026-02-28T23:59:59Z",
      value: 0.22,
      unit: "usd_kwh",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "AER",
      sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
      publishedAt: "2026-02-28T00:00:00Z",
      ingestedAt: "2026-02-28T03:00:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-comparison-v1"
    });

    expect(mapped.countryCode).toBe("AU");
    expect(mapped.market).toBe("NEM");
    expect(mapped.metricFamily).toBe("retail");
    expect(mapped.intervalStartUtc?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(mapped.intervalEndUtc?.toISOString()).toBe("2026-02-28T23:59:59.000Z");
    expect(mapped.currency).toBe("USD");
    expect(mapped.taxStatus).toBe("incl_tax");
    expect(mapped.consumptionBand).toBe("household_mid");
    expect(mapped.methodologyVersion).toBe("energy-comparison-v1");
  });

  test("maps missing comparison metadata fields to null", () => {
    const mapped = mapObservationForPostgres({
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      date: "2026-02-28T02:00:00Z",
      value: 118,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl:
        "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem",
      publishedAt: "2026-02-28T02:00:00Z",
      ingestedAt: "2026-02-28T02:05:00Z",
      vintage: "2026-02-28",
      isModeled: false,
      confidence: "official"
    });

    expect(mapped.countryCode).toBeNull();
    expect(mapped.market).toBeNull();
    expect(mapped.metricFamily).toBeNull();
    expect(mapped.intervalStartUtc).toBeNull();
    expect(mapped.intervalEndUtc).toBeNull();
    expect(mapped.currency).toBeNull();
    expect(mapped.taxStatus).toBeNull();
    expect(mapped.consumptionBand).toBeNull();
    expect(mapped.methodologyVersion).toBeNull();
  });
});
