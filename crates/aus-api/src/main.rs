mod app;
mod auth;
mod dto;
mod error;
mod openapi;
mod routes;

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let pool = aus_db::pool::create_pool()
        .await
        .expect("Failed to create database pool");

    let app = app::create_app(pool);

    let port = std::env::var("API_PORT").unwrap_or_else(|_| "3002".to_string());
    let addr = format!("0.0.0.0:{port}");
    tracing::info!("aus-api listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
