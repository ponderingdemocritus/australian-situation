import { describe, expect, test } from "vitest";
import {
  ingestionRuns,
  observations,
  rawSnapshots,
  sourceCursors,
  sources
} from "../src/schema";

describe("db schema contracts", () => {
  test("observation table includes live ingestion metadata columns", () => {
    expect(observations.seriesId).toBeDefined();
    expect(observations.regionCode).toBeDefined();
    expect(observations.date).toBeDefined();
    expect(observations.value).toBeDefined();
    expect(observations.unit).toBeDefined();
    expect(observations.sourceName).toBeDefined();
    expect(observations.sourceUrl).toBeDefined();
    expect(observations.publishedAt).toBeDefined();
    expect(observations.ingestedAt).toBeDefined();
    expect(observations.vintage).toBeDefined();
    expect(observations.isModeled).toBeDefined();
    expect(observations.confidence).toBeDefined();
  });

  test("includes operational tables for sources, cursors, runs, and raw snapshots", () => {
    expect(sources.sourceId).toBeDefined();
    expect(sources.expectedCadence).toBeDefined();

    expect(sourceCursors.sourceId).toBeDefined();
    expect(sourceCursors.cursor).toBeDefined();
    expect(sourceCursors.updatedAt).toBeDefined();

    expect(ingestionRuns.runId).toBeDefined();
    expect(ingestionRuns.job).toBeDefined();
    expect(ingestionRuns.status).toBeDefined();
    expect(ingestionRuns.rowsInserted).toBeDefined();
    expect(ingestionRuns.rowsUpdated).toBeDefined();

    expect(rawSnapshots.snapshotId).toBeDefined();
    expect(rawSnapshots.sourceId).toBeDefined();
    expect(rawSnapshots.checksumSha256).toBeDefined();
    expect(rawSnapshots.payload).toBeDefined();
  });
});
