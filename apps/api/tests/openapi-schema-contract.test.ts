import { describe, expect, test } from "vitest";
import { app } from "../src/app";

type OpenApiSpec = {
  paths: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }>>;
};

function responseSchema(spec: OpenApiSpec, path: string, method: string, status: string) {
  return spec.paths[path]?.[method]?.responses?.[status]?.content?.["application/json"]?.schema as
    | Record<string, unknown>
    | undefined;
}

describe("OpenAPI response schemas", () => {
  test("declares concrete schema properties for key payloads", async () => {
    const response = await app.request("http://api.local/api/openapi.json");
    expect(response.status).toBe(200);
    const body = (await response.json()) as OpenApiSpec;

    const retailAverage = responseSchema(
      body,
      "/api/energy/retail-average",
      "get",
      "200"
    );
    expect(retailAverage).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        region: expect.any(Object),
        annualBillAudMean: expect.any(Object),
        annualBillAudMedian: expect.any(Object),
        freshness: expect.any(Object)
      })
    });

    const seriesById = responseSchema(body, "/api/series/{id}", "get", "200");
    expect(seriesById).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        seriesId: expect.any(Object),
        region: expect.any(Object),
        points: expect.any(Object)
      })
    });

    const freshness = responseSchema(body, "/api/metadata/freshness", "get", "200");
    expect(freshness).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        generatedAt: expect.any(Object),
        staleSeriesCount: expect.any(Object),
        series: expect.any(Object)
      })
    });
  });
});
