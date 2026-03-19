use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-normalization-daily: starting");
    let url = super::source_url("world_bank_normalization");
    let points = aus_sources::intl::world_bank::fetch_normalization(client, &url).await?;
    let observations = mappers::energy::map_world_bank_normalization(points);
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-normalization-daily: upserted {inserted} observations");
    Ok(())
}
