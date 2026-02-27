import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/metadata/sources", () => {
  test("returns source catalog with domains and update cadence", async () => {
    const response = await app.request("/api/metadata/sources");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      generatedAt: expect.any(String),
      sources: expect.arrayContaining([
        expect.objectContaining({
          sourceId: expect.any(String),
          domain: expect.stringMatching(/housing|energy|macro/),
          name: expect.any(String),
          url: expect.any(String),
          expectedCadence: expect.any(String)
        })
      ])
    });
  });
});
