use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-global-retail-daily: starting");

    let mut all_observations = Vec::new();

    // Eurostat
    let eurostat_url = super::source_url("eurostat_retail");
    match aus_sources::intl::eurostat::fetch_retail(client, &eurostat_url).await {
        Ok(points) => all_observations.extend(mappers::energy::map_eurostat_retail(points)),
        Err(e) => tracing::warn!("Eurostat fetch failed (non-fatal): {e}"),
    }

    // EIA US retail (requires API key; best-effort)
    let eia_url = super::source_url("eia_electricity");
    match aus_sources::intl::eia::fetch_electricity(client, &eia_url).await {
        Ok((retail, _wholesale)) => {
            all_observations.extend(mappers::energy::map_eia_retail(retail));
        }
        Err(e) => tracing::warn!("EIA fetch failed (non-fatal): {e}"),
    }

    // PLN Indonesia
    match aus_sources::intl::pln::fetch_tariff(client).await {
        Ok(points) => all_observations.extend(mappers::energy::map_pln_retail(points)),
        Err(e) => tracing::warn!("PLN fetch failed (non-fatal): {e}"),
    }

    // Beijing China
    match aus_sources::intl::beijing::fetch_tariff(client).await {
        Ok(points) => {
            all_observations.extend(mappers::energy::map_beijing_residential(points));
        }
        Err(e) => tracing::warn!("Beijing fetch failed (non-fatal): {e}"),
    }

    let obs_models = super::to_db_observations(&all_observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-global-retail-daily: upserted {inserted} observations");
    Ok(())
}
