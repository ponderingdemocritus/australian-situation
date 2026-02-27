import { pgTable, text, timestamp, uuid, numeric, unique, date } from "drizzle-orm/pg-core";

export const regions = pgTable("regions", {
  id: uuid("id").defaultRandom().primaryKey(),
  regionType: text("region_type").notNull(),
  regionCode: text("region_code").notNull(),
  name: text("name").notNull(),
  parentRegionId: uuid("parent_region_id")
});

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
    regionId: uuid("region_id").notNull(),
    date: date("date").notNull(),
    value: numeric("value", { precision: 16, scale: 6 }).notNull(),
    vintage: text("vintage").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    observationsUnique: unique().on(
      table.seriesId,
      table.regionId,
      table.date,
      table.vintage
    )
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
  regionId: uuid("region_id").notNull(),
  label: text("label").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  confidence: text("confidence").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull()
});
