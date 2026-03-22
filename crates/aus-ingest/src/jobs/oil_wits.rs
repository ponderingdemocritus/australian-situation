use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-oil-wits-trade-annual: starting");

    let imports = aus_sources::intl::wits_trade::fetch_fuel_imports(client).await?;

    tracing::info!(
        "sync-oil-wits-trade-annual: fetched {} import records",
        imports.len()
    );

    let observations = mappers::oil::map_wits_fuel_imports(imports);
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;

    tracing::info!("sync-oil-wits-trade-annual: upserted {inserted} observations");
    Ok(())
}
