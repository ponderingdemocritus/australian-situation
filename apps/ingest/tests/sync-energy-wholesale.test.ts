import { describe, expect, test } from "vitest";

async function loadSyncEnergyWholesale() {
  try {
    const moduleExports = await import("../src/jobs/sync-energy-wholesale");
    return moduleExports.syncEnergyWholesale;
  } catch {
    return null;
  }
}

describe("syncEnergyWholesale", () => {
  test("returns latest AU weighted wholesale point and ingest stats", async () => {
    const syncEnergyWholesale = await loadSyncEnergyWholesale();
    expect(typeof syncEnergyWholesale).toBe("function");
    if (typeof syncEnergyWholesale !== "function") {
      return;
    }

    const result = await syncEnergyWholesale();
    expect(result).toMatchObject({
      job: "sync-energy-wholesale",
      status: "ok",
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      pointsIngested: expect.any(Number),
      latest: expect.objectContaining({
        timestamp: expect.any(String),
        audMwh: expect.any(Number),
        cKwh: expect.any(Number)
      }),
      syncedAt: expect.any(String)
    });
    expect(result.pointsIngested).toBeGreaterThan(0);
  });
});
