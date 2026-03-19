CREATE TABLE "index_basket_versions" (
	"basket_version_id" uuid PRIMARY KEY NOT NULL,
	"index_id" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"weight_source" text NOT NULL,
	"methodology_version" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "index_definitions" (
	"index_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_scope" text NOT NULL,
	"geography_level" text NOT NULL,
	"frequency" text NOT NULL,
	"base_period" text NOT NULL,
	"base_value" numeric(12, 4) DEFAULT '100' NOT NULL,
	"aggregation_method" text NOT NULL,
	"published_series_id" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "index_definitions_published_series_unique" UNIQUE("published_series_id")
);

CREATE TABLE "index_weights" (
	"index_weight_id" uuid PRIMARY KEY NOT NULL,
	"basket_version_id" uuid NOT NULL,
	"product_id" uuid,
	"category_id" uuid,
	"region_code" text,
	"weight" numeric(18, 8) NOT NULL,
	"weight_basis" text NOT NULL,
	CONSTRAINT "index_weights_product_or_category_check" CHECK (("index_weights"."product_id" is not null or "index_weights"."category_id" is not null) and not ("index_weights"."product_id" is not null and "index_weights"."category_id" is not null))
);

CREATE TABLE "merchant_locations" (
	"location_id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_code" text,
	"name" text,
	"region_code" text NOT NULL,
	"postcode" text,
	"suburb" text,
	"state" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"is_online_only" boolean DEFAULT false NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);

CREATE TABLE "merchants" (
	"merchant_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"merchant_type" text NOT NULL,
	"website_url" text,
	"country_code" text DEFAULT 'AU' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug")
);

CREATE TABLE "offers" (
	"offer_id" uuid PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid,
	"product_alias_id" uuid,
	"product_id" uuid,
	"external_offer_id" text NOT NULL,
	"listing_url" text,
	"seller_sku" text,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"tax_status" text DEFAULT 'incl_tax' NOT NULL,
	"unit_count" integer,
	"unit_size_value" numeric(12, 4),
	"unit_size_measure" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "offers_source_merchant_external_unique" UNIQUE("source_id","merchant_id","external_offer_id")
);

CREATE TABLE "price_observations" (
	"price_observation_id" uuid PRIMARY KEY NOT NULL,
	"offer_id" uuid NOT NULL,
	"product_id" uuid,
	"merchant_id" uuid NOT NULL,
	"location_id" uuid,
	"region_code" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"observed_date" date NOT NULL,
	"availability_status" text,
	"in_stock" boolean,
	"price_type" text NOT NULL,
	"price_amount" numeric(12, 4) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"unit_price_amount" numeric(12, 6),
	"unit_price_unit" text,
	"promo_label" text,
	"multibuy_quantity" integer,
	"multibuy_total_amount" numeric(12, 4),
	"effective_from" date,
	"effective_to" date,
	"source_run_id" text,
	"raw_snapshot_id" text,
	"observed_checksum" text,
	"quality_flag" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "price_observations_offer_observed_price_type_unique" UNIQUE("offer_id","observed_at","price_type")
);

CREATE TABLE "price_rollups_daily" (
	"rollup_id" uuid PRIMARY KEY NOT NULL,
	"rollup_date" date NOT NULL,
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"region_code" text NOT NULL,
	"merchant_id" uuid,
	"sample_size" integer NOT NULL,
	"distinct_offer_count" integer NOT NULL,
	"min_price" numeric(12, 4) NOT NULL,
	"max_price" numeric(12, 4) NOT NULL,
	"mean_price" numeric(12, 4) NOT NULL,
	"median_price" numeric(12, 4) NOT NULL,
	"p25_price" numeric(12, 4),
	"p75_price" numeric(12, 4),
	"mean_unit_price" numeric(12, 6),
	"median_unit_price" numeric(12, 6),
	"methodology_version" text NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);

CREATE TABLE "product_aliases" (
	"product_alias_id" uuid PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"merchant_id" uuid NOT NULL,
	"external_product_id" text NOT NULL,
	"external_sku" text,
	"product_id" uuid,
	"match_confidence" text NOT NULL,
	"match_method" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "product_aliases_source_merchant_external_unique" UNIQUE("source_id","merchant_id","external_product_id")
);

CREATE TABLE "product_categories" (
	"category_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_category_id" uuid,
	"abs_cpi_code" text,
	"abs_cpi_level" text,
	"is_major_good" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "product_categories_slug_unique" UNIQUE("slug")
);

CREATE TABLE "products" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"canonical_name" text NOT NULL,
	"brand" text,
	"variant" text,
	"size_value" numeric(12, 4),
	"size_unit" text,
	"pack_count" integer,
	"normalized_quantity" numeric(12, 4),
	"normalized_unit" text,
	"gtin" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);

