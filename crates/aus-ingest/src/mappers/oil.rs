use aus_domain::observation::{LiveObservation, ObservationConfidence};
use aus_sources::intl::eia_petroleum::EiaOilDataPoint;
use chrono::Utc;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;

pub fn map_eia_oil_points(points: Vec<EiaOilDataPoint>) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| {
            let is_au = p.country_region_id == "AUS";
            let series_id = match (p.activity_id, is_au) {
                (1, true) => "oil.production.crude.au.kbd",
                (1, false) => "oil.production.crude.country.kbd",
                (2, _) => "oil.consumption.total.au.kbd",
                (3, true) => "oil.imports.total.au.kbd",
                (3, false) => "oil.imports.total.country.kbd",
                (4, _) => "oil.exports.total.au.kbd",
                _ => "oil.other",
            };

            let country_code = match p.country_region_id.as_str() {
                "AUS" => "AU",
                "USA" => "US",
                "SAU" => "SA",
                "ARE" => "AE",
                "MYS" => "MY",
                "PNG" => "PG",
                other => other,
            };

            LiveObservation {
                series_id: series_id.to_string(),
                region_code: country_code.to_string(),
                date: p.period,
                value: Decimal::from_f64(p.value).unwrap_or_default(),
                unit: "kbd".to_string(),
                source_name: "EIA".to_string(),
                source_url: "https://api.eia.gov".to_string(),
                published_at: now,
                ingested_at: now,
                vintage: "latest".to_string(),
                is_modeled: false,
                confidence: ObservationConfidence::Official,
                country_code: Some(country_code.to_string()),
                market: None,
                metric_family: Some("petroleum".to_string()),
                currency: None,
                interval_start_utc: None,
                interval_end_utc: None,
                tax_status: None,
                consumption_band: None,
                methodology_version: Some("oil-eia-international-v1".to_string()),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_point(country: &str, activity: u32) -> EiaOilDataPoint {
        EiaOilDataPoint {
            country_region_id: country.to_string(),
            country_region_name: "Test Country".to_string(),
            period: "2025-09".to_string(),
            activity_id: activity,
            activity_name: "Test Activity".to_string(),
            product_id: 57,
            product_name: "Crude oil".to_string(),
            value: 302.456,
            unit: "TBPD".to_string(),
        }
    }

    #[test]
    fn maps_aus_production_to_au_series() {
        let points = vec![sample_point("AUS", 1)];
        let obs = map_eia_oil_points(points);
        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].series_id, "oil.production.crude.au.kbd");
        assert_eq!(obs[0].region_code, "AU");
    }

    #[test]
    fn maps_non_aus_production_to_country_series() {
        let points = vec![sample_point("USA", 1)];
        let obs = map_eia_oil_points(points);
        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].series_id, "oil.production.crude.country.kbd");
        assert_eq!(obs[0].region_code, "US");
    }

    #[test]
    fn maps_all_activity_types() {
        let points = vec![
            sample_point("AUS", 1),
            sample_point("AUS", 2),
            sample_point("AUS", 3),
            sample_point("AUS", 4),
            sample_point("USA", 1),
            sample_point("USA", 3),
        ];
        let obs = map_eia_oil_points(points);
        assert_eq!(obs.len(), 6);
        assert_eq!(obs[0].series_id, "oil.production.crude.au.kbd");
        assert_eq!(obs[1].series_id, "oil.consumption.total.au.kbd");
        assert_eq!(obs[2].series_id, "oil.imports.total.au.kbd");
        assert_eq!(obs[3].series_id, "oil.exports.total.au.kbd");
        assert_eq!(obs[4].series_id, "oil.production.crude.country.kbd");
        assert_eq!(obs[5].series_id, "oil.imports.total.country.kbd");
    }

    #[test]
    fn sets_correct_metadata() {
        let points = vec![sample_point("AUS", 1)];
        let obs = map_eia_oil_points(points);
        let o = &obs[0];
        assert_eq!(o.unit, "kbd");
        assert_eq!(o.source_name, "EIA");
        assert_eq!(o.source_url, "https://api.eia.gov");
        assert_eq!(o.vintage, "latest");
        assert!(!o.is_modeled);
        assert_eq!(o.confidence, ObservationConfidence::Official);
        assert_eq!(o.country_code, Some("AU".to_string()));
        assert_eq!(o.metric_family, Some("petroleum".to_string()));
        assert_eq!(
            o.methodology_version,
            Some("oil-eia-international-v1".to_string())
        );
    }
}
