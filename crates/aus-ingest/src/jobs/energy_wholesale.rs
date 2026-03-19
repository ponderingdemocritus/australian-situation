use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-energy-wholesale-5m: starting");
    let points = aus_sources::au::aemo::fetch_wholesale(client).await?;
    let observations = mappers::energy::map_aemo_wholesale(points);
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-energy-wholesale-5m: upserted {inserted} observations");
    Ok(())
}
