//! Source queries.

use sqlx::PgPool;

use crate::models::Source;

/// List the full source catalog, ordered by source_id.
pub async fn list_catalog(pool: &PgPool) -> Result<Vec<Source>, sqlx::Error> {
    sqlx::query_as::<_, Source>("SELECT * FROM sources ORDER BY source_id")
        .fetch_all(pool)
        .await
}

/// Upsert a single source row.
pub async fn upsert(pool: &PgPool, source: &Source) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"INSERT INTO sources (source_id, domain, name, url, expected_cadence)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (source_id) DO UPDATE SET
               domain = EXCLUDED.domain,
               name = EXCLUDED.name,
               url = EXCLUDED.url,
               expected_cadence = EXCLUDED.expected_cadence"#,
    )
    .bind(&source.source_id)
    .bind(&source.domain)
    .bind(&source.name)
    .bind(&source.url)
    .bind(&source.expected_cadence)
    .execute(pool)
    .await?;
    Ok(())
}

/// Upsert a batch of sources.
pub async fn upsert_batch(pool: &PgPool, sources: &[Source]) -> Result<(), sqlx::Error> {
    for source in sources {
        upsert(pool, source).await?;
    }
    Ok(())
}
