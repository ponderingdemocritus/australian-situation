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

  test("derives live-mode cursor and publication metadata from the latest payload date", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-housing-live-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));

    await syncHousingSeries({
      storePath,
      sourceMode: "live",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          observations: [
            {
              series_id: "hvi.value.index",
              region_code: "AU",
              date: "2026-03-31",
              value: 171.2,
              unit: "index"
            },
            {
              series_id: "lending.avg_loan_size_aud",
              region_code: "AU",
              date: "2026-03-31",
              value: 745000,
              unit: "aud"
            }
          ]
        })
      })
    });

    const after = readLiveStoreSync(storePath);
    const latestHousingObservation = after.observations
      .filter(
        (observation) =>
          observation.seriesId === "hvi.value.index" && observation.regionCode === "AU"
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const cursor = after.sourceCursors.find((item) => item.sourceId === "abs_housing");

    expect(latestHousingObservation?.date).toBe("2026-03-31");
    expect(latestHousingObservation?.publishedAt).toBe("2026-03-31T00:00:00Z");
    expect(latestHousingObservation?.vintage).toBe("2026-03-31");
    expect(cursor?.cursor).toBe("2026-03-31");
  });
});
