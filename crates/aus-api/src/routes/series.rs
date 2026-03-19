use axum::Json;
use axum::extract::{Path, Query, State};
use sqlx::PgPool;

use crate::dto::*;
use crate::error::AppError;

#[utoipa::path(
    get,
    path = "/api/series/{id}",
    params(
        ("id" = String, Path, description = "Series identifier"),
        ("region" = Option<String>, Query, description = "Region code (default AU)"),
        ("from" = Option<String>, Query, description = "Start date filter"),
        ("to" = Option<String>, Query, description = "End date filter"),
    ),
    responses((status = 200, body = SeriesResponse))
)]
pub async fn get_series(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    Query(params): Query<SeriesQuery>,
) -> Result<Json<SeriesResponse>, AppError> {
    let region = params.region.as_deref().unwrap_or("AU");
    let observations = aus_db::queries::observations::list_by_series(&pool, &id, region).await?;

    let mut points: Vec<MetricPoint> = observations
        .iter()
        .map(|o| MetricPoint {
            date: o.date.clone(),
            value: o.value.to_string().parse::<f64>().unwrap_or(0.0),
        })
        .collect();

    // Apply date range filters
    if let Some(from) = &params.from {
        points.retain(|p| p.date >= *from);
    }
    if let Some(to) = &params.to {
        points.retain(|p| p.date <= *to);
    }

    Ok(Json(SeriesResponse {
        series_id: id,
        region: region.to_string(),
        points,
    }))
}
