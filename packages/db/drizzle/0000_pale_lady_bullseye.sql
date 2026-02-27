CREATE TABLE IF NOT EXISTS "ingestion_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"rows_inserted" integer NOT NULL,
	"rows_updated" integer NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" text NOT NULL,
	"region_code" text NOT NULL,
	"date" text NOT NULL,
	"value" numeric(20, 6) NOT NULL,
	"unit" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL,
	"vintage" text NOT NULL,
	"is_modeled" boolean DEFAULT false NOT NULL,
	"confidence" text NOT NULL,
	CONSTRAINT "observations_series_region_date_vintage_unique" UNIQUE("series_id","region_code","date","vintage")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raw_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"content_type" text NOT NULL,
	"payload" text NOT NULL,
	CONSTRAINT "raw_snapshots_source_checksum_unique" UNIQUE("source_id","checksum_sha256")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_type" text NOT NULL,
	"region_code" text NOT NULL,
	"name" text NOT NULL,
	"parent_region_code" text,
	CONSTRAINT "regions_region_code_unique" UNIQUE("region_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"params_json" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "series" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"frequency" text NOT NULL,
	"source" text NOT NULL,
	"source_series_code" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_cursors" (
	"source_id" text PRIMARY KEY NOT NULL,
	"cursor" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"source_id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"expected_cadence" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_code" text NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"url" text,
	"confidence" text NOT NULL,
	"published_at" timestamp with time zone,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_runs_job_idx" ON "ingestion_runs" USING btree ("job","finished_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "observations_series_region_date_idx" ON "observations" USING btree ("series_id","region_code","date");