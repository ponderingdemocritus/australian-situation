import { describe, expect, test } from "vitest";
import { syncHousingSeries } from "../src/jobs/sync-housing-series";

describe("syncHousingSeries", () => {
  test("returns ok result", async () => {
    const result = await syncHousingSeries();

    expect(result.job).toBe("sync-housing-series");
    expect(result.status).toBe("ok");
    expect(typeof result.syncedAt).toBe("string");
  });
});
