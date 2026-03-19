//! Snapshot queries.

use sqlx::PgPool;

use crate::models::RawSnapshotRow;

/// Insert a raw snapshot (skip on duplicate source + checksum).
pub async fn insert(pool: &PgPool, snapshot: &RawSnapshotRow) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO raw_snapshots (
            snapshot_id, source_id, checksum_sha256, captured_at, content_type, payload
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (source_id, checksum_sha256) DO NOTHING"#,
    )
    .bind(&snapshot.snapshot_id)
    .bind(&snapshot.source_id)
    .bind(&snapshot.checksum_sha256)
    .bind(snapshot.captured_at)
    .bind(&snapshot.content_type)
    .bind(&snapshot.payload)
    .execute(pool)
    .await?;
    Ok(())
}
