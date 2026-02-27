import { describe, expect, test } from "vitest";
import {
  SourceClientError,
  fetchAbsHousingSnapshot,
  fetchAerRetailPlansSnapshot,
  fetchAemoWholesaleSnapshot,
  fetchRbaRatesSnapshot
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
});
