use axum::Router;
use axum::middleware;
use axum::routing::get;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;

use crate::openapi::ApiDoc;
use crate::routes;

pub fn create_app(pool: PgPool) -> Router {
    let price_routes = Router::new()
        .route("/major-goods", get(routes::prices::major_goods))
        .route("/ai-deflation", get(routes::prices::ai_deflation))
        .layer(middleware::from_fn(crate::auth::basic_auth));

    Router::new()
        .route("/api/health", get(routes::health::health))
        .route("/api/housing/overview", get(routes::housing::overview))
        .route("/api/series/{id}", get(routes::series::get_series))
        .route(
            "/api/energy/live-wholesale",
            get(routes::energy::live_wholesale),
        )
        .route(
            "/api/energy/retail-average",
            get(routes::energy::retail_average),
        )
        .route("/api/energy/overview", get(routes::energy::overview))
        .route(
            "/api/v1/energy/compare/retail",
            get(routes::energy::retail_comparison),
        )
        .route(
            "/api/v1/energy/compare/wholesale",
            get(routes::energy::wholesale_comparison),
        )
        .nest("/api/prices", price_routes)
        .route("/api/metadata/freshness", get(routes::metadata::freshness))
        .route("/api/metadata/sources", get(routes::metadata::sources))
        .route(
            "/api/v1/metadata/methodology",
            get(routes::metadata::methodology),
        )
        .route("/api/openapi.json", get(openapi_json))
        .route("/api/docs", get(redoc))
        .layer(CorsLayer::permissive())
        .with_state(pool)
}

async fn openapi_json() -> axum::Json<utoipa::openapi::OpenApi> {
    axum::Json(ApiDoc::openapi())
}

async fn redoc() -> axum::response::Html<String> {
    axum::response::Html(
        r#"<!DOCTYPE html>
<html><head><title>AUS Dash API</title></head>
<body><redoc spec-url="/api/openapi.json"></redoc>
<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body></html>"#
            .to_string(),
    )
}