ALTER TABLE "index_basket_versions" ADD CONSTRAINT "index_basket_versions_index_id_index_definitions_index_id_fk" FOREIGN KEY ("index_id") REFERENCES "public"."index_definitions"("index_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "index_weights" ADD CONSTRAINT "index_weights_basket_version_id_index_basket_versions_basket_version_id_fk" FOREIGN KEY ("basket_version_id") REFERENCES "public"."index_basket_versions"("basket_version_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "index_weights" ADD CONSTRAINT "index_weights_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "index_weights" ADD CONSTRAINT "index_weights_category_id_product_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("category_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "index_weights" ADD CONSTRAINT "index_weights_region_code_regions_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("region_code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "merchant_locations" ADD CONSTRAINT "merchant_locations_merchant_id_merchants_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("merchant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "merchant_locations" ADD CONSTRAINT "merchant_locations_region_code_regions_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("region_code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_id_sources_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("source_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "offers" ADD CONSTRAINT "offers_merchant_id_merchants_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("merchant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "offers" ADD CONSTRAINT "offers_location_id_merchant_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("location_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_alias_id_product_aliases_product_alias_id_fk" FOREIGN KEY ("product_alias_id") REFERENCES "public"."product_aliases"("product_alias_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_offer_id_offers_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("offer_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_merchant_id_merchants_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("merchant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_location_id_merchant_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("location_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_region_code_regions_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("region_code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_source_run_id_ingestion_runs_run_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."ingestion_runs"("run_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_raw_snapshot_id_raw_snapshots_snapshot_id_fk" FOREIGN KEY ("raw_snapshot_id") REFERENCES "public"."raw_snapshots"("snapshot_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_rollups_daily" ADD CONSTRAINT "price_rollups_daily_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_rollups_daily" ADD CONSTRAINT "price_rollups_daily_category_id_product_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("category_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_rollups_daily" ADD CONSTRAINT "price_rollups_daily_region_code_regions_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("region_code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "price_rollups_daily" ADD CONSTRAINT "price_rollups_daily_merchant_id_merchants_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("merchant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_source_id_sources_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("source_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_merchant_id_merchants_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("merchant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_category_id_product_categories_category_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."product_categories"("category_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("category_id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "index_basket_versions_index_effective_from_idx" ON "index_basket_versions" USING btree ("index_id","effective_from");
CREATE INDEX "index_weights_basket_idx" ON "index_weights" USING btree ("basket_version_id");
CREATE UNIQUE INDEX "index_weights_identity_unique" ON "index_weights" USING btree ("basket_version_id",coalesce("product_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("category_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("region_code", 'AU'));
CREATE INDEX "merchant_locations_merchant_region_idx" ON "merchant_locations" USING btree ("merchant_id","region_code");
CREATE INDEX "merchant_locations_region_idx" ON "merchant_locations" USING btree ("region_code");
CREATE UNIQUE INDEX "merchant_locations_merchant_location_unique" ON "merchant_locations" USING btree ("merchant_id",coalesce("location_code", ''));
CREATE INDEX "offers_product_idx" ON "offers" USING btree ("product_id");
CREATE INDEX "offers_merchant_location_idx" ON "offers" USING btree ("merchant_id","location_id");
CREATE INDEX "offers_product_alias_idx" ON "offers" USING btree ("product_alias_id");
CREATE INDEX "price_observations_product_date_region_idx" ON "price_observations" USING btree ("product_id","observed_date","region_code");
CREATE INDEX "price_observations_merchant_date_region_idx" ON "price_observations" USING btree ("merchant_id","observed_date","region_code");
CREATE INDEX "price_observations_region_date_idx" ON "price_observations" USING btree ("region_code","observed_date");
CREATE INDEX "price_observations_observed_at_idx" ON "price_observations" USING btree ("observed_at");
CREATE INDEX "price_rollups_daily_product_region_date_idx" ON "price_rollups_daily" USING btree ("product_id","region_code","rollup_date");
CREATE INDEX "price_rollups_daily_category_region_date_idx" ON "price_rollups_daily" USING btree ("category_id","region_code","rollup_date");
CREATE UNIQUE INDEX "price_rollups_daily_identity_unique" ON "price_rollups_daily" USING btree ("rollup_date","product_id","region_code",coalesce("merchant_id", '00000000-0000-0000-0000-000000000000'::uuid),"methodology_version");
CREATE INDEX "product_aliases_product_idx" ON "product_aliases" USING btree ("product_id");
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
CREATE INDEX "products_gtin_idx" ON "products" USING btree ("gtin");
CREATE UNIQUE INDEX "products_identity_unique" ON "products" USING btree (lower("canonical_name"),coalesce(lower("brand"), ''),coalesce(lower("variant"), ''),coalesce("size_value", 0),coalesce(lower("size_unit"), ''));
