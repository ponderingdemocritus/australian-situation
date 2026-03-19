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
    tracing::info!("sync-energy-retail-daily: starting");
    let plans = aus_sources::au::aer::fetch_retail_plans(client).await?;
    let now = Utc::now();
    let observations: Vec<LiveObservation> = plans
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.retail_annual_bill".to_string(),
            region_code: p.region_code,
            date: now.format("%Y-%m-%d").to_string(),
            value: Decimal::from_f64(p.annual_bill_aud).unwrap_or_default(),
            unit: "AUD/year".to_string(),
            source_name: "AER".to_string(),
            source_url: "https://www.aer.gov.au".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("AU".to_string()),
            market: Some("NEM".to_string()),
            metric_family: Some("energy.retail.nominal".to_string()),
            currency: Some("AUD".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: Some(p.customer_type),
            methodology_version: None,
        })
        .collect();
    let obs_models = super::to_db_observations(&observations);
    let (inserted, _updated) =
        aus_db::queries::observations::upsert_batch(pool, &obs_models).await?;
    tracing::info!("sync-energy-retail-daily: upserted {inserted} observations");
    Ok(())
}
