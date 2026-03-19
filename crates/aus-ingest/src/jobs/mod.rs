pub mod cpi;
pub mod energy_generation_mix;
pub mod energy_nem_mix;
pub mod energy_retail;
pub mod energy_wem_mix;
pub mod energy_wholesale;
pub mod global_retail;
pub mod global_wholesale;
pub mod housing;
pub mod interest_rates;
pub mod major_goods;
pub mod normalization;

use aus_domain::observation::LiveObservation;
use aus_sources::fetch::SourceFetch;
use sqlx::PgPool;

pub struct JobDefinition {
    pub name: &'static str,
    pub cron: &'static str,
}

pub fn job_registry() -> Vec<JobDefinition> {
    vec![
        JobDefinition {
            name: "sync-energy-wholesale-5m",
            cron: "0 */5 * * * *",
        },
        JobDefinition {
            name: "sync-energy-nem-mix-5m",
            cron: "0 */5 * * * *",
        },
        JobDefinition {
            name: "sync-energy-wem-mix-5m",
            cron: "0 */5 * * * *",
        },
        JobDefinition {
            name: "sync-energy-retail-daily",
            cron: "0 0 6 * * *",
        },
        JobDefinition {
            name: "sync-energy-generation-mix-daily",
            cron: "0 0 7 * * *",
        },
        JobDefinition {
            name: "sync-housing-daily",
            cron: "0 0 8 * * *",
        },
        JobDefinition {
            name: "sync-cpi-daily",
            cron: "0 0 8 * * *",
        },
        JobDefinition {
            name: "sync-interest-rates-daily",
            cron: "0 0 9 * * *",
        },
        JobDefinition {
            name: "sync-global-retail-daily",
            cron: "0 0 10 * * *",
        },
        JobDefinition {
            name: "sync-global-wholesale-daily",
            cron: "0 0 10 * * *",
        },
        JobDefinition {
            name: "sync-normalization-daily",
            cron: "0 0 11 * * *",
        },
        JobDefinition {
            name: "sync-major-goods-daily",
            cron: "0 0 12 * * *",
        },
    ]
}

/// Run a named job.
pub async fn run_job(
    name: &str,
    pool: &PgPool,
    client: &(impl SourceFetch + ?Sized),
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match name {
        "sync-energy-wholesale-5m" => energy_wholesale::run(pool, client).await,
        "sync-energy-nem-mix-5m" => energy_nem_mix::run(pool, client).await,
        "sync-energy-wem-mix-5m" => energy_wem_mix::run(pool, client).await,
        "sync-energy-retail-daily" => energy_retail::run(pool, client).await,
        "sync-energy-generation-mix-daily" => energy_generation_mix::run(pool, client).await,
        "sync-housing-daily" => housing::run(pool, client).await,
        "sync-cpi-daily" => cpi::run(pool, client).await,
        "sync-interest-rates-daily" => interest_rates::run(pool, client).await,
        "sync-global-retail-daily" => global_retail::run(pool, client).await,
        "sync-global-wholesale-daily" => global_wholesale::run(pool, client).await,
        "sync-normalization-daily" => normalization::run(pool, client).await,
        "sync-major-goods-daily" => major_goods::run(pool, client).await,
        _ => Err(format!("Unknown job: {name}").into()),
    }
}

/// Convert a slice of `LiveObservation` into `aus_db::models::Observation`.
pub fn to_db_observations(observations: &[LiveObservation]) -> Vec<aus_db::models::Observation> {
    observations
        .iter()
        .map(|o| aus_db::models::Observation {
            id: uuid::Uuid::new_v4(),
            series_id: o.series_id.clone(),
            region_code: o.region_code.clone(),
            country_code: o.country_code.clone(),
            market: o.market.clone(),
            metric_family: o.metric_family.clone(),
            date: o.date.clone(),
            interval_start_utc: o.interval_start_utc,
            interval_end_utc: o.interval_end_utc,
            value: o.value,
            unit: o.unit.clone(),
            currency: o.currency.clone(),
            tax_status: o.tax_status.clone(),
            consumption_band: o.consumption_band.clone(),
            source_name: o.source_name.clone(),
            source_url: o.source_url.clone(),
            published_at: o.published_at,
            ingested_at: o.ingested_at,
            vintage: o.vintage.clone(),
            is_modeled: o.is_modeled,
            confidence: format!("{:?}", o.confidence).to_lowercase(),
            methodology_version: o.methodology_version.clone(),
        })
        .collect()
}

/// Look up a source URL from the domain catalog.
pub fn source_url(source_id: &str) -> String {
    aus_domain::source::source_catalog()
        .into_iter()
        .find(|s| s.source_id == source_id)
        .map(|s| s.url)
        .unwrap_or_default()
}
