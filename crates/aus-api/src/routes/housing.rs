use axum::Json;
use axum::extract::{Query, State};
use sqlx::PgPool;

use crate::dto::*;
use crate::error::AppError;

#[utoipa::path(
    get,
    path = "/api/housing/overview",
    params(("region" = Option<String>, Query, description = "Region code (default AU)")),
    responses((status = 200, body = HousingOverviewResponse))
)]
pub async fn overview(
    State(pool): State<PgPool>,
    Query(params): Query<RegionQuery>,
) -> Result<Json<HousingOverviewResponse>, AppError> {
    let region = params.region.as_deref().unwrap_or("AU");
    let required = aus_domain::series::HOUSING_OVERVIEW_REQUIRED_SERIES_IDS;

    let series_refs: Vec<&str> = required.to_vec();
    let observations =
        aus_db::queries::observations::list_by_series_ids(&pool, &series_refs, region).await?;

    let mut metrics = Vec::new();
    let mut missing = Vec::new();
    let mut latest_updated: Option<String> = None;

    for &sid in required {
        if let Some(obs) = observations.iter().find(|o| o.series_id == sid) {
            let val = obs.value.to_string().parse::<f64>().unwrap_or(0.0);
            metrics.push(HousingMetric {
                series_id: sid.to_string(),
                date: obs.date.clone(),
                value: val,
            });
            let ts = obs.published_at.to_rfc3339();
            if latest_updated.as_ref().is_none_or(|l| ts > *l) {
                latest_updated = Some(ts);
            }
        } else {
            missing.push(sid.to_string());
        }
    }

    Ok(Json(HousingOverviewResponse {
        region: region.to_string(),
        required_series_ids: required.iter().map(|s| s.to_string()).collect(),
        missing_series_ids: missing,
        metrics,
        updated_at: latest_updated,
    }))
}
