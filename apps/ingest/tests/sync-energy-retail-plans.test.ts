import { describe, expect, test, vi } from "vitest";
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

  test("derives live-mode dates and cursor from ingestion time instead of fixture constants", async () => {
    const syncEnergyRetailPlans = await loadSyncEnergyRetailPlans();
    expect(typeof syncEnergyRetailPlans).toBe("function");
    if (typeof syncEnergyRetailPlans !== "function") {
      return;
    }

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T12:00:00Z"));

    try {
      const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-retail-live-"));
      const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));

      await syncEnergyRetailPlans({
        storePath,
        sourceMode: "live",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({
            data: [
              {
                id: "plan-au-1",
                attributes: {
                  region_code: "NSW",
                  customer_type: "residential",
                  annual_bill_aud: 2100
                }
              },
              {
                id: "plan-au-2",
                attributes: {
                  region_code: "VIC",
                  customer_type: "residential",
                  annual_bill_aud: 1900
                }
              }
            ]
          })
        })
      });

      const after = readLiveStoreSync(storePath);
      const retailMeanObservation = after.observations
        .filter(
          (observation) =>
            observation.seriesId === "energy.retail.offer.annual_bill_aud.mean" &&
            observation.regionCode === "AU"
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const cursor = after.sourceCursors.find((item) => item.sourceId === "aer_prd");

      expect(retailMeanObservation?.date).toBe("2026-03-04");
      expect(retailMeanObservation?.publishedAt).toBe("2026-03-04T00:00:00Z");
      expect(retailMeanObservation?.vintage).toBe("2026-03-04");
      expect(cursor?.cursor).toBe("2026-03-04");
    } finally {
      vi.useRealTimers();
    }
  });

  test("persists regional retail aggregates for each residential market", async () => {
    const syncEnergyRetailPlans = await loadSyncEnergyRetailPlans();
    expect(typeof syncEnergyRetailPlans).toBe("function");
    if (typeof syncEnergyRetailPlans !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-retail-regional-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));

    await syncEnergyRetailPlans({ storePath });

    const after = readLiveStoreSync(storePath);
    const regionalMeans = after.observations.filter(
      (observation) =>
        observation.seriesId === "energy.retail.offer.annual_bill_aud.mean" &&
        observation.regionCode !== "AU"
    );

    expect(regionalMeans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ regionCode: "NSW", countryCode: "AU" }),
        expect.objectContaining({ regionCode: "VIC", countryCode: "AU" }),
        expect.objectContaining({ regionCode: "QLD", countryCode: "AU" }),
        expect.objectContaining({ regionCode: "SA", countryCode: "AU" }),
        expect.objectContaining({ regionCode: "WA", countryCode: "AU" }),
        expect.objectContaining({ regionCode: "TAS", countryCode: "AU" }),
        expect.objectContaining({ regionCode: "ACT", countryCode: "AU" }),
        expect.objectContaining({ regionCode: "NT", countryCode: "AU" })
      ])
    );
  });
});
