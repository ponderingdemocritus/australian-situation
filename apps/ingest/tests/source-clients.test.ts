import { describe, expect, test } from "vitest";
import {
  type BeijingResidentialTariffPoint,
  type EntsoeWholesalePoint,
  type MajorGoodsPricePoint,
  type NeaChinaWholesaleProxyPoint,
  type EurostatRetailPricePoint,
  type PlnRetailTariffPoint,
  type WorldBankNormalizationPoint,
  SourceClientError,
  fetchAbsHousingSnapshot,
  fetchAbsCpiSnapshot,
  fetchAerRetailPlansSnapshot,
  fetchAemoNemSourceMixSnapshot,
  fetchAemoWemSourceMixSnapshot,
  fetchAemoWholesaleSnapshot,
  fetchBeijingResidentialTariffSnapshot,
  fetchDccEeewGenerationMixSnapshot,
  fetchEiaElectricitySnapshot,
  fetchEntsoeWholesaleSnapshot,
  fetchEurostatRetailSnapshot,
  fetchMajorGoodsPriceSnapshot,
  fetchNeaChinaWholesaleProxySnapshot,
  fetchPlnRetailTariffSnapshot,
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

  test("maps DCCEEW generation mix payload into canonical annual source mix points", async () => {
    const snapshot = await fetchDccEeewGenerationMixSnapshot({
      endpoint: "https://example.test/dcceew",
      fetchImpl: async () =>
        buildResponse({
          json: {
            year: "2024",
            data: [
              {
                region_code: "AU",
                source_key: "coal",
                generation_gwh: 170245,
                share_pct: 46.8
              },
              {
                region_code: "NT",
                source_key: "gas",
                generation_gwh: 4512,
                share_pct: 84.2
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("dcceew_generation_mix");
    expect(snapshot.points).toEqual([
      {
        regionCode: "AU",
        period: "2024",
        sourceKey: "coal",
        generationGwh: 170245,
        sharePct: 46.8
      },
      {
        regionCode: "NT",
        period: "2024",
        sourceKey: "gas",
        generationGwh: 4512,
        sharePct: 84.2
      }
    ]);
  });

  test("maps AEMO NEM source mix payload into canonical operational mix points", async () => {
    const snapshot = await fetchAemoNemSourceMixSnapshot({
      endpoint: "https://example.test/aemo-nem-mix",
      fetchImpl: async () =>
        buildResponse({
          json: {
            interval_start_utc: "2026-02-27T02:00:00Z",
            data: [
              {
                region_code: "NSW",
                source_key: "coal",
                generation_mw: 5610,
                share_pct: 68.5
              },
              {
                region_code: "SA",
                source_key: "other_renewables",
                generation_mw: 842,
                share_pct: 71.2
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("aemo_nem_source_mix");
    expect(snapshot.points).toEqual([
      {
        regionCode: "NSW",
        timestamp: "2026-02-27T02:00:00Z",
        sourceKey: "coal",
        generationMw: 5610,
        sharePct: 68.5
      },
      {
        regionCode: "SA",
        timestamp: "2026-02-27T02:00:00Z",
        sourceKey: "other_renewables",
        generationMw: 842,
        sharePct: 71.2
      }
    ]);
  });

  test("maps AEMO WEM source mix payload into canonical operational mix points", async () => {
    const snapshot = await fetchAemoWemSourceMixSnapshot({
      endpoint: "https://example.test/aemo-wem-mix",
      fetchImpl: async () =>
        buildResponse({
          json: {
            interval_start_utc: "2026-02-27T02:00:00Z",
            data: [
              {
                region_code: "WA",
                source_key: "gas",
                generation_mw: 1184,
                share_pct: 62.1
              },
              {
                region_code: "WA",
                source_key: "coal",
                generation_mw: 408,
                share_pct: 21.4
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("aemo_wem_source_mix");
    expect(snapshot.points).toEqual([
      {
        regionCode: "WA",
        timestamp: "2026-02-27T02:00:00Z",
        sourceKey: "gas",
        generationMw: 1184,
        sharePct: 62.1
      },
      {
        regionCode: "WA",
        timestamp: "2026-02-27T02:00:00Z",
        sourceKey: "coal",
        generationMw: 408,
        sharePct: 21.4
      }
    ]);
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

  test("maps major goods price payload into canonical offer observations", async () => {
    const snapshot = await fetchMajorGoodsPriceSnapshot({
      endpoint: "https://example.test/major-goods.json",
      fetchImpl: async () =>
        buildResponse({
          json: {
            observed_at: "2026-02-27T06:00:00Z",
            items: [
              {
                merchant: "coles",
                merchant_name: "Coles",
                region_code: "AU",
                category_slug: "food",
                category_name: "Food",
                product_slug: "white-bread",
                canonical_name: "White Bread 700g",
                external_product_id: "bread-700",
                external_offer_id: "coles-bread-au",
                price_amount: 4.05,
                unit_price_amount: 5.79,
                normalized_quantity: 0.7,
                normalized_unit: "kg",
                price_type: "shelf"
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("major_goods_prices");
    expect(snapshot.points).toEqual([
      {
        observedAt: "2026-02-27T06:00:00Z",
        merchantSlug: "coles",
        merchantName: "Coles",
        regionCode: "AU",
        categorySlug: "food",
        categoryName: "Food",
        productSlug: "white-bread",
        canonicalName: "White Bread 700g",
        externalProductId: "bread-700",
        externalOfferId: "coles-bread-au",
        priceAmount: 4.05,
        unitPriceAmount: 5.79,
        normalizedQuantity: 0.7,
        normalizedUnit: "kg",
        priceType: "shelf"
      } satisfies MajorGoodsPricePoint
    ]);
  });

  test("fails fast when major goods live fetch has no machine-readable endpoint configured", async () => {
    const originalFetchUrl = process.env.AUS_DASH_MAJOR_GOODS_FETCH_URL;
    delete process.env.AUS_DASH_MAJOR_GOODS_FETCH_URL;

    await expect(
      fetchMajorGoodsPriceSnapshot({
        fetchImpl: async () =>
          buildResponse({
            json: {
              observed_at: "2026-02-27T06:00:00Z",
              items: []
            }
          })
      })
    ).rejects.toMatchObject({
      name: "SourceClientError",
      sourceId: "major_goods_prices",
      transient: false
    } satisfies Partial<SourceClientError>);

    if (originalFetchUrl === undefined) {
      delete process.env.AUS_DASH_MAJOR_GOODS_FETCH_URL;
    } else {
      process.env.AUS_DASH_MAJOR_GOODS_FETCH_URL = originalFetchUrl;
    }
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

  test("maps PLN household tariff JSON into canonical retail tariff points", async () => {
    const snapshot = await fetchPlnRetailTariffSnapshot({
      endpoint: "https://example.test/pln.json",
      fetchImpl: async () =>
        buildResponse({
          json: {
            date: "2025-12-12T14:00:08",
            content: {
              rendered: `
                <h3>1. Tarif Listrik Rumah Tangga</h3>
                <table>
                  <tbody>
                    <tr><td><b>Golongan</b></td><td><b>Daya Listrik</b></td><td><b>Tarif (Rp/kWh)</b></td></tr>
                    <tr><td><b>R-1 (Subsidi)</b></td><td>900 VA</td><td>Rp605/kWh</td></tr>
                    <tr><td><b>R-1 (Non-Subsidi)</b></td><td>1.300 VA – 2.200 VA</td><td>Rp1.444,70/kWh</td></tr>
                    <tr><td><b>R-2</b></td><td>3.500 VA – 5.500 VA</td><td>Rp1.699,53/kWh</td></tr>
                  </tbody>
                </table>
              `
            },
            link: "https://web.pln.co.id/cms/media/2025/12/tarif-listrik/"
          }
        })
    });

    expect(snapshot.sourceId).toBe("pln_tariff");
    expect(snapshot.points satisfies PlnRetailTariffPoint[]).toEqual([
      {
        countryCode: "ID",
        period: "2025-12-12",
        tariffClass: "R-1 (Subsidi)",
        customerType: "residential",
        consumptionBand: "household_low",
        taxStatus: "mixed",
        currency: "IDR",
        priceLocalKwh: 605
      },
      {
        countryCode: "ID",
        period: "2025-12-12",
        tariffClass: "R-1 (Non-Subsidi)",
        customerType: "residential",
        consumptionBand: "household_mid",
        taxStatus: "mixed",
        currency: "IDR",
        priceLocalKwh: 1444.7
      },
      {
        countryCode: "ID",
        period: "2025-12-12",
        tariffClass: "R-2",
        customerType: "residential",
        consumptionBand: "household_high",
        taxStatus: "mixed",
        currency: "IDR",
        priceLocalKwh: 1699.53
      }
    ]);
  });

  test("maps Beijing residential tariff HTML into a China retail proxy point", async () => {
    const snapshot = await fetchBeijingResidentialTariffSnapshot({
      endpoint: "https://example.test/beijing.html",
      fetchImpl: async () =>
        buildResponse({
          text: `
            <html>
              <body>
                <table>
                  <tr><td>Residential electricity users</td><td>less than 1 kV</td><td>0.4883</td></tr>
                </table>
              </body>
            </html>
          `
        })
    });

    expect(snapshot.sourceId).toBe("beijing_residential_tariff");
    expect(snapshot.points satisfies BeijingResidentialTariffPoint[]).toEqual([
      {
        countryCode: "CN",
        period: "2021-10-25",
        tariffClass: "Residential electricity users",
        customerType: "residential",
        consumptionBand: "household_mid",
        taxStatus: "mixed",
        currency: "CNY",
        priceLocalKwh: 0.4883
      }
    ]);
  });

  test("maps NEA wholesale proxy HTML into a China annual wholesale proxy point", async () => {
    const snapshot = await fetchNeaChinaWholesaleProxySnapshot({
      endpoint: "https://example.test/nea.html",
      fetchImpl: async () =>
        buildResponse({
          text: `
            <html>
              <body>
                <p>2022年，全国燃煤发电机组市场平均交易价格为0.449元/千瓦时。</p>
              </body>
            </html>
          `
        })
    });

    expect(snapshot.sourceId).toBe("nea_china_wholesale_proxy");
    expect(snapshot.points satisfies NeaChinaWholesaleProxyPoint[]).toEqual([
      {
        countryCode: "CN",
        period: "2022",
        priceCnyKwh: 0.449
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

  test("maps ABS CPI payload into canonical observations", async () => {
    const snapshot = await fetchAbsCpiSnapshot({
      endpoint: "https://example.test/abs-cpi",
      fetchImpl: async () =>
        buildResponse({
          json: {
            observations: [
              {
                region_code: "AU",
                date: "2025-Q4",
                value: 151.2,
                unit: "index"
              }
            ]
          }
        })
    });

    expect(snapshot.sourceId).toBe("abs_cpi");
    expect(snapshot.observations).toEqual([
      {
        regionCode: "AU",
        date: "2025-Q4",
        value: 151.2,
        unit: "index"
      }
    ]);
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
