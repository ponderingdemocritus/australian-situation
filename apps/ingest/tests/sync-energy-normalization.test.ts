import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncEnergyNormalization() {
  try {
    const moduleExports = await import("../src/jobs/sync-energy-normalization");
    return moduleExports.syncEnergyNormalization;
  } catch {
    return null;
  }
}

describe("syncEnergyNormalization", () => {
  test("ingests World Bank FX and PPP normalization observations", async () => {
    const syncEnergyNormalization = await loadSyncEnergyNormalization();
    expect(typeof syncEnergyNormalization).toBe("function");
    if (typeof syncEnergyNormalization !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-global-normalization-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncEnergyNormalization({ storePath });

    expect(result).toMatchObject({
      job: "sync-energy-normalization",
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
      after.sourceCursors.find((cursor) => cursor.sourceId === "world_bank_normalization")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find(
        (snapshot) => snapshot.sourceId === "world_bank_normalization"
      )
    ).toBeTruthy();

    const hasFx = after.observations.some(
      (observation) =>
        observation.seriesId === "macro.fx.local_per_usd" &&
        observation.countryCode === "AU"
    );
    const hasPpp = after.observations.some(
      (observation) =>
        observation.seriesId === "macro.ppp.local_per_usd" &&
        observation.countryCode === "AU"
    );

    expect(hasFx).toBe(true);
    expect(hasPpp).toBe(true);
  });
});
