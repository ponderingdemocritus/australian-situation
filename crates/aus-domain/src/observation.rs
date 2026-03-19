//! LiveObservation and related types.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Confidence level of an observation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ObservationConfidence {
    Official,
    Derived,
    Qualitative,
}

/// A single live observation data point.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LiveObservation {
    pub series_id: String,
    pub region_code: String,
    pub date: String,
    pub value: Decimal,
    pub unit: String,
    pub source_name: String,
    pub source_url: String,
    pub published_at: DateTime<Utc>,
    pub ingested_at: DateTime<Utc>,
    pub vintage: String,
    pub is_modeled: bool,
    pub confidence: ObservationConfidence,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub market: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metric_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tax_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub consumption_band: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_start_utc: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_end_utc: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub methodology_version: Option<String>,
}
