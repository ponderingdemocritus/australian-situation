import { describe, expect, test } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
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

  test("observation table includes comparison methodology metadata columns", () => {
    expect(observations.countryCode).toBeDefined();
    expect(observations.market).toBeDefined();
    expect(observations.metricFamily).toBeDefined();
    expect(observations.currency).toBeDefined();
    expect(observations.taxStatus).toBeDefined();
    expect(observations.consumptionBand).toBeDefined();
    expect(observations.intervalStartUtc).toBeDefined();
    expect(observations.intervalEndUtc).toBeDefined();
    expect(observations.methodologyVersion).toBeDefined();
  });

  test("observation table includes index for comparison queries", () => {
    const tableConfig = getTableConfig(observations);
    const indexNames = tableConfig.indexes.map((entry) => entry.config.name);

    expect(indexNames).toContain("observations_country_metric_date_idx");
  });

  test("observation table preserves idempotent uniqueness key", () => {
    const tableConfig = getTableConfig(observations);
    const constraint = tableConfig.uniqueConstraints.find(
      (entry) => entry.name === "observations_series_region_date_vintage_unique"
    );

    expect(constraint).toBeDefined();
    expect(constraint?.columns.map((column) => column.name)).toEqual([
      "series_id",
      "region_code",
      "date",
      "vintage"
    ]);
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
