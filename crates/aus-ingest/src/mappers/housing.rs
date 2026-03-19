use aus_domain::observation::{LiveObservation, ObservationConfidence};
use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

pub fn map_abs_observations(
    points: Vec<aus_sources::au::abs::AbsObservation>,
    source_name: &str,
    source_url: &str,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: p.series_id,
            region_code: p.region_code,
            date: p.date,
            value: Decimal::from_f64(p.value).unwrap_or_default(),
            unit: p.unit,
            source_name: source_name.to_string(),
            source_url: source_url.to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("AU".to_string()),
            market: None,
            metric_family: None,
            currency: Some("AUD".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: None,
        })
        .collect()
}

pub fn map_rba_rates(points: Vec<aus_sources::au::rba::RbaRatePoint>) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: p.series_id,
            region_code: "AU".to_string(),
            date: p.date,
            value: Decimal::from_f64(p.value).unwrap_or_default(),
            unit: "percent".to_string(),
            source_name: "RBA".to_string(),
            source_url: "https://www.rba.gov.au".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("AU".to_string()),
            market: None,
            metric_family: None,
            currency: None,
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: None,
        })
        .collect()
}
