import { describe, expect, test } from "vitest";
import {
  mapEiaRetailPointsToObservations,
  mapEiaWholesalePointsToObservations,
  mapEntsoeWholesalePointsToObservations,
  mapEurostatRetailPointsToObservations,
  mapWorldBankNormalizationPointsToObservations
} from "../src/mappers/global-energy";

describe("global energy mappers", () => {
  test("maps EIA retail points to canonical retail observations", () => {
    const observations = mapEiaRetailPointsToObservations(
      [
        {
          countryCode: "US",
          regionCode: "US",
          period: "2026-01",
          customerType: "residential",
          priceUsdKwh: 0.18
        }
      ],
      {
        ingestedAt: "2026-02-28T01:00:00Z",
        vintage: "2026-02-28"
      }
    );

    expect(observations).toEqual([
      expect.objectContaining({
        seriesId: "energy.retail.price.country.usd_kwh_nominal",
        countryCode: "US",
        regionCode: "US",
        market: "US",
        metricFamily: "retail",
        value: 0.18,
        unit: "usd_kwh",
        currency: "USD",
        taxStatus: "mixed",
        consumptionBand: "household_mid"
      })
    ]);
  });

  test("maps EIA and ENTSO-E wholesale points to canonical wholesale observations", () => {
    const usObservations = mapEiaWholesalePointsToObservations(
      [
        {
          countryCode: "US",
          regionCode: "ERCOT",
          intervalStartUtc: "2026-02-27T00:00:00Z",
          intervalEndUtc: "2026-02-27T01:00:00Z",
          priceUsdMwh: 67.3
        }
      ],
      {
        ingestedAt: "2026-02-28T01:00:00Z",
        vintage: "2026-02-28"
      }
    );

    const euObservations = mapEntsoeWholesalePointsToObservations(
      [
        {
          countryCode: "DE",
          biddingZone: "DE_LU",
          intervalStartUtc: "2026-02-27T00:00:00Z",
          intervalEndUtc: "2026-02-27T01:00:00Z",
          priceEurMwh: 95.4
        }
      ],
      {
        ingestedAt: "2026-02-28T01:00:00Z",
        vintage: "2026-02-28"
      }
    );

    expect(usObservations[0]).toEqual(
      expect.objectContaining({
        seriesId: "energy.wholesale.spot.country.usd_mwh",
        regionCode: "ERCOT",
        currency: "USD",
        market: "US",
        metricFamily: "wholesale"
      })
    );
    expect(euObservations[0]).toEqual(
      expect.objectContaining({
        seriesId: "energy.wholesale.spot.country.local_mwh",
        regionCode: "DE_LU",
        currency: "EUR",
        market: "ENTSOE",
        metricFamily: "wholesale"
      })
    );
  });

  test("maps Eurostat retail points with tax and consumption band metadata", () => {
    const observations = mapEurostatRetailPointsToObservations(
      [
        {
          countryCode: "DE",
          period: "2025-S2",
          customerType: "household",
          consumptionBand: "household_mid",
          taxStatus: "incl_tax",
          currency: "EUR",
          priceLocalKwh: 0.319
        }
      ],
      {
        ingestedAt: "2026-02-28T01:00:00Z",
        vintage: "2026-02-28"
      }
    );

    expect(observations[0]).toEqual(
      expect.objectContaining({
        seriesId: "energy.retail.price.country.local_kwh",
        countryCode: "DE",
        taxStatus: "incl_tax",
        consumptionBand: "household_mid",
        currency: "EUR",
        market: "EUROSTAT",
        metricFamily: "retail"
      })
    );
  });

  test("maps World Bank normalization points into FX and PPP observations", () => {
    const observations = mapWorldBankNormalizationPointsToObservations(
      [
        {
          countryCode: "AUS",
          year: "2025",
          indicatorCode: "PA.NUS.FCRF",
          value: 1.53
        },
        {
          countryCode: "AUS",
          year: "2025",
          indicatorCode: "PA.NUS.PPP",
          value: 1.44
        }
      ],
      {
        ingestedAt: "2026-02-28T01:00:00Z",
        vintage: "2026-02-28"
      }
    );

    expect(observations).toEqual([
      expect.objectContaining({
        seriesId: "macro.fx.local_per_usd",
        countryCode: "AU",
        metricFamily: "normalization",
        value: 1.53
      }),
      expect.objectContaining({
        seriesId: "macro.ppp.local_per_usd",
        countryCode: "AU",
        metricFamily: "normalization",
        value: 1.44
      })
    ]);
  });
});
