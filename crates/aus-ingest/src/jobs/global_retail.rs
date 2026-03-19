use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-global-retail-daily: starting");

    // Eurostat
    let eurostat_url = super::source_url("eurostat_retail");
    let eurostat_points = aus_sources::intl::eurostat::fetch_retail(client, &eurostat_url).await?;
    let eurostat_obs = mappers::energy::map_eurostat_retail(eurostat_points);

    // EIA US retail
    let eia_url = super::source_url("eia_electricity");
    let (eia_retail, _wholesale) =
        aus_sources::intl::eia::fetch_electricity(client, &eia_url).await?;
    let eia_obs = mappers::energy::map_eia_retail(eia_retail);

    // PLN Indonesia
    let pln_points = aus_sources::intl::pln::fetch_tariff(client).await?;
    let pln_obs = mappers::energy::map_pln_retail(pln_points);

    // Beijing China
    let beijing_points = aus_sources::intl::beijing::fetch_tariff(client).await?;
    let beijing_obs = mappers::energy::map_beijing_residential(beijing_points);

    let mut all_observations = eia_obs;
    all_observations.extend(eurostat_obs);
    all_observations.extend(pln_obs);
    all_observations.extend(beijing_obs);

    let obs_models = super::to_db_observations(&all_observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-global-retail-daily: upserted {inserted} observations");
    Ok(())
}
