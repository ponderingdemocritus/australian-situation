import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  appendIngestionRun,
  readLiveStoreSync,
  resolveLiveStorePath,
  setSourceCursor,
  upsertObservations,
  writeLiveStoreSync
} from "../src/live-store";

const TEMP_PATHS: string[] = [];

function createTempStorePath(name: string): string {
  const dir = path.join(
    os.tmpdir(),
    `aus-dash-live-store-tests-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const storePath = path.join(dir, `${name}.json`);
  TEMP_PATHS.push(dir);
  return storePath;
}

afterEach(() => {
  for (const tempPath of TEMP_PATHS.splice(0, TEMP_PATHS.length)) {
    rmSync(tempPath, { recursive: true, force: true });
  }
});

describe("live store", () => {
  test("creates seed store file when missing", () => {
    const storePath = createTempStorePath("seed");

    const store = readLiveStoreSync(storePath);
    expect(store.version).toBe(1);
    expect(store.observations.length).toBeGreaterThan(0);
    expect(existsSync(storePath)).toBe(true);
  });

  test("upserts observations idempotently by series/region/date/vintage", () => {
    const storePath = createTempStorePath("upsert");
    const store = readLiveStoreSync(storePath);

    const existing = store.observations.find(
      (item) =>
        item.seriesId === "hvi.value.index" &&
        item.regionCode === "AU" &&
        item.date === "2025-12-31"
    );
    expect(existing).toBeTruthy();

    const result = upsertObservations(store, [
      {
        seriesId: "hvi.value.index",
        regionCode: "AU",
        date: "2025-12-31",
        value: 170.1,
        unit: "index",
        sourceName: "ABS",
        sourceUrl: "https://example.com/abs",
        publishedAt: "2026-01-01T00:00:00Z",
        ingestedAt: "2026-02-27T04:00:00Z",
        vintage: "2026-02-27",
        isModeled: false,
        confidence: "official"
      },
      {
        seriesId: "new.series.test",
        regionCode: "AU",
        date: "2026-02-27",
        value: 1,
        unit: "count",
        sourceName: "TEST",
        sourceUrl: "https://example.com/test",
        publishedAt: "2026-02-27T00:00:00Z",
        ingestedAt: "2026-02-27T04:00:00Z",
        vintage: "2026-02-27",
        isModeled: false,
        confidence: "official"
      }
    ]);

    expect(result).toEqual({ inserted: 1, updated: 1 });
    writeLiveStoreSync(store, storePath);
    const reread = readLiveStoreSync(storePath);
    expect(
      reread.observations.find(
        (item) =>
          item.seriesId === "hvi.value.index" &&
          item.regionCode === "AU" &&
          item.date === "2025-12-31"
      )?.value
    ).toBe(170.1);
    expect(
      reread.observations.find((item) => item.seriesId === "new.series.test")
    ).toBeTruthy();
  });

  test("updates source cursors and records ingestion runs", () => {
    const storePath = createTempStorePath("ops");
    const store = readLiveStoreSync(storePath);

    setSourceCursor(store, "aemo_wholesale", "cursor-1");
    setSourceCursor(store, "aemo_wholesale", "cursor-2");
    expect(store.sourceCursors).toHaveLength(1);
    expect(store.sourceCursors[0]?.cursor).toBe("cursor-2");

    const run = appendIngestionRun(store, {
      job: "sync-energy-wholesale-5m",
      status: "ok",
      startedAt: "2026-02-27T02:00:00Z",
      finishedAt: "2026-02-27T02:01:00Z",
      rowsInserted: 5,
      rowsUpdated: 0
    });
    expect(run.runId).toContain("sync-energy-wholesale-5m");
    expect(store.ingestionRuns).toHaveLength(1);
  });

  test("resolveLiveStorePath respects explicit value first", () => {
    const resolved = resolveLiveStorePath("./data/custom.json");
    expect(resolved.endsWith(path.normalize("data/custom.json"))).toBe(true);
  });
});
