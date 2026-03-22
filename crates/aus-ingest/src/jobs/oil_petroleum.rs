use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-oil-eia-petroleum-daily: starting");

    let url = super::source_url("eia_petroleum");
    let points = aus_sources::intl::eia_petroleum::fetch_oil_data(client, &url).await?;
    let observations = mappers::oil::map_eia_oil_points(points);

    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-oil-eia-petroleum-daily: upserted {inserted} observations");
    Ok(())
}
