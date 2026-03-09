import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync } from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { buildRegistryBackedProcessor } from "../src/queue/worker";

const TEMP_DIRS: string[] = [];

function createTempStorePath(name: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), `aus-dash-${name}-`));
  TEMP_DIRS.push(tempDir);
  return path.join(tempDir, "live-store.json");
}

afterEach(() => {
  for (const tempDir of TEMP_DIRS.splice(0, TEMP_DIRS.length)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("queue-backed ingest run audit trail", () => {
  test("persists queue execution metadata through the durable store run log", async () => {
    const storePath = createTempStorePath("queue-run-audit");
    const processor = buildRegistryBackedProcessor();

    await processor({
      name: "sync-energy-wholesale-5m",
      id: "bull-job-42",
      attemptsMade: 1,
      queueName: "ingest-jobs",
      data: {
        sourceMode: "fixture",
        ingestBackend: "store",
        storePath,
        runMode: "backfill",
        from: "2026-02-26",
        to: "2026-02-27",
        dryRun: true
      }
    });

    const store = readLiveStoreSync(storePath);
    const latestRun = store.ingestionRuns.at(-1);

    expect(latestRun).toMatchObject({
      job: "sync-energy-wholesale-5m",
      bullJobId: "bull-job-42",
      queueName: "ingest-jobs",
      attempt: 2,
      runMode: "backfill"
    });
  });
});
