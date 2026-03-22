use aus_domain::observation::{LiveObservation, ObservationConfidence};
use aus_sources::intl::eia_petroleum::EiaOilDataPoint;
use aus_sources::intl::un_comtrade::{UnComtradeOilImport, m49_to_iso2};
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

/// Map UN Comtrade oil import records into LiveObservations.
///
/// Each import produces two observations:
/// - One for USD value (`oil.imports.by_source.au.usd`)
/// - One for net weight in kg (`oil.imports.by_source.au.kg`)
pub fn map_comtrade_oil_imports(imports: Vec<UnComtradeOilImport>) -> Vec<LiveObservation> {
    let now = Utc::now();
    let mut observations = Vec::with_capacity(imports.len() * 2);

    for imp in imports {
        let iso2 = m49_to_iso2(imp.partner_code);
        let country_code = if iso2 == "XX" {
            // Fall back to partner name for unmapped codes
            imp.partner_name.clone()
        } else {
            iso2.to_string()
        };

        let base = LiveObservation {
            series_id: String::new(),
            region_code: "AU".to_string(),
            date: imp.period.clone(),
            value: Decimal::ZERO,
            unit: String::new(),
            source_name: "UN Comtrade".to_string(),
            source_url: "https://comtradeapi.un.org".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some(country_code.clone()),
            market: None,
            metric_family: Some("petroleum_trade".to_string()),
            currency: None,
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: Some("oil-comtrade-v1".to_string()),
        };

        // USD value observation
        let mut usd_obs = base.clone();
        usd_obs.series_id = format!("oil.imports.by_source.{}.usd", country_code.to_lowercase());
        usd_obs.value = Decimal::from_f64(imp.value_usd).unwrap_or_default();
        usd_obs.unit = "usd".to_string();
        usd_obs.currency = Some("USD".to_string());
        observations.push(usd_obs);

        // Weight observation
        let mut kg_obs = base;
        kg_obs.series_id = format!("oil.imports.by_source.{}.kg", country_code.to_lowercase());
        kg_obs.value = Decimal::from_f64(imp.net_weight_kg).unwrap_or_default();
        kg_obs.unit = "kg".to_string();
        observations.push(kg_obs);
    }

    observations
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

    fn sample_comtrade_import(partner_code: i64, partner_name: &str) -> UnComtradeOilImport {
        UnComtradeOilImport {
            partner_code,
            partner_name: partner_name.to_string(),
            hs_code: "2709".to_string(),
            period: "2024".to_string(),
            value_usd: 1_000_000.0,
            net_weight_kg: 500_000.0,
        }
    }

    #[test]
    fn maps_comtrade_imports_to_two_observations_each() {
        let imports = vec![sample_comtrade_import(682, "Saudi Arabia")];
        let obs = map_comtrade_oil_imports(imports);
        assert_eq!(obs.len(), 2);
        assert_eq!(obs[0].series_id, "oil.imports.by_source.sa.usd");
        assert_eq!(obs[0].unit, "usd");
        assert_eq!(obs[0].currency, Some("USD".to_string()));
        assert_eq!(obs[1].series_id, "oil.imports.by_source.sa.kg");
        assert_eq!(obs[1].unit, "kg");
    }

    #[test]
    fn comtrade_sets_correct_metadata() {
        let imports = vec![sample_comtrade_import(682, "Saudi Arabia")];
        let obs = map_comtrade_oil_imports(imports);
        let o = &obs[0];
        assert_eq!(o.region_code, "AU");
        assert_eq!(o.source_name, "UN Comtrade");
        assert_eq!(o.country_code, Some("SA".to_string()));
        assert_eq!(o.metric_family, Some("petroleum_trade".to_string()));
        assert_eq!(
            o.methodology_version,
            Some("oil-comtrade-v1".to_string())
        );
    }

    #[test]
    fn comtrade_unknown_partner_uses_name() {
        let imports = vec![sample_comtrade_import(9999, "Atlantis")];
        let obs = map_comtrade_oil_imports(imports);
        assert_eq!(obs[0].country_code, Some("Atlantis".to_string()));
    }
}
