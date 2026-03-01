import { describe, expect, test } from "vitest";
import { freshnessStatus, lagMinutes, toTimestamp } from "../src/repositories/freshness";

describe("freshness utilities", () => {
  test("parses quarterly date values", () => {
    const ts = toTimestamp("2025-Q4");
    expect(ts).not.toBeNull();
  });

  test("returns stale when lag exceeds cadence threshold", () => {
    const now = Date.parse("2026-03-01T00:00:00Z");
    const lag = lagMinutes(now, "2026-02-20T00:00:00Z");
    expect(freshnessStatus("daily", lag)).toBe("stale");
  });
});
