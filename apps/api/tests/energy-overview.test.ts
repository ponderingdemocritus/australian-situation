import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/energy/overview", () => {
  test("returns merged wholesale, retail, benchmark, and cpi context", async () => {
    const response = await app.request("/api/energy/overview?region=AU");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      region: "AU",
      methodSummary: expect.any(String),
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          url: expect.any(String)
        })
      ]),
      panels: {
        liveWholesale: expect.objectContaining({
          valueAudMwh: expect.any(Number),
          valueCKwh: expect.any(Number)
        }),
        retailAverage: expect.objectContaining({
          annualBillAudMean: expect.any(Number),
          annualBillAudMedian: expect.any(Number)
        }),
        benchmark: expect.objectContaining({
          dmoAnnualBillAud: expect.any(Number)
        }),
        cpiElectricity: expect.objectContaining({
          indexValue: expect.any(Number),
          period: expect.any(String)
        })
      },
      sourceMixViews: expect.arrayContaining([
        expect.objectContaining({
          viewId: expect.stringMatching(/annual_official|operational_nem_wem/),
          title: expect.any(String),
          coverageLabel: expect.any(String),
          updatedAt: expect.any(String),
          sourceRefs: expect.arrayContaining([
            expect.objectContaining({
              sourceId: expect.any(String),
              name: expect.any(String),
              url: expect.any(String)
            })
          ]),
          rows: expect.arrayContaining([
            expect.objectContaining({
              sourceKey: expect.any(String),
              label: expect.any(String),
              sharePct: expect.any(Number)
            })
          ])
        })
      ]),
      freshness: expect.objectContaining({
        updatedAt: expect.any(String),
        status: expect.stringMatching(/fresh|stale|degraded/)
      })
    });
  });

  test("emits canonical source refs that can join the provenance catalog", async () => {
    const [overviewResponse, metadataResponse] = await Promise.all([
      app.request("/api/energy/overview?region=AU"),
      app.request("/api/metadata/sources")
    ]);

    expect(overviewResponse.status).toBe(200);
    expect(metadataResponse.status).toBe(200);

    const overviewBody = await overviewResponse.json();
    const metadataBody = await metadataResponse.json();
    const metadataById = new Map(
      metadataBody.sources.map(
        (item: { sourceId: string; name: string; url: string }) => [item.sourceId, item]
      )
    );

    expect(overviewBody.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: expect.any(String),
          name: expect.any(String),
          url: expect.any(String)
        })
      ])
    );

    for (const sourceRef of overviewBody.sourceRefs as Array<{
      sourceId: string;
      name: string;
      url: string;
    }>) {
      expect(metadataById.get(sourceRef.sourceId)).toMatchObject({
        name: sourceRef.name,
        url: sourceRef.url
      });
    }
  });

  test("rejects unsupported region with structured error", async () => {
    const response = await app.request("/api/energy/overview?region=XYZ");
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UNSUPPORTED_REGION",
        message: "Unsupported region: XYZ"
      }
    });
  });
});
