//! Cursor queries.

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use crate::models::SourceCursorRow;

/// Get the cursor for a given source.
pub async fn get_cursor(
    pool: &PgPool,
    source_id: &str,
) -> Result<Option<SourceCursorRow>, sqlx::Error> {
    sqlx::query_as::<_, SourceCursorRow>("SELECT * FROM source_cursors WHERE source_id = $1")
        .bind(source_id)
        .fetch_optional(pool)
        .await
}

/// Set (upsert) the cursor for a given source.
pub async fn set_cursor(
    pool: &PgPool,
    source_id: &str,
    cursor: &str,
    updated_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO source_cursors (source_id, cursor, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (source_id) DO UPDATE SET
               cursor = EXCLUDED.cursor,
               updated_at = EXCLUDED.updated_at"#,
    )
    .bind(source_id)
    .bind(cursor)
    .bind(updated_at)
    .execute(pool)
    .await?;
    Ok(())
}
