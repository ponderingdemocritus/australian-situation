pub mod models;
pub mod pool;
pub mod queries;

/// Run all SQL migrations in order. Safe to call on every startup.
/// Tolerates "already exists" errors for idempotent bootstrap on existing DBs.
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
            let mut had_error = false;
            for statement in sql.split(';') {
                let trimmed = statement.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match sqlx::query(trimmed).execute(pool).await {
                    Ok(_) => {}
                    Err(sqlx::Error::Database(ref e)) if is_already_exists_error(e.as_ref()) => {
                        tracing::debug!("skipping (already exists): {}", e.message());
                    }
                    Err(e) => {
                        tracing::error!("migration {name} failed: {e}");
                        had_error = true;
                        return Err(e);
                    }
                }
            }
            if !had_error {
                sqlx::query("INSERT INTO _migrations (name) VALUES ($1)")
                    .bind(name)
                    .execute(pool)
                    .await?;
            }
        }
    }

    tracing::info!("migrations complete");
    Ok(())
}

fn is_already_exists_error(e: &dyn sqlx::error::DatabaseError) -> bool {
    // PostgreSQL error codes for "already exists" variants
    // 42701 = duplicate_column, 42P07 = duplicate_table, 42710 = duplicate_object
    matches!(e.code().as_deref(), Some("42701" | "42P07" | "42710"))
}
