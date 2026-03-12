# Price Index DB Structure

## Recommendation

Use a two-layer model:

1. Keep the existing `series` + `observations` tables as the public, curated time-series layer.
2. Add a separate raw price warehouse for scraped product, merchant, offer, and price history.

That split matters. Scraped retail prices are noisy, high-volume, and revision-prone. Public index series need stable semantics, small payloads, and backward-compatible API behavior. One table should not do both jobs.

## Fit With This Repo

The repo already has good operational tables:

- `sources`
- `source_cursors`
- `ingestion_runs`
- `raw_snapshots`
- `regions`
- `series`
- `observations`

Keep those. The new design should plug into them instead of replacing them.

Recommended flow:

```text
[agent scrape]
    -> raw_snapshots
    -> price_* warehouse tables
    -> daily/weekly rollups
    -> derived index series
    -> observations (public API layer)
```

## Core Principle

The base fact should be:

- one observed price
- for one merchant offer
- at one point in time
- in one geography

Everything else should derive from that.

## Proposed Tables

### 1. `product_categories`

Purpose: stable hierarchy for "major goods" and CPI-style grouping.

Key columns:

- `category_id uuid primary key`
- `slug text not null unique`
- `name text not null`
- `parent_category_id uuid`
- `abs_cpi_code text`
- `abs_cpi_level text`
- `is_major_good boolean not null default false`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Notes:

- Use ABS CPI / expenditure-class style mapping where possible.
- This is how you answer "all bread", "all milk", "fruit", "fuel", not just exact SKUs.

### 2. `products`

Purpose: canonical product identity independent of retailer listing noise.

Key columns:

- `product_id uuid primary key`
- `category_id uuid not null references product_categories(category_id)`
- `canonical_name text not null`
- `brand text`
- `variant text`
- `size_value numeric(12,4)`
- `size_unit text`
- `pack_count integer`
- `normalized_quantity numeric(12,4)`
- `normalized_unit text`
- `gtin text`
- `is_active boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes:

- unique index on `(canonical_name, coalesce(brand, ''), coalesce(variant, ''), coalesce(size_value, 0), coalesce(size_unit, ''))`
- index on `category_id`
- index on `gtin`

Notes:

- `normalized_quantity` + `normalized_unit` let you compare unit prices across pack sizes.
- Do not rely on listing names alone for identity.

### 3. `product_aliases`

Purpose: map retailer-specific product identifiers to canonical products.

Key columns:

- `product_alias_id uuid primary key`
- `source_id text not null references sources(source_id)`
- `merchant_id uuid not null`
- `external_product_id text not null`
- `external_sku text`
- `product_id uuid references products(product_id)`
- `match_confidence text not null`
- `match_method text not null`
- `first_seen_at timestamptz not null`
- `last_seen_at timestamptz not null`

Indexes:

- unique index on `(source_id, merchant_id, external_product_id)`
- index on `product_id`

Notes:

- Agents will scrape messy IDs. This table is the reconciliation layer.
- Allow `product_id` to be null until matching is complete.

### 4. `merchants`

Purpose: retailer / seller dimension.

Key columns:

- `merchant_id uuid primary key`
- `slug text not null unique`
- `name text not null`
- `merchant_type text not null`
- `website_url text`
- `country_code text not null default 'AU'`
- `is_active boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Examples:

- supermarket
- fuel_station_chain
- pharmacy
- department_store
- marketplace

### 5. `merchant_locations`

Purpose: physical or pricing geography for an offer.

Key columns:

- `location_id uuid primary key`
- `merchant_id uuid not null references merchants(merchant_id)`
- `location_code text`
- `name text`
- `region_code text not null references regions(region_code)`
- `postcode text`
- `suburb text`
- `state text`
- `latitude numeric(9,6)`
- `longitude numeric(9,6)`
- `is_online_only boolean not null default false`
- `opened_at timestamptz`
- `closed_at timestamptz`

Indexes:

- unique index on `(merchant_id, coalesce(location_code, ''))`
- index on `region_code`
- index on `(merchant_id, region_code)`

Notes:

- For national online pricing, use a synthetic online location and `region_code = 'AU'`.

### 6. `offers`

Purpose: stable listing identity for something a merchant is selling.

