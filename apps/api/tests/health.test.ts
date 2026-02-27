import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/health", () => {
  test("returns ok response", async () => {
    const response = await app.request("/api/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", service: "aus-dash-api" });
  });
});
