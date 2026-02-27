import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("CORS headers", () => {
  test("includes access-control-allow-origin for cross-origin web requests", async () => {
    const response = await app.request("/api/energy/overview?region=AU", {
      method: "GET",
      headers: {
        Origin: "http://localhost:3000"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
