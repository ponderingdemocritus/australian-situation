//! Observation queries.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Observation;

/// List observations by series_id and region_code, ordered by date DESC, vintage DESC.
pub async fn list_by_series(
    pool: &PgPool,
    series_id: &str,
    region_code: &str,
) -> Result<Vec<Observation>, sqlx::Error> {
    sqlx::query_as::<_, Observation>(
        r#"SELECT * FROM observations
           WHERE series_id = $1 AND region_code = $2
           ORDER BY date DESC, vintage DESC, published_at DESC, ingested_at DESC"#,
    )
    .bind(series_id)
    .bind(region_code)
    .fetch_all(pool)
    .await
}

/// Get the latest observation for a series/region.
pub async fn latest_by_series(
    pool: &PgPool,
    series_id: &str,
    region_code: &str,
) -> Result<Option<Observation>, sqlx::Error> {
    sqlx::query_as::<_, Observation>(
        r#"SELECT * FROM observations
           WHERE series_id = $1 AND region_code = $2
           ORDER BY date DESC, vintage DESC, published_at DESC, ingested_at DESC
           LIMIT 1"#,
    )
    .bind(series_id)
    .bind(region_code)
    .fetch_optional(pool)
    .await
}

/// List latest observations across countries for a given metric_family.
pub async fn latest_by_country(
    pool: &PgPool,
    metric_family: &str,
) -> Result<Vec<Observation>, sqlx::Error> {
    sqlx::query_as::<_, Observation>(
        r#"SELECT DISTINCT ON (country_code) * FROM observations
           WHERE metric_family = $1 AND country_code IS NOT NULL
           ORDER BY country_code, date DESC, vintage DESC, published_at DESC, ingested_at DESC"#,
    )
    .bind(metric_family)
    .fetch_all(pool)
    .await
}

/// List observations for multiple series IDs in a region.
pub async fn list_by_series_ids(
    pool: &PgPool,
    series_ids: &[&str],
    region_code: &str,
) -> Result<Vec<Observation>, sqlx::Error> {
    sqlx::query_as::<_, Observation>(
        r#"SELECT * FROM observations
           WHERE series_id = ANY($1) AND region_code = $2
           ORDER BY series_id, date DESC, vintage DESC"#,
    )
    .bind(series_ids)
    .bind(region_code)
    .fetch_all(pool)
    .await
}

/// Upsert a batch of observations (ON CONFLICT update).
///
/// Returns `(affected, 0)` -- SQLx does not distinguish inserts from updates
/// in a single upsert statement without `xmax` introspection.
pub async fn upsert_batch(
    pool: &PgPool,
    observations: &[Observation],
) -> Result<(i64, i64), sqlx::Error> {
    let mut affected: i64 = 0;

    for obs in observations {
        let result = sqlx::query(
            r#"INSERT INTO observations (
                id, series_id, region_code, country_code, market, metric_family,
                date, interval_start_utc, interval_end_utc, value, unit, currency,
                tax_status, consumption_band, source_name, source_url,
                published_at, ingested_at, vintage, is_modeled, confidence, methodology_version
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            )
            ON CONFLICT (series_id, region_code, date, vintage) DO UPDATE SET
                value = EXCLUDED.value,
                source_name = EXCLUDED.source_name,
                source_url = EXCLUDED.source_url,
                published_at = EXCLUDED.published_at,
                ingested_at = EXCLUDED.ingested_at,
                is_modeled = EXCLUDED.is_modeled,
                confidence = EXCLUDED.confidence,
                interval_start_utc = EXCLUDED.interval_start_utc,
                interval_end_utc = EXCLUDED.interval_end_utc,
                currency = EXCLUDED.currency,
                tax_status = EXCLUDED.tax_status,
                consumption_band = EXCLUDED.consumption_band,
                methodology_version = EXCLUDED.methodology_version
            "#,
        )
        .bind(obs.id)
        .bind(&obs.series_id)
        .bind(&obs.region_code)
        .bind(&obs.country_code)
        .bind(&obs.market)
        .bind(&obs.metric_family)
        .bind(&obs.date)
        .bind(obs.interval_start_utc)
        .bind(obs.interval_end_utc)
        .bind(obs.value)
        .bind(&obs.unit)
        .bind(&obs.currency)
        .bind(&obs.tax_status)
        .bind(&obs.consumption_band)
        .bind(&obs.source_name)
        .bind(&obs.source_url)
        .bind(obs.published_at)
        .bind(obs.ingested_at)
        .bind(&obs.vintage)
        .bind(obs.is_modeled)
        .bind(&obs.confidence)
        .bind(&obs.methodology_version)
        .execute(pool)
        .await?;

        affected += result.rows_affected() as i64;
    }

    Ok((affected, 0))
}

/// Create a new observation ID.
pub fn new_id() -> Uuid {
    Uuid::new_v4()
}
