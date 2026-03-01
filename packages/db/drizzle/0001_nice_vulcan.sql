ALTER TABLE "observations" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "market" text;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "metric_family" text;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "interval_start_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "interval_end_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "tax_status" text;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "consumption_band" text;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "methodology_version" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "observations_country_metric_date_idx" ON "observations" USING btree ("country_code","metric_family","date");