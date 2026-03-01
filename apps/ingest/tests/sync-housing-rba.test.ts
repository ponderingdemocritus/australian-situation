import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncHousingRba() {
  try {
    const moduleExports = await import("../src/jobs/sync-housing-rba");
    return moduleExports.syncHousingRba;
  } catch {
    return null;
  }
}

describe("syncHousingRba", () => {
  test("ingests RBA variable and fixed owner-occupier rates", async () => {
    const syncHousingRba = await loadSyncHousingRba();
    expect(typeof syncHousingRba).toBe("function");
    if (typeof syncHousingRba !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-rba-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncHousingRba({ storePath });
    expect(result).toMatchObject({
      job: "sync-housing-rba",
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
      after.sourceCursors.find((cursor) => cursor.sourceId === "rba_rates")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "rba_rates")
    ).toBeTruthy();

    const hasVariableRate = after.observations.some(
      (observation) =>
        observation.seriesId === "rates.oo.variable_pct" &&
        observation.regionCode === "AU"
    );
    const hasFixedRate = after.observations.some(
      (observation) =>
        observation.seriesId === "rates.oo.fixed_pct" &&
        observation.regionCode === "AU"
    );

    expect(hasVariableRate).toBe(true);
    expect(hasFixedRate).toBe(true);
  });
});
