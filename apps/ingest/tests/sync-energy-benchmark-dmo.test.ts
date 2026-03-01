import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncEnergyBenchmarkDmo() {
  try {
    const moduleExports = await import("../src/jobs/sync-energy-benchmark-dmo");
    return moduleExports.syncEnergyBenchmarkDmo;
  } catch {
    return null;
  }
}

describe("syncEnergyBenchmarkDmo", () => {
  test("ingests benchmark annual bill observation for dashboard benchmark panel", async () => {
    const syncEnergyBenchmarkDmo = await loadSyncEnergyBenchmarkDmo();
    expect(typeof syncEnergyBenchmarkDmo).toBe("function");
    if (typeof syncEnergyBenchmarkDmo !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-benchmark-dmo-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncEnergyBenchmarkDmo({ storePath });
    expect(result).toMatchObject({
      job: "sync-energy-benchmark-dmo",
      status: "ok",
      pointsIngested: expect.any(Number),
      rowsInserted: expect.any(Number),
      rowsUpdated: expect.any(Number),
      syncedAt: expect.any(String)
    });
    expect(result.pointsIngested).toBeGreaterThan(0);

    const after = readLiveStoreSync(storePath);
    expect(after.ingestionRuns.length).toBe(beforeRunCount + 1);
    expect(after.sourceCursors.find((cursor) => cursor.sourceId === "aer_prd")).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "aer_prd")
    ).toBeTruthy();

    const benchmarkObservation = after.observations
      .filter(
        (observation) =>
          observation.seriesId === "energy.benchmark.dmo.annual_bill_aud" &&
          observation.regionCode === "AU"
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    expect(benchmarkObservation).toBeTruthy();
    expect(benchmarkObservation?.value).toBeGreaterThan(0);
  });
});
