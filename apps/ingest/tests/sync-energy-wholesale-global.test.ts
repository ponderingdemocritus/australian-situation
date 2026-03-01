import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncEnergyWholesaleGlobal() {
  try {
    const moduleExports = await import("../src/jobs/sync-energy-wholesale-global");
    return moduleExports.syncEnergyWholesaleGlobal;
  } catch {
    return null;
  }
}

describe("syncEnergyWholesaleGlobal", () => {
  test("ingests global wholesale observations from EIA and ENTSO-E fixtures", async () => {
    const syncEnergyWholesaleGlobal = await loadSyncEnergyWholesaleGlobal();
    expect(typeof syncEnergyWholesaleGlobal).toBe("function");
    if (typeof syncEnergyWholesaleGlobal !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-global-wholesale-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncEnergyWholesaleGlobal({ storePath });

    expect(result).toMatchObject({
      job: "sync-energy-wholesale-global",
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
      after.sourceCursors.find((cursor) => cursor.sourceId === "entsoe_wholesale")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "eia_electricity")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "entsoe_wholesale")
    ).toBeTruthy();

    const hasUsWholesale = after.observations.some(
      (observation) =>
        observation.seriesId === "energy.wholesale.spot.country.usd_mwh" &&
        observation.countryCode === "US" &&
        observation.market === "US"
    );
    const hasEuWholesale = after.observations.some(
      (observation) =>
        observation.seriesId === "energy.wholesale.spot.country.local_mwh" &&
        observation.countryCode === "DE" &&
        observation.market === "ENTSOE"
    );

    expect(hasUsWholesale).toBe(true);
    expect(hasEuWholesale).toBe(true);
  });
});
