use aus_domain::observation::{LiveObservation, ObservationConfidence};
use aus_sources::fetch::SourceFetch;
use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use sqlx::PgPool;

pub async fn run(
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("sync-energy-generation-mix-daily: starting");
    let url = super::source_url("dcceew_generation_mix");
    let points = aus_sources::au::dcceew::fetch_generation_mix(client, &url).await?;
    let now = Utc::now();
    let observations: Vec<LiveObservation> = points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: format!("energy.generation_mix.{}", p.source_key),
            region_code: p.region_code,
            date: p.year,
            value: Decimal::from_f64(p.generation_gwh).unwrap_or_default(),
            unit: "GWh".to_string(),
            source_name: "DCCEEW".to_string(),
            source_url: url.clone(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("AU".to_string()),
            market: None,
            metric_family: Some("energy.generation_mix".to_string()),
            currency: None,
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: None,
        })
        .collect();
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-energy-generation-mix-daily: upserted {inserted} observations");
    Ok(())
}
