use axum::Json;
use axum::extract::{Query, State};
use sqlx::PgPool;

use crate::dto::*;
use crate::error::AppError;

fn parse_region(region: &str) -> Result<String, AppError> {
    let upper = region.to_uppercase();
    aus_domain::region::RegionCode::parse(&upper)?;
    Ok(upper)
}

fn source_refs(ids: &[&str]) -> Vec<SourceRef> {
    let catalog = aus_domain::source::source_catalog();
    ids.iter()
        .filter_map(|source_id| catalog.iter().find(|item| item.source_id == *source_id))
        .map(|item| SourceRef {
            source_id: item.source_id.clone(),
            name: item.name.clone(),
            url: item.url.clone(),
        })
        .collect()
}

fn observation_value(observation: Option<&aus_db::models::Observation>) -> f64 {
    observation
        .map(|item| item.value.to_string().parse::<f64>().unwrap_or(0.0))
        .unwrap_or(0.0)
}

fn freshness_status_label(status: aus_domain::freshness::FreshnessStatus) -> String {
    match status {
        aus_domain::freshness::FreshnessStatus::Fresh => "fresh".to_string(),
        aus_domain::freshness::FreshnessStatus::Stale => "stale".to_string(),
    }
}

fn build_oil_metric_point(
    obs: Option<&aus_db::models::Observation>,
    region: &str,
) -> Option<OilMetricPoint> {
    obs.map(|o| OilMetricPoint {
        period: o.date.clone(),
        value_kbd: observation_value(Some(o)),
        country_code: o
            .country_code
            .clone()
            .unwrap_or_else(|| region.to_string()),
    })
}

const OIL_SERIES_PRODUCTION: &str = "oil.production.crude.au.kbd";
const OIL_SERIES_IMPORTS: &str = "oil.imports.total.au.kbd";
const OIL_SERIES_EXPORTS: &str = "oil.exports.total.au.kbd";
const OIL_SERIES_CONSUMPTION: &str = "oil.consumption.total.au.kbd";

#[utoipa::path(
    get,
    path = "/api/oil/overview",
    params(
        ("region" = Option<String>, Query, description = "Region code (default AU)"),
    ),
    responses((status = 200, body = OilOverviewResponse))
)]
pub async fn overview(
    State(pool): State<PgPool>,
    Query(params): Query<OilOverviewQuery>,
) -> Result<Json<OilOverviewResponse>, AppError> {
    let region = parse_region(params.region.as_deref().unwrap_or("AU"))?;

    let production =
        aus_db::queries::observations::latest_by_series(&pool, OIL_SERIES_PRODUCTION, &region)
            .await?;
    let imports =
        aus_db::queries::observations::latest_by_series(&pool, OIL_SERIES_IMPORTS, &region)
            .await?;
    let exports =
        aus_db::queries::observations::latest_by_series(&pool, OIL_SERIES_EXPORTS, &region)
            .await?;
    let consumption =
        aus_db::queries::observations::latest_by_series(&pool, OIL_SERIES_CONSUMPTION, &region)
            .await?;

    let latest_ingested = [
        production.as_ref(),
        imports.as_ref(),
        exports.as_ref(),
        consumption.as_ref(),
    ]
    .iter()
    .filter_map(|o| o.map(|obs| obs.ingested_at))
    .max();

    let freshness = aus_domain::freshness::compute_freshness(
        "oil_petroleum",
        "monthly",
        latest_ingested,
    );

    Ok(Json(OilOverviewResponse {
        region: region.clone(),
        source_refs: source_refs(&["eia_petroleum"]),
        production: build_oil_metric_point(production.as_ref(), &region),
        imports: build_oil_metric_point(imports.as_ref(), &region),
        exports: build_oil_metric_point(exports.as_ref(), &region),
        consumption: build_oil_metric_point(consumption.as_ref(), &region),
        freshness: FreshnessInfo {
            updated_at: latest_ingested.map(|ts| ts.to_rfc3339()),
            status: freshness_status_label(freshness.status),
        },
    }))
}

#[utoipa::path(
    get,
    path = "/api/oil/timeseries",
    params(
        ("series_id" = Option<String>, Query, description = "Oil series ID (e.g. oil.production.kbd)"),
        ("region" = Option<String>, Query, description = "Region code (default AU)"),
    ),
    responses((status = 200, body = OilTimeSeriesResponse))
)]
pub async fn timeseries(
    State(pool): State<PgPool>,
    Query(params): Query<OilTimeSeriesQuery>,
) -> Result<Json<OilTimeSeriesResponse>, AppError> {
    let series_id = params.series_id.as_deref().ok_or_else(|| {
        AppError::bad_request("MISSING_SERIES_ID", "series_id query parameter is required")
    })?;
    let region = parse_region(params.region.as_deref().unwrap_or("AU"))?;

    let observations =
        aus_db::queries::observations::list_by_series(&pool, series_id, &region).await?;

    let latest_ingested = observations.first().map(|o| o.ingested_at);

    let freshness = aus_domain::freshness::compute_freshness(
        "oil_petroleum",
        "monthly",
        latest_ingested,
    );

    let points: Vec<OilTimeSeriesPoint> = observations
        .iter()
        .map(|o| OilTimeSeriesPoint {
            period: o.date.clone(),
            value_kbd: o.value.to_string().parse::<f64>().unwrap_or(0.0),
        })
        .collect();

    Ok(Json(OilTimeSeriesResponse {
        series_id: series_id.to_string(),
        region: region.clone(),
        points,
        source_refs: source_refs(&["eia_petroleum"]),
        freshness: FreshnessInfo {
            updated_at: latest_ingested.map(|ts| ts.to_rfc3339()),
            status: freshness_status_label(freshness.status),
        },
    }))
}
