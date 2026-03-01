import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncEnergyRetailGlobal() {
  try {
    const moduleExports = await import("../src/jobs/sync-energy-retail-global");
    return moduleExports.syncEnergyRetailGlobal;
  } catch {
    return null;
  }
}

describe("syncEnergyRetailGlobal", () => {
  test("ingests global retail observations from EIA and Eurostat fixtures", async () => {
    const syncEnergyRetailGlobal = await loadSyncEnergyRetailGlobal();
    expect(typeof syncEnergyRetailGlobal).toBe("function");
    if (typeof syncEnergyRetailGlobal !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-global-retail-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncEnergyRetailGlobal({ storePath });

    expect(result).toMatchObject({
      job: "sync-energy-retail-global",
      status: "ok",
      pointsIngested: expect.any(Number),
      rowsInserted: expect.any(Number),
      rowsUpdated: expect.any(Number),
      syncedAt: expect.any(String)
    });
    expect(result.pointsIngested).toBeGreaterThan(0);

    const after = readLiveStoreSync(storePath);
    expect(after.ingestionRuns.length).toBe(beforeRunCount + 1);
    expect(
      after.sourceCursors.find((cursor) => cursor.sourceId === "eia_electricity")
    ).toBeTruthy();
    expect(
      after.sourceCursors.find((cursor) => cursor.sourceId === "eurostat_retail")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "eia_electricity")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "eurostat_retail")
    ).toBeTruthy();

    const hasUsRetail = after.observations.some(
      (observation) =>
        observation.seriesId === "energy.retail.price.country.usd_kwh_nominal" &&
        observation.countryCode === "US" &&
        observation.market === "US"
    );
    const hasEuRetail = after.observations.some(
      (observation) =>
        observation.seriesId === "energy.retail.price.country.local_kwh" &&
        observation.countryCode === "DE" &&
        observation.market === "EUROSTAT" &&
        observation.taxStatus === "incl_tax"
    );

    expect(hasUsRetail).toBe(true);
    expect(hasEuRetail).toBe(true);
  });
});
