use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

use crate::mappers;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-global-wholesale-daily: starting");

    let mut all_observations = Vec::new();

    // ENTSO-E Europe (requires API key; best-effort)
    let entsoe_url = super::source_url("entsoe_wholesale");
    match aus_sources::intl::entsoe::fetch_wholesale(client, &entsoe_url).await {
        Ok(points) => all_observations.extend(mappers::energy::map_entsoe_wholesale(points)),
        Err(e) => tracing::warn!("ENTSO-E fetch failed (non-fatal): {e}"),
    }

    // EIA US (requires API key; best-effort)
    let eia_url = super::source_url("eia_electricity");
    match aus_sources::intl::eia::fetch_electricity(client, &eia_url).await {
        Ok((_retail, wholesale)) => {
            all_observations.extend(mappers::energy::map_eia_wholesale(wholesale));
        }
        Err(e) => tracing::warn!("EIA fetch failed (non-fatal): {e}"),
    }

    // NEA China
    match aus_sources::intl::nea_china::fetch_wholesale_proxy(client).await {
        Ok(points) => {
            all_observations.extend(mappers::energy::map_nea_china_wholesale(points));
        }
        Err(e) => tracing::warn!("NEA China fetch failed (non-fatal): {e}"),
    }

    let obs_models = super::to_db_observations(&all_observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-global-wholesale-daily: upserted {inserted} observations");
    Ok(())
}