Key columns:

- `offer_id uuid primary key`
- `source_id text not null references sources(source_id)`
- `merchant_id uuid not null references merchants(merchant_id)`
- `location_id uuid references merchant_locations(location_id)`
- `product_alias_id uuid references product_aliases(product_alias_id)`
- `product_id uuid references products(product_id)`
- `external_offer_id text not null`
- `listing_url text`
- `seller_sku text`
- `currency text not null default 'AUD'`
- `tax_status text not null default 'incl_tax'`
- `unit_count integer`
- `unit_size_value numeric(12,4)`
- `unit_size_measure text`
- `is_active boolean not null default true`
- `first_seen_at timestamptz not null`
- `last_seen_at timestamptz not null`

Indexes:

- unique index on `(source_id, merchant_id, external_offer_id)`
- index on `product_id`
- index on `(merchant_id, location_id)`
- index on `product_alias_id`

Notes:

- `offers` are what change price over time.
- `products` are what the index methodology aggregates.

### 7. `price_observations`

Purpose: the raw time-series fact table.

Key columns:

- `price_observation_id uuid primary key`
- `offer_id uuid not null references offers(offer_id)`
- `product_id uuid references products(product_id)`
- `merchant_id uuid not null references merchants(merchant_id)`
- `location_id uuid references merchant_locations(location_id)`
- `region_code text not null references regions(region_code)`
- `observed_at timestamptz not null`
- `observed_date date not null`
- `availability_status text`
- `in_stock boolean`
- `price_type text not null`
- `price_amount numeric(12,4) not null`
- `currency text not null default 'AUD'`
- `unit_price_amount numeric(12,6)`
- `unit_price_unit text`
- `promo_label text`
- `multibuy_quantity integer`
- `multibuy_total_amount numeric(12,4)`
- `effective_from date`
- `effective_to date`
- `source_run_id text references ingestion_runs(run_id)`
- `raw_snapshot_id text references raw_snapshots(snapshot_id)`
- `observed_checksum text`
- `quality_flag text`
- `created_at timestamptz not null`

Indexes:

- unique index on `(offer_id, observed_at, price_type)`
- index on `(product_id, observed_date, region_code)`
- index on `(merchant_id, observed_date, region_code)`
- index on `(region_code, observed_date)`
- BRIN or partition-local index on `observed_at`

Partitioning:

- Partition by month on `observed_at`.
- Keep 1 partition per month for predictable retention and vacuum behavior.

Notes:

- This is the table that should grow very large.
- Use `timestamptz` here, not text dates.
- `observed_date` exists for fast daily grouping without repeated casts.

### 8. `price_rollups_daily`

Purpose: fast derived daily series by product and geography.

Key columns:

- `rollup_date date not null`
- `product_id uuid not null references products(product_id)`
- `category_id uuid not null references product_categories(category_id)`
- `region_code text not null references regions(region_code)`
- `merchant_id uuid`
- `sample_size integer not null`
- `distinct_offer_count integer not null`
- `min_price numeric(12,4) not null`
- `max_price numeric(12,4) not null`
- `mean_price numeric(12,4) not null`
- `median_price numeric(12,4) not null`
- `p25_price numeric(12,4)`
- `p75_price numeric(12,4)`
- `mean_unit_price numeric(12,6)`
- `median_unit_price numeric(12,6)`
- `methodology_version text not null`
- `computed_at timestamptz not null`

Primary key:

- `(rollup_date, product_id, region_code, coalesce(merchant_id, '00000000-0000-0000-0000-000000000000'::uuid), methodology_version)`

Notes:

- This table is the base for product-level and category-level index calculations.
- Median is usually safer than mean for scraped retail prices.

### 9. `index_definitions`

Purpose: metadata for each published price index.

Key columns:

