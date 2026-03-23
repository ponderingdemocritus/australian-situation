pub mod models;
pub mod pool;
pub mod queries;

/// Run all SQL migrations in order. Safe to call on every startup —
/// each migration is guarded by IF NOT EXISTS / idempotent DDL.
pub async fn run_migrations(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())")
        .execute(pool)
        .await?;

    let migration_files: &[(&str, &str)] = &[
        ("20240101000000_initial", include_str!("../migrations/20240101000000_initial.sql")),
        ("20240201000000_observations_extra_cols", include_str!("../migrations/20240201000000_observations_extra_cols.sql")),
        ("20240301000000_ingestion_runs_extra_cols", include_str!("../migrations/20240301000000_ingestion_runs_extra_cols.sql")),
        ("20240401000000_price_warehouse", include_str!("../migrations/20240401000000_price_warehouse.sql")),
        ("20240501000000_products_extra_cols", include_str!("../migrations/20240501000000_products_extra_cols.sql")),
    ];

    for (name, sql) in migration_files {
        let already_applied: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM _migrations WHERE name = $1)")
            .bind(name)
            .fetch_one(pool)
            .await?;

        if !already_applied {
            tracing::info!("applying migration: {name}");
            // Execute each statement individually (sqlx doesn't support multi-statement in one query)
            for statement in sql.split(';') {
                let trimmed = statement.trim();
                if !trimmed.is_empty() {
                    sqlx::query(trimmed).execute(pool).await?;
                }
            }
            sqlx::query("INSERT INTO _migrations (name) VALUES ($1)")
                .bind(name)
                .execute(pool)
                .await?;
        }
    }

    tracing::info!("migrations complete");
    Ok(())
}
