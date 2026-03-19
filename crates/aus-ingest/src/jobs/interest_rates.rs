use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-interest-rates-daily: starting");
    let points = aus_sources::au::rba::fetch_rates(client).await?;
    let observations = mappers::housing::map_rba_rates(points);
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-interest-rates-daily: upserted {inserted} observations");
    Ok(())
}
