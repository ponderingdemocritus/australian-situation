//! FromRow structs for all database tables.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Core tables (migration 0000 + 0001 + 0002)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Region {
    pub id: Uuid,
    pub region_type: String,
    pub region_code: String,
    pub name: String,
    pub parent_region_code: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Series {
    pub id: String,
    pub category: String,
    pub name: String,
    pub unit: String,
    pub frequency: String,
    pub source: String,
    pub source_series_code: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Observation {
    pub id: Uuid,
    pub series_id: String,
    pub region_code: String,
    pub country_code: Option<String>,
    pub market: Option<String>,
    pub metric_family: Option<String>,
    pub date: String,
    pub interval_start_utc: Option<DateTime<Utc>>,
    pub interval_end_utc: Option<DateTime<Utc>>,
    pub value: Decimal,
    pub unit: String,
    pub currency: Option<String>,
    pub tax_status: Option<String>,
    pub consumption_band: Option<String>,
    pub source_name: String,
    pub source_url: String,
    pub published_at: DateTime<Utc>,
    pub ingested_at: DateTime<Utc>,
    pub vintage: String,
    pub is_modeled: bool,
    pub confidence: String,
    pub methodology_version: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Source {
    pub source_id: String,
    pub domain: String,
    pub name: String,
    pub url: String,
    pub expected_cadence: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct SourceCursorRow {
    pub source_id: String,
    pub cursor: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct IngestionRunRow {
    pub run_id: String,
    pub job: String,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub rows_inserted: i32,
    pub rows_updated: i32,
    pub error_summary: Option<String>,
    pub bull_job_id: Option<String>,
    pub queue_name: Option<String>,
    pub attempt: Option<i32>,
    pub run_mode: Option<String>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct RawSnapshotRow {
    pub snapshot_id: String,
    pub source_id: String,
    pub checksum_sha256: String,
    pub captured_at: DateTime<Utc>,
    pub content_type: String,
    pub payload: String,
}

// ---------------------------------------------------------------------------
// Price warehouse tables (migration 0003 + 0004)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProductCategory {
    pub category_id: Uuid,
    pub slug: String,
    pub name: String,
    pub parent_category_id: Option<Uuid>,
    pub abs_cpi_code: Option<String>,
    pub abs_cpi_level: Option<String>,
    pub is_major_good: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Product {
    pub product_id: Uuid,
    pub category_id: Uuid,
    pub slug: String,
    pub canonical_name: String,
    pub brand: Option<String>,
    pub variant: Option<String>,
    pub size_value: Option<Decimal>,
    pub size_unit: Option<String>,
    pub pack_count: Option<i32>,
    pub normalized_quantity: Option<Decimal>,
    pub normalized_unit: Option<String>,
    pub gtin: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // migration 0004 columns
    pub product_family_slug: Option<String>,
    pub country_of_origin: Option<String>,
    pub is_australian_made: Option<bool>,
    pub manufacturer_name: Option<String>,
    pub domestic_value_share_band: Option<String>,
    pub ai_exposure_level: Option<String>,
    pub ai_exposure_reason: Option<String>,
    pub comparable_unit_basis: Option<String>,
    pub is_control_candidate: bool,
    pub cohort_ready: bool,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Merchant {
    pub merchant_id: Uuid,
    pub slug: String,
    pub name: String,
    pub merchant_type: String,
    pub website_url: Option<String>,
    pub country_code: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct PriceObservation {
    pub price_observation_id: Uuid,
    pub offer_id: Uuid,
    pub product_id: Option<Uuid>,
    pub merchant_id: Uuid,
    pub location_id: Option<Uuid>,
    pub region_code: String,
    pub observed_at: DateTime<Utc>,
    pub observed_date: chrono::NaiveDate,
    pub availability_status: Option<String>,
    pub in_stock: Option<bool>,
    pub price_type: String,
    pub price_amount: Decimal,
    pub currency: String,
    pub unit_price_amount: Option<Decimal>,
    pub unit_price_unit: Option<String>,
    pub promo_label: Option<String>,
    pub multibuy_quantity: Option<i32>,
    pub multibuy_total_amount: Option<Decimal>,
    pub effective_from: Option<chrono::NaiveDate>,
    pub effective_to: Option<chrono::NaiveDate>,
    pub source_run_id: Option<String>,
    pub raw_snapshot_id: Option<String>,
    pub observed_checksum: Option<String>,
    pub quality_flag: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct PriceRollupDaily {
    pub rollup_id: Uuid,
    pub rollup_date: chrono::NaiveDate,
    pub product_id: Uuid,
    pub category_id: Uuid,
    pub region_code: String,
    pub merchant_id: Option<Uuid>,
    pub sample_size: i32,
    pub distinct_offer_count: i32,
    pub min_price: Decimal,
    pub max_price: Decimal,
    pub mean_price: Decimal,
    pub median_price: Decimal,
    pub p25_price: Option<Decimal>,
    pub p75_price: Option<Decimal>,
    pub mean_unit_price: Option<Decimal>,
    pub median_unit_price: Option<Decimal>,
    pub methodology_version: String,
    pub computed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct IndexDefinition {
    pub index_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category_scope: String,
    pub geography_level: String,
    pub frequency: String,
    pub base_period: String,
    pub base_value: Decimal,
    pub aggregation_method: String,
    pub published_series_id: Option<String>,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Scenario {
    pub id: Uuid,
    pub name: String,
    pub kind: String,
    pub params_json: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct WatchlistItem {
    pub id: Uuid,
    pub region_code: String,
    pub label: String,
    pub source: String,
    pub url: Option<String>,
    pub confidence: String,
    pub published_at: Option<DateTime<Utc>>,
    pub observed_at: DateTime<Utc>,
}
