import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncMacroAbsCpi() {
  try {
    const moduleExports = await import("../src/jobs/sync-macro-abs-cpi");
    return moduleExports.syncMacroAbsCpi;
  } catch {
    return null;
  }
}

describe("syncMacroAbsCpi", () => {
  test("ingests CPI electricity index observations for energy overview panel", async () => {
    const syncMacroAbsCpi = await loadSyncMacroAbsCpi();
    expect(typeof syncMacroAbsCpi).toBe("function");
    if (typeof syncMacroAbsCpi !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-cpi-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncMacroAbsCpi({ storePath });
    expect(result).toMatchObject({
      job: "sync-macro-abs-cpi",
      status: "ok",
      pointsIngested: expect.any(Number),
      rowsInserted: expect.any(Number),
      rowsUpdated: expect.any(Number),
      syncedAt: expect.any(String)
    });
    expect(result.pointsIngested).toBeGreaterThan(0);

    const after = readLiveStoreSync(storePath);
    expect(after.ingestionRuns.length).toBe(beforeRunCount + 1);
    expect(after.sourceCursors.find((cursor) => cursor.sourceId === "abs_cpi")).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "abs_cpi")
    ).toBeTruthy();

    const hasCpi = after.observations.some(
      (observation) =>
        observation.seriesId === "energy.cpi.electricity.index" &&
        observation.regionCode === "AU"
    );
    expect(hasCpi).toBe(true);
  });
});
