//! PgPool creation from DATABASE_URL.

use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

/// Create a PgPool using the `DATABASE_URL` environment variable.
pub async fn create_pool() -> Result<PgPool, sqlx::Error> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
}

/// Create a PgPool from an explicit connection string.
pub async fn create_pool_from_url(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
}