- `index_id text primary key`
- `name text not null`
- `description text`
- `category_scope text not null`
- `geography_level text not null`
- `frequency text not null`
- `base_period text not null`
- `base_value numeric(12,4) not null default 100`
- `aggregation_method text not null`
- `published_series_id text unique`
- `is_public boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Notes:

- `published_series_id` should map into the existing `series.id`.
- Example: `prices.grocery.major_goods.index`.

### 10. `index_basket_versions`

Purpose: weight versioning over time.

Key columns:

- `basket_version_id uuid primary key`
- `index_id text not null references index_definitions(index_id)`
- `effective_from date not null`
- `effective_to date`
- `weight_source text not null`
- `methodology_version text not null`
- `notes text`
- `created_at timestamptz not null`

Indexes:

- index on `(index_id, effective_from desc)`

Notes:

- This lets you rebase or reweight without rewriting history.

### 11. `index_weights`

Purpose: product/category weights within a basket version.

Key columns:

- `basket_version_id uuid not null references index_basket_versions(basket_version_id)`
- `product_id uuid references products(product_id)`
- `category_id uuid references product_categories(category_id)`
- `region_code text references regions(region_code)`
- `weight numeric(18,8) not null`
- `weight_basis text not null`

Constraints:

- one of `product_id` or `category_id` must be non-null
- primary key on `(basket_version_id, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(region_code, 'AU'))`

Notes:

- Region-specific weights are optional but the schema should allow them.

## What Should Stay In `observations`

Only derived, public-facing time series, for example:

- national grocery index
- state grocery index
- fuel index
- bread median price series
- milk unit-price series

Those series should be written into the existing `series` and `observations` tables after rollup/index computation.

That gives you:

- one stable public query surface
- one flexible raw warehouse
- no need to expose merchant-level scrape noise directly to consumers unless you want to

## What Should Not Go In `observations`

Do not put individual retailer offer scrapes straight into `observations`.

Reasons:

- the current uniqueness key is too coarse
- the current row shape does not model merchant/product identity
- high-cardinality product scraping will bloat API-oriented reads
- rollups and index calculation become harder, not easier

## Partitioning And Performance

Recommended starting point:

1. Standard Postgres 16.
2. Monthly range partitions on `price_observations(observed_at)`.
3. Materialized daily rollups.
4. B-tree indexes for point lookups, BRIN for wide time scans.

Do not add TimescaleDB on day one unless you already know query volume will be extreme. This repo already uses standard Postgres + Drizzle cleanly. Native partitioning is the lowest-friction path.

Add TimescaleDB later if:

- `price_observations` reaches tens of millions of rows quickly
- ad hoc time-bucket queries become dominant
- retention/compression becomes operationally expensive

## Normalization Rules

Store both:

- observed shelf/promotional price
- normalized unit price

Minimum normalization fields:

- currency
- tax status
- pack quantity
- normalized quantity
- normalized unit

Without that, cross-retailer comparisons break immediately.

## Geography Rules

Use existing `regions.region_code` as the canonical geography key.

Recommended support levels:

- `AU`
- state/territory
- GCCSA or metro/rest-of-state later
- postcode when data density is strong enough

Do not make suburb/postcode the primary public index grain initially. State-level and national indexes are much more resilient.

## Revision And Audit Rules

Keep the repo's existing audit pattern:

- `raw_snapshots` stores the exact payload
- `ingestion_runs` stores the run metadata
- `price_observations.raw_snapshot_id` links the fact back to source evidence
- derived rollups/indexes should store `methodology_version`

That gives you reproducibility when an agent changes parsing logic.

## Recommended Repo Boundary

In this repo:

1. Add the raw price warehouse tables to `packages/db`.
2. Keep index publication wired through the existing `series` + `observations` path.
3. Add new ingest jobs in `apps/ingest` that write:
   - raw snapshot
   - merchant/product/offer upserts
   - `price_observations`
   - daily rollups
   - derived index observations
4. Expose public indexes from `apps/api` through the existing repository pattern.

## MVP Sequence

Build in this order:

1. `product_categories`
2. `products`
3. `merchants`
4. `merchant_locations`
5. `product_aliases`
6. `offers`
7. `price_observations`
8. `price_rollups_daily`
9. `index_definitions`
10. `index_basket_versions`
11. `index_weights`
12. publish derived series into `observations`

## Bottom Line

Best structure for this repo:

- Postgres remains the system of record.
- Raw scraped prices live in dedicated `price_*` tables.
- Public time-series stay in `series` and `observations`.
- Indexes are derived from daily product rollups plus versioned basket weights.

That is the cleanest way to support:

- continuous agent-driven scraping
- reproducible methodology
- large raw price history
- stable public API contracts
