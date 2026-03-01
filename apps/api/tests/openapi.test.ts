import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("OpenAPI routes", () => {
  test("serves OpenAPI spec with declared API paths", async () => {
    const response = await app.request("http://api.local/api/openapi.json");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toMatchObject({
      openapi: "3.1.0",
      info: {
        title: "AUS Dash API",
        version: "1.1.0"
      },
      servers: [{ url: "http://localhost:3001" }]
    });
    expect(body.paths).toMatchObject({
      "/api/health": expect.any(Object),
      "/api/housing/overview": expect.any(Object),
      "/api/series/{id}": expect.any(Object),
      "/api/energy/live-wholesale": expect.any(Object),
      "/api/energy/retail-average": expect.any(Object),
      "/api/energy/overview": expect.any(Object),
      "/api/energy/household-estimate": expect.any(Object),
      "/api/metadata/sources": expect.any(Object),
      "/api/metadata/freshness": expect.any(Object),
      "/api/v1/energy/compare/retail": expect.any(Object),
      "/api/v1/energy/compare/wholesale": expect.any(Object),
      "/api/v1/metadata/methodology": expect.any(Object)
    });
  });

  test("serves API docs page that points to the OpenAPI spec", async () => {
    const response = await app.request("/api/docs");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("/api/openapi.json");
    expect(html).toContain("redoc.standalone.js");
  });
});
