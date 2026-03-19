//! Price warehouse queries.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::*;

// ---------------------------------------------------------------------------
// Read queries
// ---------------------------------------------------------------------------

/// List products, optionally filtered by category.
pub async fn list_products(
    pool: &PgPool,
    category_id: Option<Uuid>,
) -> Result<Vec<Product>, sqlx::Error> {
    match category_id {
        Some(cat_id) => {
            sqlx::query_as::<_, Product>(
                "SELECT * FROM products WHERE category_id = $1 AND is_active = true ORDER BY canonical_name",
            )
            .bind(cat_id)
            .fetch_all(pool)
            .await
        }
        None => {
            sqlx::query_as::<_, Product>(
                "SELECT * FROM products WHERE is_active = true ORDER BY canonical_name",
            )
            .fetch_all(pool)
            .await
        }
    }
}

/// List product categories.
pub async fn list_categories(pool: &PgPool) -> Result<Vec<ProductCategory>, sqlx::Error> {
    sqlx::query_as::<_, ProductCategory>("SELECT * FROM product_categories ORDER BY name")
        .fetch_all(pool)
        .await
}

/// Get daily price rollups for a product/category in a region.
pub async fn get_rollups(
    pool: &PgPool,
    product_id: Option<Uuid>,
    category_id: Option<Uuid>,
    region_code: &str,
) -> Result<Vec<PriceRollupDaily>, sqlx::Error> {
    sqlx::query_as::<_, PriceRollupDaily>(
        r#"SELECT * FROM price_rollups_daily
           WHERE region_code = $1
           AND ($2::uuid IS NULL OR product_id = $2)
           AND ($3::uuid IS NULL OR category_id = $3)
           ORDER BY rollup_date DESC"#,
    )
    .bind(region_code)
    .bind(product_id)
    .bind(category_id)
    .fetch_all(pool)
    .await
}

/// Get all active index definitions.
pub async fn get_index_definitions(pool: &PgPool) -> Result<Vec<IndexDefinition>, sqlx::Error> {
    sqlx::query_as::<_, IndexDefinition>(
        "SELECT * FROM index_definitions WHERE is_public = true ORDER BY name",
    )
    .fetch_all(pool)
    .await
}

/// List merchants.
pub async fn list_merchants(pool: &PgPool) -> Result<Vec<Merchant>, sqlx::Error> {
    sqlx::query_as::<_, Merchant>("SELECT * FROM merchants WHERE is_active = true ORDER BY name")
        .fetch_all(pool)
        .await
}

// ---------------------------------------------------------------------------
// Upsert / write queries
// ---------------------------------------------------------------------------

/// Upsert a product row.
pub async fn upsert_product(pool: &PgPool, p: &Product) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO products (
            product_id, category_id, slug, canonical_name, brand, variant,
            size_value, size_unit, pack_count, normalized_quantity, normalized_unit,
            gtin, is_active, created_at, updated_at,
            product_family_slug, country_of_origin, is_australian_made,
            manufacturer_name, domestic_value_share_band,
            ai_exposure_level, ai_exposure_reason,
            comparable_unit_basis, is_control_candidate, cohort_ready
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20,$21,$22,$23,$24,$25
        )
        ON CONFLICT (product_id) DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            slug = EXCLUDED.slug,
            brand = EXCLUDED.brand,
            variant = EXCLUDED.variant,
            size_value = EXCLUDED.size_value,
            size_unit = EXCLUDED.size_unit,
            normalized_quantity = EXCLUDED.normalized_quantity,
            normalized_unit = EXCLUDED.normalized_unit,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at"#,
    )
    .bind(p.product_id)
    .bind(p.category_id)
    .bind(&p.slug)
    .bind(&p.canonical_name)
    .bind(&p.brand)
    .bind(&p.variant)
    .bind(p.size_value)
    .bind(&p.size_unit)
    .bind(p.pack_count)
    .bind(p.normalized_quantity)
    .bind(&p.normalized_unit)
    .bind(&p.gtin)
    .bind(p.is_active)
    .bind(p.created_at)
    .bind(p.updated_at)
    .bind(&p.product_family_slug)
    .bind(&p.country_of_origin)
    .bind(p.is_australian_made)
    .bind(&p.manufacturer_name)
    .bind(&p.domestic_value_share_band)
    .bind(&p.ai_exposure_level)
    .bind(&p.ai_exposure_reason)
    .bind(&p.comparable_unit_basis)
    .bind(p.is_control_candidate)
    .bind(p.cohort_ready)
    .execute(pool)
    .await?;
    Ok(())
}

