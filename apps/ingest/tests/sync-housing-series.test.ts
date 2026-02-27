import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";
import { syncHousingSeries } from "../src/jobs/sync-housing-series";

describe("syncHousingSeries", () => {
  test("returns ok result", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-housing-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncHousingSeries({ storePath });

    expect(result.job).toBe("sync-housing-series");
    expect(result.status).toBe("ok");
    expect(typeof result.rowsInserted).toBe("number");
    expect(typeof result.rowsUpdated).toBe("number");
    expect(typeof result.syncedAt).toBe("string");

    const after = readLiveStoreSync(storePath);
    expect(after.ingestionRuns.length).toBe(beforeRunCount + 1);
    expect(
      after.sourceCursors.find((cursor) => cursor.sourceId === "abs_housing")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "abs_housing")
    ).toBeTruthy();
  });
});
