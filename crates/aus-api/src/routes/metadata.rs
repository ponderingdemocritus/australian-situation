use axum::Json;
use axum::extract::{Query, State};
use chrono::Utc;
use sqlx::PgPool;

use crate::dto::*;
use crate::error::AppError;

#[utoipa::path(
    get,
    path = "/api/metadata/freshness",
    responses((status = 200, body = MetadataFreshnessResponse))
)]
pub async fn freshness(
    State(pool): State<PgPool>,
) -> Result<Json<MetadataFreshnessResponse>, AppError> {
    let sources = aus_domain::source::source_catalog();
    let mut series_items = Vec::new();
    let mut stale_count = 0u32;

    // Check freshness for key series
    for source in &sources {
        let obs =
            aus_db::queries::observations::latest_by_series(&pool, &source.source_id, "AU").await?;
        let freshness = aus_domain::freshness::compute_freshness(
            &source.source_id,
            &source.expected_cadence,
            obs.as_ref().map(|o| o.published_at),
        );
        if matches!(
            freshness.status,
            aus_domain::freshness::FreshnessStatus::Stale
        ) {
            stale_count += 1;
        }
        series_items.push(FreshnessSeriesItem {
            series_id: source.source_id.clone(),
            region_code: "AU".to_string(),
            expected_cadence: source.expected_cadence.clone(),
            updated_at: freshness.last_published_at.map(|t| t.to_rfc3339()),
            lag_minutes: freshness.lag_minutes,
            freshness_status: format!("{:?}", freshness.status).to_lowercase(),
        });
    }

    Ok(Json(MetadataFreshnessResponse {
        generated_at: Utc::now().to_rfc3339(),
        stale_series_count: stale_count,
        series: series_items,
    }))
}

#[utoipa::path(
    get,
    path = "/api/metadata/sources",
    responses((status = 200, body = MetadataSourcesResponse))
)]
pub async fn sources() -> Json<MetadataSourcesResponse> {
    let catalog = aus_domain::source::source_catalog();
    Json(MetadataSourcesResponse {
        generated_at: Utc::now().to_rfc3339(),
        sources: catalog
            .into_iter()
            .map(|s| SourceCatalogDto {
                source_id: s.source_id,
                domain: format!("{:?}", s.domain).to_lowercase(),
                name: s.name,
                url: s.url,
                expected_cadence: s.expected_cadence,
            })
            .collect(),
    })
}

#[derive(Debug, serde::Deserialize)]
pub struct MethodologyQuery {
    pub metric: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/metadata/methodology",
    params(("metric" = Option<String>, Query, description = "Metric identifier")),
    responses((status = 200, body = MethodologyResponse))
)]
pub async fn methodology(
    Query(params): Query<MethodologyQuery>,
) -> Result<Json<MethodologyResponse>, AppError> {
    let metric = params
        .metric
        .as_deref()
        .ok_or_else(|| AppError::bad_request("MISSING_PARAM", "metric parameter required"))?;

    let (version, desc, dims) = match metric {
        "energy.compare.retail" => (
            "energy-compare-retail-v1",
            "International retail electricity price comparison",
            vec!["country", "basis", "tax_status", "consumption_band"],
        ),
        "energy.compare.wholesale" => (
            "energy-compare-wholesale-v1",
            "International wholesale electricity price comparison",
            vec!["country"],
        ),
        "prices.major_goods.index" => (
            "prices-major-goods-v1",
            "Major consumer goods price index",
            vec!["region"],
        ),
        "prices.ai_deflation.index" => (
            "prices-ai-deflation-v1",
            "AI exposure deflation price index",
            vec!["region"],
        ),
        _ => {
            return Err(AppError::not_found(
                "UNKNOWN_METRIC",
                format!("Unknown metric: {metric}"),
            ));
        }
    };

    Ok(Json(MethodologyResponse {
        metric: metric.to_string(),
        methodology_version: version.to_string(),
        description: desc.to_string(),
        required_dimensions: dims.into_iter().map(String::from).collect(),
    }))
}
