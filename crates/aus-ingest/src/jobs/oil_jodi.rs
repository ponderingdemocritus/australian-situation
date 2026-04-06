use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-oil-jodi-monthly: starting");

    let points = aus_sources::intl::jodi_oil::fetch_jodi_oil(client, &[2024, 2025]).await?;

    tracing::info!(
        "sync-oil-jodi-monthly: fetched {} data points",
        points.len()
    );

    let observations = mappers::oil::map_jodi_oil_points(points);
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;

    tracing::info!("sync-oil-jodi-monthly: upserted {inserted} observations");
    Ok(())
}
