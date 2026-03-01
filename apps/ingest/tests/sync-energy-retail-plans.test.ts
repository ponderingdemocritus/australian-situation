import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

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

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-retail-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncEnergyRetailPlans({ storePath });
    expect(result).toMatchObject({
      job: "sync-energy-retail-plans",
      status: "ok",
      totalPlansSeen: expect.any(Number),
      residentialPlansIngested: expect.any(Number),
      rowsInserted: expect.any(Number),
      rowsUpdated: expect.any(Number),
      aggregates: expect.objectContaining({
        annualBillAudMean: expect.any(Number),
        annualBillAudMedian: expect.any(Number)
      }),
      syncedAt: expect.any(String)
    });
    expect(result.totalPlansSeen).toBeGreaterThanOrEqual(
      result.residentialPlansIngested
    );

    const after = readLiveStoreSync(storePath);
    expect(after.ingestionRuns.length).toBe(beforeRunCount + 1);
    expect(after.sourceCursors.find((cursor) => cursor.sourceId === "aer_prd")).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "aer_prd")
    ).toBeTruthy();

    const retailMeanObservation = after.observations.find(
      (observation) =>
        observation.seriesId === "energy.retail.offer.annual_bill_aud.mean" &&
        observation.regionCode === "AU"
    );

    expect(retailMeanObservation).toBeTruthy();
    expect(retailMeanObservation?.countryCode).toBe("AU");
    expect(retailMeanObservation?.market).toBe("NEM");
    expect(retailMeanObservation?.metricFamily).toBe("retail");
    expect(retailMeanObservation?.currency).toBe("AUD");
    expect(retailMeanObservation?.taxStatus).toBe("incl_tax");
    expect(retailMeanObservation?.consumptionBand).toBe("household_mid");
    expect(retailMeanObservation?.methodologyVersion).toBe("energy-retail-prd-v1");
  });
});