/// Upsert a price observation (skip on duplicate).
pub async fn upsert_price_observation(
    pool: &PgPool,
    obs: &PriceObservation,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO price_observations (
            price_observation_id, offer_id, product_id, merchant_id, location_id,
            region_code, observed_at, observed_date,
            availability_status, in_stock, price_type,
            price_amount, currency, unit_price_amount, unit_price_unit,
            promo_label, multibuy_quantity, multibuy_total_amount,
            effective_from, effective_to,
            source_run_id, raw_snapshot_id, observed_checksum, quality_flag,
            created_at
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20,$21,$22,$23,$24,$25
        )
        ON CONFLICT (offer_id, observed_at, price_type) DO NOTHING"#,
    )
    .bind(obs.price_observation_id)
    .bind(obs.offer_id)
    .bind(obs.product_id)
    .bind(obs.merchant_id)
    .bind(obs.location_id)
    .bind(&obs.region_code)
    .bind(obs.observed_at)
    .bind(obs.observed_date)
    .bind(&obs.availability_status)
    .bind(obs.in_stock)
    .bind(&obs.price_type)
    .bind(obs.price_amount)
    .bind(&obs.currency)
    .bind(obs.unit_price_amount)
    .bind(&obs.unit_price_unit)
    .bind(&obs.promo_label)
    .bind(obs.multibuy_quantity)
    .bind(obs.multibuy_total_amount)
    .bind(obs.effective_from)
    .bind(obs.effective_to)
    .bind(&obs.source_run_id)
    .bind(&obs.raw_snapshot_id)
    .bind(&obs.observed_checksum)
    .bind(&obs.quality_flag)
    .bind(obs.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

/// Upsert a daily price rollup.
pub async fn upsert_rollup(pool: &PgPool, r: &PriceRollupDaily) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO price_rollups_daily (
            rollup_id, rollup_date, product_id, category_id, region_code,
            merchant_id, sample_size, distinct_offer_count,
            min_price, max_price, mean_price, median_price,
            p25_price, p75_price, mean_unit_price, median_unit_price,
            methodology_version, computed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (rollup_id) DO UPDATE SET
            sample_size = EXCLUDED.sample_size,
            distinct_offer_count = EXCLUDED.distinct_offer_count,
            min_price = EXCLUDED.min_price,
            max_price = EXCLUDED.max_price,
            mean_price = EXCLUDED.mean_price,
            median_price = EXCLUDED.median_price,
            p25_price = EXCLUDED.p25_price,
            p75_price = EXCLUDED.p75_price,
            mean_unit_price = EXCLUDED.mean_unit_price,
            median_unit_price = EXCLUDED.median_unit_price,
            computed_at = EXCLUDED.computed_at"#,
    )
    .bind(r.rollup_id)
    .bind(r.rollup_date)
    .bind(r.product_id)
    .bind(r.category_id)
    .bind(&r.region_code)
    .bind(r.merchant_id)
    .bind(r.sample_size)
    .bind(r.distinct_offer_count)
    .bind(r.min_price)
    .bind(r.max_price)
    .bind(r.mean_price)
    .bind(r.median_price)
    .bind(r.p25_price)
    .bind(r.p75_price)
    .bind(r.mean_unit_price)
    .bind(r.median_unit_price)
    .bind(&r.methodology_version)
    .bind(r.computed_at)
    .execute(pool)
    .await?;
    Ok(())
}
