ALTER TABLE "products" ADD COLUMN "product_family_slug" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "country_of_origin" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_australian_made" boolean;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "manufacturer_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "domestic_value_share_band" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_exposure_level" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_exposure_reason" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "comparable_unit_basis" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_control_candidate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cohort_ready" boolean DEFAULT false NOT NULL;