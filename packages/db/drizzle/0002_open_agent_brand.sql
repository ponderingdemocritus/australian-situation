ALTER TABLE "ingestion_runs" ADD COLUMN "bull_job_id" text;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD COLUMN "queue_name" text;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD COLUMN "attempt" integer;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD COLUMN "run_mode" text;--> statement-breakpoint
CREATE INDEX "ingestion_runs_queue_job_idx" ON "ingestion_runs" USING btree ("queue_name","job","finished_at");