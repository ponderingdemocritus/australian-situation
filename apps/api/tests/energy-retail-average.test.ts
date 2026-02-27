import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("GET /api/energy/retail-average", () => {
  test("rejects unsupported region with structured error", async () => {
    const response = await app.request(
      "/api/energy/retail-average?region=XYZ&customer_type=residential"
    );

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
