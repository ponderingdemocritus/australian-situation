import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { readLiveStoreSync } from "@aus-dash/shared";
import { INGEST_JOB_REGISTRY } from "../src/jobs/job-registry";
import { buildRegistryBackedProcessor } from "../src/queue/worker";

function createTempStorePath(name: string): string {
  const dir = path.join(
    os.tmpdir(),
    `aus-dash-worker-migration-tests-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  return path.join(dir, `${name}.json`);
}

describe("registry-driven bullmq processor parity", () => {
  test.each([
    "sync-energy-wholesale-5m",
    "sync-energy-retail-prd-hourly",
    "sync-housing-abs-daily"
  ])("runs %s through worker processor and keeps replays idempotent", async (jobId) => {
    const storePath = createTempStorePath(jobId);
    const processor = buildRegistryBackedProcessor(INGEST_JOB_REGISTRY, {
      info: () => {},
      error: () => {}
    });

    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    await processor({
      id: `${jobId}-1`,
      name: jobId,
      attemptsMade: 0,
      data: {
        sourceMode: "fixture",
        ingestBackend: "store",
        storePath
      },
      queueName: "ingest-jobs"
    });

    const afterFirst = readLiveStoreSync(storePath);

    await processor({
      id: `${jobId}-2`,
      name: jobId,
      attemptsMade: 0,
      data: {
        sourceMode: "fixture",
        ingestBackend: "store",
        storePath
      },
      queueName: "ingest-jobs"
    });

    const afterSecond = readLiveStoreSync(storePath);

    expect(afterSecond.ingestionRuns.length).toBe(beforeRunCount + 2);
    expect(afterSecond.observations.length).toBe(afterFirst.observations.length);

    rmSync(path.dirname(storePath), { recursive: true, force: true });
  });
});
