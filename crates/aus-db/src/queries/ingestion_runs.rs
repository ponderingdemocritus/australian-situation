//! Ingestion run queries.

use sqlx::PgPool;

use crate::models::IngestionRunRow;

/// Insert a new ingestion run record.
pub async fn insert(pool: &PgPool, run: &IngestionRunRow) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO ingestion_runs (
            run_id, job, status, started_at, finished_at,
            rows_inserted, rows_updated, error_summary,
            bull_job_id, queue_name, attempt, run_mode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"#,
    )
    .bind(&run.run_id)
    .bind(&run.job)
    .bind(&run.status)
    .bind(run.started_at)
    .bind(run.finished_at)
    .bind(run.rows_inserted)
    .bind(run.rows_updated)
    .bind(&run.error_summary)
    .bind(&run.bull_job_id)
    .bind(&run.queue_name)
    .bind(run.attempt)
    .bind(&run.run_mode)
    .execute(pool)
    .await?;
    Ok(())
}

/// Upsert an ingestion run (update status / counts on conflict).
pub async fn upsert(pool: &PgPool, run: &IngestionRunRow) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO ingestion_runs (
            run_id, job, status, started_at, finished_at,
            rows_inserted, rows_updated, error_summary,
            bull_job_id, queue_name, attempt, run_mode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (run_id) DO UPDATE SET
            status = EXCLUDED.status,
            finished_at = EXCLUDED.finished_at,
            rows_inserted = EXCLUDED.rows_inserted,
            rows_updated = EXCLUDED.rows_updated,
            error_summary = EXCLUDED.error_summary"#,
    )
    .bind(&run.run_id)
    .bind(&run.job)
    .bind(&run.status)
    .bind(run.started_at)
    .bind(run.finished_at)
    .bind(run.rows_inserted)
    .bind(run.rows_updated)
    .bind(&run.error_summary)
    .bind(&run.bull_job_id)
    .bind(&run.queue_name)
    .bind(run.attempt)
    .bind(&run.run_mode)
    .execute(pool)
    .await?;
    Ok(())
}
