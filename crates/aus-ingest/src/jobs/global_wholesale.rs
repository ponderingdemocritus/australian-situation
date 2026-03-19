use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-global-wholesale-daily: starting");

    // ENTSO-E Europe
    let entsoe_url = super::source_url("entsoe_wholesale");
    let entsoe_points = aus_sources::intl::entsoe::fetch_wholesale(client, &entsoe_url).await?;
    let entsoe_obs = mappers::energy::map_entsoe_wholesale(entsoe_points);

    // EIA US (returns both retail and wholesale; we only take wholesale here)
    let eia_url = super::source_url("eia_electricity");
    let (_retail, wholesale) = aus_sources::intl::eia::fetch_electricity(client, &eia_url).await?;
    let eia_obs = mappers::energy::map_eia_wholesale(wholesale);

    // NEA China
    let nea_points = aus_sources::intl::nea_china::fetch_wholesale_proxy(client).await?;
    let nea_obs = mappers::energy::map_nea_china_wholesale(nea_points);

    let mut all_observations = entsoe_obs;
    all_observations.extend(eia_obs);
    all_observations.extend(nea_obs);

    let obs_models = super::to_db_observations(&all_observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-global-wholesale-daily: upserted {inserted} observations");
    Ok(())
}
