use aus_domain::observation::{LiveObservation, ObservationConfidence};
use aus_sources::intl::eia_petroleum::EiaOilDataPoint;
use aus_sources::intl::jodi_oil::JodiOilDataPoint;
use aus_sources::intl::wits_trade::{WitsTradeImport, iso3_to_iso2};
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

/// Map JODI Oil data points into LiveObservations.
///
/// Maps JODI flow codes to the same series IDs used by EIA, so JODI data
/// supplements/updates EIA data with more recent observations.
pub fn map_jodi_oil_points(points: Vec<JodiOilDataPoint>) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .filter_map(|p| {
            let series_id = match p.flow.as_str() {
                "INDPROD" => "oil.production.crude.au.kbd",
                "TOTIMPSB" => "oil.imports.total.au.kbd",
                "TOTEXPSB" => "oil.exports.total.au.kbd",
                "REFINOBS" => "oil.consumption.total.au.kbd",
                _ => return None,
            };

            Some(LiveObservation {
                series_id: series_id.to_string(),
                region_code: "AU".to_string(),
                date: p.period,
                value: Decimal::from_f64(p.value_kbd).unwrap_or_default(),
                unit: "kbd".to_string(),
                source_name: "JODI".to_string(),
                source_url: "https://www.jodidata.org".to_string(),
                published_at: now,
                ingested_at: now,
                vintage: "latest".to_string(),
                is_modeled: false,
                confidence: ObservationConfidence::Official,
                country_code: Some("AU".to_string()),
                market: None,
                metric_family: Some("petroleum".to_string()),
                currency: None,
                interval_start_utc: None,
                interval_end_utc: None,
                tax_status: None,
                consumption_band: None,
                methodology_version: Some("oil-jodi-primary-v1".to_string()),
            })
        })
        .collect()
}

/// Map WITS fuel import records into LiveObservations.
///
/// Each import produces one observation for USD value.
/// Values are converted from thousands of USD to USD.
pub fn map_wits_fuel_imports(imports: Vec<WitsTradeImport>) -> Vec<LiveObservation> {
    let now = Utc::now();

    imports
        .into_iter()
        .filter_map(|imp| {
            let iso2 = iso3_to_iso2(&imp.partner_code);
            if iso2 == "XX" {
                return None; // Skip unmapped partner codes
            }

            let value_usd = imp.value_thousand_usd * 1000.0;

            Some(LiveObservation {
                series_id: format!("oil.imports.by_source.{}.usd", iso2.to_lowercase()),
                region_code: "AU".to_string(),
                date: imp.period,
                value: Decimal::from_f64(value_usd).unwrap_or_default(),
                unit: "usd".to_string(),
                source_name: "World Bank WITS".to_string(),
                source_url: "https://wits.worldbank.org".to_string(),
                published_at: now,
                ingested_at: now,
                vintage: "latest".to_string(),
                is_modeled: false,
                confidence: ObservationConfidence::Official,
                country_code: Some(iso2.to_string()),
                market: None,
                metric_family: Some("petroleum_trade".to_string()),
                currency: Some("USD".to_string()),
                interval_start_utc: None,
                interval_end_utc: None,
                tax_status: None,
                consumption_band: None,
                methodology_version: Some("oil-wits-trade-v1".to_string()),
            })
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

    fn sample_wits_import(partner_code: &str) -> WitsTradeImport {
        WitsTradeImport {
            partner_code: partner_code.to_string(),
            partner_name: partner_code.to_string(),
            product_code: "27-27_Fuels".to_string(),
            period: "2023".to_string(),
            value_thousand_usd: 1000.0,
        }
    }

    #[test]
    fn maps_wits_imports_to_one_observation_each() {
        let imports = vec![sample_wits_import("SGP")];
        let obs = map_wits_fuel_imports(imports);
        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].series_id, "oil.imports.by_source.sg.usd");
        assert_eq!(obs[0].unit, "usd");
        assert_eq!(obs[0].currency, Some("USD".to_string()));
    }

    #[test]
    fn wits_converts_thousands_to_usd() {
        let imports = vec![sample_wits_import("KOR")];
        let obs = map_wits_fuel_imports(imports);
        // 1000 * 1000 = 1_000_000
        let value: f64 = obs[0].value.to_string().parse().unwrap();
        assert!((value - 1_000_000.0).abs() < 0.01);
    }

    #[test]
    fn wits_sets_correct_metadata() {
        let imports = vec![sample_wits_import("KOR")];
        let obs = map_wits_fuel_imports(imports);
        let o = &obs[0];
        assert_eq!(o.region_code, "AU");
        assert_eq!(o.source_name, "World Bank WITS");
        assert_eq!(o.country_code, Some("KR".to_string()));
        assert_eq!(o.metric_family, Some("petroleum_trade".to_string()));
        assert_eq!(
            o.methodology_version,
            Some("oil-wits-trade-v1".to_string())
        );
    }

    #[test]
    fn wits_skips_unknown_partner_codes() {
        let imports = vec![sample_wits_import("ZZZ")];
        let obs = map_wits_fuel_imports(imports);
        assert!(obs.is_empty());
    }

    fn sample_jodi_point(flow: &str) -> JodiOilDataPoint {
        JodiOilDataPoint {
            country_code: "AU".to_string(),
            period: "2025-06".to_string(),
            product: "CRUDEOIL".to_string(),
            flow: flow.to_string(),
            value_kbd: 250.0,
        }
    }

    #[test]
    fn maps_jodi_production() {
        let obs = map_jodi_oil_points(vec![sample_jodi_point("INDPROD")]);
        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].series_id, "oil.production.crude.au.kbd");
    }

    #[test]
    fn maps_jodi_imports() {
        let obs = map_jodi_oil_points(vec![sample_jodi_point("TOTIMPSB")]);
        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].series_id, "oil.imports.total.au.kbd");
    }

    #[test]
    fn maps_jodi_exports() {
        let obs = map_jodi_oil_points(vec![sample_jodi_point("TOTEXPSB")]);
        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].series_id, "oil.exports.total.au.kbd");
    }

    #[test]
    fn maps_jodi_refinery_to_consumption() {
        let obs = map_jodi_oil_points(vec![sample_jodi_point("REFINOBS")]);
        assert_eq!(obs.len(), 1);
        assert_eq!(obs[0].series_id, "oil.consumption.total.au.kbd");
    }

    #[test]
    fn jodi_skips_unknown_flows() {
        let obs = map_jodi_oil_points(vec![sample_jodi_point("UNKNOWN")]);
        assert!(obs.is_empty());
    }

    #[test]
    fn jodi_sets_correct_metadata() {
        let obs = map_jodi_oil_points(vec![sample_jodi_point("INDPROD")]);
        let o = &obs[0];
        assert_eq!(o.region_code, "AU");
        assert_eq!(o.unit, "kbd");
        assert_eq!(o.source_name, "JODI");
        assert_eq!(o.source_url, "https://www.jodidata.org");
        assert_eq!(o.country_code, Some("AU".to_string()));
        assert_eq!(o.metric_family, Some("petroleum".to_string()));
        assert_eq!(
            o.methodology_version,
            Some("oil-jodi-primary-v1".to_string())
        );
        assert!(!o.is_modeled);
        assert_eq!(o.confidence, ObservationConfidence::Official);
    }
}
