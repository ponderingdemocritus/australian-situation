import { describe, expect, test } from "vitest";
import {
  type EntsoeWholesalePoint,
  type EurostatRetailPricePoint,
  type WorldBankNormalizationPoint,
  SourceClientError,
  fetchAbsHousingSnapshot,
  fetchAerRetailPlansSnapshot,
  fetchAemoWholesaleSnapshot,
  fetchEiaElectricitySnapshot,
  fetchEntsoeWholesaleSnapshot,
  fetchEurostatRetailSnapshot,
  fetchRbaRatesSnapshot,
  fetchWorldBankNormalizationSnapshot
} from "../src/sources/live-source-clients";

type MockResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

function buildResponse(input: {
  ok?: boolean;
  status?: number;
  text?: string;
  json?: unknown;
}): MockResponse {
  const text = input.text ?? "";
  const json = input.json ?? null;
  return {
    ok: input.ok ?? true,
    status: input.status ?? 200,
    text: async () => text,
    json: async () => json
  };
}

describe("live source clients", () => {
  test("maps AEMO wholesale CSV into canonical points", async () => {
    const snapshot = await fetchAemoWholesaleSnapshot({
      endpoint: "https://example.test/aemo.csv",
      fetchImpl: async () =>
        buildResponse({
          text: [
            "SETTLEMENTDATE,REGIONID,RRP,TOTALDEMAND",
            "2026-02-27T02:00:00Z,NSW1,120,5000",
            "2026-02-27T02:00:00Z,VIC1,100,3000"
          ].join("\n")
        })
    });

    expect(snapshot.sourceId).toBe("aemo_wholesale");
    expect(snapshot.points).toEqual([
      {
        regionCode: "NSW",
        timestamp: "2026-02-27T02:00:00Z",
        rrpAudMwh: 120,
        demandMwh: 5000
      },
      {
        regionCode: "VIC",
        timestamp: "2026-02-27T02:00:00Z",
        rrpAudMwh: 100,
        demandMwh: 3000
      }
    ]);
  });

  test("marks AEMO 503 responses as transient source errors", async () => {
    await expect(
      fetchAemoWholesaleSnapshot({
        endpoint: "https://example.test/aemo.csv",
        fetchImpl: async () => buildResponse({ ok: false, status: 503 })
      })
    ).rejects.toMatchObject({
      name: "SourceClientError",
      sourceId: "aemo_wholesale",
      transient: true,
      status: 503
    } satisfies Partial<SourceClientError>);
  });

  test("maps AER PRD payload into plan rows", async () => {
    const snapshot = await fetchAerRetailPlansSnapshot({
      endpoint: "https://example.test/aer",
      fetchImpl: async () =>
        buildResponse({
          json: {
            data: [
              {
                id: "plan-vic-1",
                attributes: {
                  region_code: "VIC",
                  customer_type: "residential",
                  annual_bill_aud: 1825
                }
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("aer_prd");
    expect(snapshot.plans).toEqual([
      {
        planId: "plan-vic-1",
        regionCode: "VIC",
        customerType: "residential",
        annualBillAud: 1825
      }
    ]);
  });

  test("maps ABS housing payload into canonical observations", async () => {
    const snapshot = await fetchAbsHousingSnapshot({
      endpoint: "https://example.test/abs",
      fetchImpl: async () =>
        buildResponse({
          json: {
            observations: [
              {
                series_id: "hvi.value.index",
                region_code: "AU",
                date: "2025-12-31",
                value: 169.4,
                unit: "index"
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("abs_housing");
    expect(snapshot.observations).toEqual([
      {
        seriesId: "hvi.value.index",
        regionCode: "AU",
        date: "2025-12-31",
        value: 169.4,
        unit: "index"
      }
    ]);
  });

  test("raises permanent source error on ABS schema drift", async () => {
    await expect(
      fetchAbsHousingSnapshot({
        endpoint: "https://example.test/abs",
        fetchImpl: async () => buildResponse({ json: { rows: [] } })
      })
    ).rejects.toMatchObject({
      name: "SourceClientError",
      sourceId: "abs_housing",
      transient: false
    } satisfies Partial<SourceClientError>);
  });

  test("maps RBA rates CSV into variable and fixed observations", async () => {
    const snapshot = await fetchRbaRatesSnapshot({
      endpoint: "https://example.test/rba.csv",
      fetchImpl: async () =>
        buildResponse({
          text: [
            "date,oo_variable_pct,oo_fixed_pct",
            "2025-12-31,6.08,5.79"
          ].join("\n")
        })
    });

    expect(snapshot.sourceId).toBe("rba_rates");
    expect(snapshot.observations).toEqual([
      {
        seriesId: "rates.oo.variable_pct",
        regionCode: "AU",
        date: "2025-12-31",
        value: 6.08,
        unit: "%"
      },
      {
        seriesId: "rates.oo.fixed_pct",
        regionCode: "AU",
        date: "2025-12-31",
        value: 5.79,
        unit: "%"
      }
    ]);
  });

  test("maps EIA payload into canonical wholesale and retail points", async () => {
    const snapshot = await fetchEiaElectricitySnapshot({
      endpoint: "https://example.test/eia",
      fetchImpl: async () =>
        buildResponse({
          json: {
            retail: [
              {
                period: "2026-01",
                region_code: "US",
                customer_type: "residential",
                price_usd_kwh: 0.182
              }
            ],
            wholesale: [
              {
                interval_start_utc: "2026-02-27T00:00:00Z",
                interval_end_utc: "2026-02-27T01:00:00Z",
                region_code: "ERCOT",
                lmp_usd_mwh: 67.3
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("eia_electricity");
    expect(snapshot.retailPoints).toEqual([
      {
        countryCode: "US",
        regionCode: "US",
        period: "2026-01",
        customerType: "residential",
        priceUsdKwh: 0.182
      }
    ]);
    expect(snapshot.wholesalePoints).toEqual([
      {
        countryCode: "US",
        regionCode: "ERCOT",
        intervalStartUtc: "2026-02-27T00:00:00Z",
        intervalEndUtc: "2026-02-27T01:00:00Z",
        priceUsdMwh: 67.3
      }
    ]);
  });

  test("maps ENTSO-E payload and preserves bidding zone metadata", async () => {
    const snapshot = await fetchEntsoeWholesaleSnapshot({
      endpoint: "https://example.test/entsoe",
      fetchImpl: async () =>
        buildResponse({
          json: {
            data: [
              {
                country_code: "DE",
                bidding_zone: "DE_LU",
                interval_start_utc: "2026-02-27T00:00:00Z",
                interval_end_utc: "2026-02-27T01:00:00Z",
                day_ahead_price_eur_mwh: 95.4
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("entsoe_wholesale");
    expect(snapshot.points).toEqual([
      {
        countryCode: "DE",
        biddingZone: "DE_LU",
        intervalStartUtc: "2026-02-27T00:00:00Z",
        intervalEndUtc: "2026-02-27T01:00:00Z",
        priceEurMwh: 95.4
      } satisfies EntsoeWholesalePoint
    ]);
  });

  test("maps Eurostat nrg_pc_204 payload with tax and consumption-band fields", async () => {
    const snapshot = await fetchEurostatRetailSnapshot({
      endpoint: "https://example.test/eurostat",
      fetchImpl: async () =>
        buildResponse({
          json: {
            dataset: "nrg_pc_204",
            data: [
              {
                country_code: "DE",
                period: "2025-S2",
                customer_type: "household",
                consumption_band: "household_mid",
                tax_status: "incl_tax",
                currency: "EUR",
                price_local_kwh: 0.319
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("eurostat_retail");
    expect(snapshot.dataset).toBe("nrg_pc_204");
    expect(snapshot.points).toEqual([
      {
        countryCode: "DE",
        period: "2025-S2",
        customerType: "household",
        consumptionBand: "household_mid",
        taxStatus: "incl_tax",
        currency: "EUR",
        priceLocalKwh: 0.319
      } satisfies EurostatRetailPricePoint
    ]);
  });

  test("maps World Bank normalization payload for FX and PPP indicators", async () => {
    const snapshot = await fetchWorldBankNormalizationSnapshot({
      endpoint: "https://example.test/worldbank",
      fetchImpl: async () =>
        buildResponse({
          json: {
            data: [
              {
                country_code: "AUS",
                year: "2025",
                indicator_code: "PA.NUS.FCRF",
                value: 1.53
              },
              {
                country_code: "AUS",
                year: "2025",
                indicator_code: "PA.NUS.PPP",
                value: 1.44
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("world_bank_normalization");
    expect(snapshot.points).toEqual([
      {
        countryCode: "AUS",
        year: "2025",
        indicatorCode: "PA.NUS.FCRF",
        value: 1.53
      } satisfies WorldBankNormalizationPoint,
      {
        countryCode: "AUS",
        year: "2025",
        indicatorCode: "PA.NUS.PPP",
        value: 1.44
      } satisfies WorldBankNormalizationPoint
    ]);
  });

  test("raises permanent source error on Eurostat schema drift", async () => {
    await expect(
      fetchEurostatRetailSnapshot({
        endpoint: "https://example.test/eurostat",
        fetchImpl: async () => buildResponse({ json: { dataset: "nrg_pc_204" } })
      })
    ).rejects.toMatchObject({
      name: "SourceClientError",
      sourceId: "eurostat_retail",
      transient: false
    } satisfies Partial<SourceClientError>);
  });
});
