import { getDb, ingestionRuns, observations, rawSnapshots, sourceCursors, sources } from "@aus-dash/db";
import { createSeedLiveStore, type LiveObservation } from "@aus-dash/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { persistIngestArtifacts } from "../src/repositories/ingest-persistence";
import { buildRegistryBackedProcessor } from "../src/queue/worker";

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

function createObservation(overrides: Partial<LiveObservation> = {}): LiveObservation {
  return {
    seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
    regionCode: "AU",
    countryCode: "AU",
    market: "NEM",
    metricFamily: "wholesale",
    date: "2026-02-27T02:00:00Z",
    intervalStartUtc: "2026-02-27T02:00:00Z",
    intervalEndUtc: "2026-02-27T02:00:00Z",
    value: 118,
    unit: "aud_mwh",
    currency: "AUD",
    sourceName: "AEMO",
    sourceUrl:
      "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem",
    publishedAt: "2026-02-27T02:00:00Z",
    ingestedAt: "2026-02-27T02:05:00Z",
    vintage: "2026-02-27",
    isModeled: false,
    confidence: "official",
    methodologyVersion: "energy-wholesale-v1",
    ...overrides
  };
}

describeIfDatabase("postgres ingest persistence", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(ingestionRuns);
    await db.delete(sourceCursors);
    await db.delete(rawSnapshots);
    await db.delete(observations);
    await db.delete(sources);
  });

  afterEach(async () => {
    const db = getDb();
    await db.delete(ingestionRuns);
    await db.delete(sourceCursors);
    await db.delete(rawSnapshots);
    await db.delete(observations);
    await db.delete(sources);
  });

  test("persists queue execution metadata for postgres-backed jobs", async () => {
    const processor = buildRegistryBackedProcessor();

    await processor({
      name: "sync-energy-wholesale-5m",
      id: "postgres-job-7",
      attemptsMade: 2,
      queueName: "ingest-jobs",
      data: {
        sourceMode: "fixture",
        ingestBackend: "postgres",
        runMode: "manual"
      }
    });

    const db = getDb();
    const runs = await db
      .select({
        job: ingestionRuns.job,
        bullJobId: ingestionRuns.bullJobId,
        queueName: ingestionRuns.queueName,
        attempt: ingestionRuns.attempt,
        runMode: ingestionRuns.runMode
      })
      .from(ingestionRuns);

    expect(runs).toEqual([
      expect.objectContaining({
        job: "sync-energy-wholesale-5m",
        bullJobId: "postgres-job-7",
        queueName: "ingest-jobs",
        attempt: 3,
        runMode: "manual"
      })
    ]);
  });

  test("rolls back staged postgres writes when observation timestamps are invalid", async () => {
    const sourceCatalog = createSeedLiveStore().sources.filter(
      (sourceItem) => sourceItem.sourceId === "aemo_wholesale"
    );

    await expect(
      persistIngestArtifacts({
        backend: "postgres",
        sourceCatalog,
        rawSnapshots: [
          {
            sourceId: "aemo_wholesale",
            payload: "timestamp,rrp\n2026-02-27T02:00:00Z,118",
            contentType: "text/csv",
            capturedAt: "2026-02-27T02:05:00Z"
          }
        ],
        observations: [
          createObservation(),
          createObservation({
            date: "2026-02-27T02:05:00Z",
            intervalStartUtc: "2026-02-27T02:05:00Z",
            intervalEndUtc: "2026-02-27T02:05:00Z",
            ingestedAt: "not-a-timestamp"
          })
        ],
        ingestionRun: {
          job: "sync-energy-wholesale-5m",
          status: "failed",
          startedAt: "2026-02-27T02:00:00Z",
          finishedAt: "2026-02-27T02:05:00Z",
          errorSummary: "invalid timestamp"
        }
      })
    ).rejects.toThrow(/Invalid/);

    const db = getDb();
    expect((await db.select().from(sources)).length).toBe(0);
    expect((await db.select().from(rawSnapshots)).length).toBe(0);
    expect((await db.select().from(observations)).length).toBe(0);
    expect((await db.select().from(ingestionRuns)).length).toBe(0);
  });
});
