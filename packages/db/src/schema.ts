import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    regionType: text("region_type").notNull(),
    regionCode: text("region_code").notNull(),
    name: text("name").notNull(),
    parentRegionCode: text("parent_region_code")
  },
  (table) => ({
    regionsCodeUnique: unique("regions_region_code_unique").on(table.regionCode)
  })
);

export const series = pgTable("series", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  frequency: text("frequency").notNull(),
  source: text("source").notNull(),
  sourceSeriesCode: text("source_series_code")
});

export const observations = pgTable(
  "observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seriesId: text("series_id").notNull(),
    regionCode: text("region_code").notNull(),
    date: text("date").notNull(),
    value: numeric("value", { precision: 20, scale: 6 }).notNull(),
    unit: text("unit").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
    vintage: text("vintage").notNull(),
    isModeled: boolean("is_modeled").notNull().default(false),
    confidence: text("confidence").notNull()
  },
  (table) => ({
    observationsUnique: unique("observations_series_region_date_vintage_unique").on(
      table.seriesId,
      table.regionCode,
      table.date,
      table.vintage
    ),
    observationsSeriesRegionDateIdx: index("observations_series_region_date_idx").on(
      table.seriesId,
      table.regionCode,
      table.date
    )
  })
);

export const sources = pgTable("sources", {
  sourceId: text("source_id").primaryKey(),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  expectedCadence: text("expected_cadence").notNull()
});

export const sourceCursors = pgTable("source_cursors", {
  sourceId: text("source_id").primaryKey(),
  cursor: text("cursor").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    runId: text("run_id").primaryKey(),
    job: text("job").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    rowsInserted: integer("rows_inserted").notNull(),
    rowsUpdated: integer("rows_updated").notNull(),
    errorSummary: text("error_summary")
  },
  (table) => ({
    ingestionRunsJobIdx: index("ingestion_runs_job_idx").on(table.job, table.finishedAt)
  })
);

export const rawSnapshots = pgTable(
  "raw_snapshots",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    sourceId: text("source_id").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    contentType: text("content_type").notNull(),
    payload: text("payload").notNull()
  },
  (table) => ({
    rawSnapshotsSourceChecksumUnique: unique(
      "raw_snapshots_source_checksum_unique"
    ).on(table.sourceId, table.checksumSha256)
  })
);

export const scenarios = pgTable("scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  paramsJson: text("params_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const watchlistItems = pgTable("watchlist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  regionCode: text("region_code").notNull(),
  label: text("label").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  confidence: text("confidence").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull()
});
