import { describe, expect, test } from "vitest";

async function loadSyncEnergyRetailPlans() {
  try {
    const moduleExports = await import("../src/jobs/sync-energy-retail-plans");
    return moduleExports.syncEnergyRetailPlans;
  } catch {
    return null;
  }
}

describe("syncEnergyRetailPlans", () => {
  test("keeps only residential plans and returns aggregate metrics", async () => {
    const syncEnergyRetailPlans = await loadSyncEnergyRetailPlans();
    expect(typeof syncEnergyRetailPlans).toBe("function");
    if (typeof syncEnergyRetailPlans !== "function") {
      return;
    }

    const result = await syncEnergyRetailPlans();
    expect(result).toMatchObject({
      job: "sync-energy-retail-plans",
      status: "ok",
      totalPlansSeen: expect.any(Number),
      residentialPlansIngested: expect.any(Number),
      aggregates: expect.objectContaining({
        annualBillAudMean: expect.any(Number),
        annualBillAudMedian: expect.any(Number)
      }),
      syncedAt: expect.any(String)
    });
    expect(result.totalPlansSeen).toBeGreaterThanOrEqual(
      result.residentialPlansIngested
    );
  });
});
