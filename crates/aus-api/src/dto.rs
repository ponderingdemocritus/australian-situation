use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct RegionQuery {
    pub region: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SeriesQuery {
    pub region: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EnergyWindowQuery {
    pub region: Option<String>,
    pub window: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RetailComparisonQuery {
    pub country: Option<String>,
    pub peers: Option<String>,
    pub basis: Option<String>,
    #[allow(dead_code)]
    pub tax_status: Option<String>,
    #[allow(dead_code)]
    pub consumption_band: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WholesaleComparisonQuery {
    pub country: Option<String>,
    pub peers: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PriceStatusQuery {
    #[allow(dead_code)]
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceRef {
    pub source_id: String,
    pub name: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FreshnessInfo {
    pub updated_at: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MetricPoint {
    pub date: String,
    pub value: f64,
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
}

// ---------------------------------------------------------------------------
// Housing
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HousingOverviewResponse {
    pub region: String,
    pub required_series_ids: Vec<String>,
    pub missing_series_ids: Vec<String>,
    pub metrics: Vec<HousingMetric>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HousingMetric {
    pub series_id: String,
    pub date: String,
    pub value: f64,
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SeriesResponse {
    pub series_id: String,
    pub region: String,
    pub points: Vec<MetricPoint>,
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnergyLiveWholesaleResponse {
    pub region: String,
    pub window: String,
    pub is_modeled: bool,
    pub method_summary: String,
    pub source_refs: Vec<SourceRef>,
    pub latest: Option<WholesaleLatestPoint>,
    pub rollups: Option<WholesaleRollups>,
    pub freshness: FreshnessInfo,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleLatestPoint {
    pub timestamp: String,
    pub value_aud_mwh: f64,
    pub value_c_kwh: f64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleRollups {
    #[allow(dead_code)]
    pub one_hour_avg_aud_mwh: Option<f64>,
    #[allow(dead_code)]
    pub twenty_four_hour_avg_aud_mwh: Option<f64>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnergyRetailAverageResponse {
    pub region: String,
    pub customer_type: String,
    pub is_modeled: bool,
    pub method_summary: String,
    pub source_refs: Vec<SourceRef>,
    pub annual_bill_aud_mean: Option<f64>,
    pub annual_bill_aud_median: Option<f64>,
    pub usage_rate_c_kwh_mean: Option<f64>,
    pub daily_charge_aud_day_mean: Option<f64>,
    pub freshness: FreshnessInfo,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnergyOverviewResponse {
    pub region: String,
    pub method_summary: String,
    pub source_refs: Vec<SourceRef>,
    pub source_mix_views: Vec<SourceMixViewDto>,
    pub panels: EnergyPanels,
    pub freshness: FreshnessInfo,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceMixViewDto {
    pub view_id: String,
    pub title: String,
    pub coverage_label: String,
    pub updated_at: Option<String>,
    pub source_refs: Vec<SourceRef>,
    pub rows: Vec<SourceMixRowDto>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceMixRowDto {
    pub source_key: String,
    pub label: String,
    pub share_pct: f64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnergyPanels {
    pub live_wholesale: Option<PanelWholesale>,
    pub retail_average: Option<PanelRetail>,
    pub benchmark: Option<PanelBenchmark>,
    pub cpi_electricity: Option<PanelCpi>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PanelWholesale {
    #[allow(dead_code)]
    pub value_aud_mwh: f64,
    #[allow(dead_code)]
    pub value_c_kwh: f64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PanelRetail {
    #[allow(dead_code)]
    pub annual_bill_aud_mean: f64,
    #[allow(dead_code)]
    pub annual_bill_aud_median: f64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PanelBenchmark {
    #[allow(dead_code)]
    pub dmo_annual_bill_aud: f64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PanelCpi {
    #[allow(dead_code)]
    pub index_value: f64,
    #[allow(dead_code)]
    pub period: String,
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonResponse {
    pub country: String,
    pub peers: Vec<String>,
    pub au_rank: Option<u32>,
    pub au_percentile: Option<f64>,
    pub methodology_version: String,
    pub rows: Vec<ComparisonRow>,
    pub comparisons: Vec<ComparisonPeer>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonRow {
    pub country_code: String,
    pub date: String,
    pub value: f64,
    pub methodology_version: Option<String>,
    pub rank: u32,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonPeer {
    pub peer_country_code: String,
    pub peer_value: f64,
    pub gap: f64,
    pub gap_pct: f64,
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MetadataFreshnessResponse {
    pub generated_at: String,
    pub stale_series_count: u32,
    pub series: Vec<FreshnessSeriesItem>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FreshnessSeriesItem {
    pub series_id: String,
    pub region_code: String,
    pub expected_cadence: String,
    pub updated_at: Option<String>,
    pub lag_minutes: Option<i64>,
    pub freshness_status: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSourcesResponse {
    pub generated_at: String,
    pub sources: Vec<SourceCatalogDto>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SourceCatalogDto {
    pub source_id: String,
    pub domain: String,
    pub name: String,
    pub url: String,
    pub expected_cadence: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MethodologyResponse {
    pub metric: String,
    pub methodology_version: String,
    pub description: String,
    pub required_dimensions: Vec<String>,
}

// ---------------------------------------------------------------------------
// Price index
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceIndexOverviewResponse {
    pub region: String,
    pub methodology_version: String,
    pub method_summary: String,
    pub source_refs: Vec<SourceRef>,
    pub indexes: Vec<PriceIndexItem>,
    pub freshness: FreshnessInfo,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceIndexItem {
    pub series_id: String,
    pub label: String,
    pub date: String,
    pub value: f64,
}
