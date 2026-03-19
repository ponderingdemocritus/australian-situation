use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-cpi-daily: starting");
    let points = aus_sources::au::abs::fetch_cpi(client).await?;
    let observations =
        mappers::housing::map_abs_observations(points, "ABS", "https://www.abs.gov.au");
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-cpi-daily: upserted {inserted} observations");
    Ok(())
}
