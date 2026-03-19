use axum::Json;
use axum::extract::{Query, State};
use sqlx::PgPool;

use crate::dto::*;
use crate::error::AppError;

#[utoipa::path(
    get,
    path = "/api/prices/major-goods",
    params(("region" = Option<String>, Query, description = "Region code (default AU)")),
    responses((status = 200, body = PriceIndexOverviewResponse)),
    security(("basic" = []))
)]
pub async fn major_goods(
    State(pool): State<PgPool>,
    Query(params): Query<RegionQuery>,
) -> Result<Json<PriceIndexOverviewResponse>, AppError> {
    let region = params.region.as_deref().unwrap_or("AU");

    let series_ids = aus_domain::series::PRICE_INDEX_SERIES_IDS;
    let series_refs: Vec<&str> = series_ids.to_vec();
    let observations =
        aus_db::queries::observations::list_by_series_ids(&pool, &series_refs, region).await?;

    let mut indexes = Vec::new();
    let mut latest_updated: Option<String> = None;

    for &sid in series_ids {
        if let Some(obs) = observations.iter().find(|o| o.series_id == sid) {
            indexes.push(PriceIndexItem {
                series_id: sid.to_string(),
                label: sid.to_string(),
                date: obs.date.clone(),
                value: obs.value.to_string().parse::<f64>().unwrap_or(0.0),
            });
            let ts = obs.published_at.to_rfc3339();
            if latest_updated.as_ref().is_none_or(|l| ts > *l) {
                latest_updated = Some(ts);
            }
        }
    }

    Ok(Json(PriceIndexOverviewResponse {
        region: region.to_string(),
        methodology_version: "prices-major-goods-v1".to_string(),
        method_summary: "Major goods price tracking".to_string(),
        source_refs: vec![SourceRef {
            source_id: "major_goods_prices".to_string(),
            name: "Major Goods".to_string(),
            url: String::new(),
        }],
        indexes,
        freshness: FreshnessInfo {
            updated_at: latest_updated,
            status: "fresh".to_string(),
        },
    }))
}

#[utoipa::path(
    get,
    path = "/api/prices/ai-deflation",
    params(("region" = Option<String>, Query, description = "Region code (default AU)")),
    responses((status = 200, body = PriceIndexOverviewResponse)),
    security(("basic" = []))
)]
pub async fn ai_deflation(
    State(pool): State<PgPool>,
    Query(params): Query<RegionQuery>,
) -> Result<Json<PriceIndexOverviewResponse>, AppError> {
    let region = params.region.as_deref().unwrap_or("AU");

    let series_ids = aus_domain::series::AI_DEFLATION_SERIES_IDS;
    let series_refs: Vec<&str> = series_ids.to_vec();
    let observations =
        aus_db::queries::observations::list_by_series_ids(&pool, &series_refs, region).await?;

    let mut indexes = Vec::new();
    let mut latest_updated: Option<String> = None;

    for &sid in series_ids {
        if let Some(obs) = observations.iter().find(|o| o.series_id == sid) {
            indexes.push(PriceIndexItem {
                series_id: sid.to_string(),
                label: sid.to_string(),
                date: obs.date.clone(),
                value: obs.value.to_string().parse::<f64>().unwrap_or(0.0),
            });
            let ts = obs.published_at.to_rfc3339();
            if latest_updated.as_ref().is_none_or(|l| ts > *l) {
                latest_updated = Some(ts);
            }
        }
    }

    Ok(Json(PriceIndexOverviewResponse {
        region: region.to_string(),
        methodology_version: "prices-ai-deflation-v1".to_string(),
        method_summary: "AI deflation index".to_string(),
        source_refs: vec![],
        indexes,
        freshness: FreshnessInfo {
            updated_at: latest_updated,
            status: "fresh".to_string(),
        },
    }))
}
