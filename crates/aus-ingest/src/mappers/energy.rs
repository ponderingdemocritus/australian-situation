use aus_domain::observation::{LiveObservation, ObservationConfidence};
use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

pub fn map_aemo_wholesale(
    points: Vec<aus_sources::au::aemo::AemoWholesalePoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.wholesale_price_5m".to_string(),
            region_code: p.region_code,
            date: p.settlement_date.clone(),
            value: Decimal::from_f64(p.rrp_aud_mwh).unwrap_or_default(),
            unit: "AUD/MWh".to_string(),
            source_name: "AEMO".to_string(),
            source_url: "https://www.nemweb.com.au".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("AU".to_string()),
            market: Some("NEM".to_string()),
            metric_family: Some("energy.wholesale".to_string()),
            currency: Some("AUD".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: None,
        })
        .collect()
}

pub fn map_eia_retail(
    points: Vec<aus_sources::intl::eia::EiaRetailPricePoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.retail_price_local_kwh".to_string(),
            region_code: p.region_code.clone(),
            date: p.period.clone(),
            value: Decimal::from_f64(p.price_usd_kwh).unwrap_or_default(),
            unit: "USD/kWh".to_string(),
            source_name: "EIA".to_string(),
            source_url: "https://api.eia.gov".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("US".to_string()),
            market: None,
            metric_family: Some("energy.retail.nominal".to_string()),
            currency: Some("USD".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: Some("excl_tax".to_string()),
            consumption_band: Some("household_mid".to_string()),
            methodology_version: None,
        })
        .collect()
}

pub fn map_eia_wholesale(
    points: Vec<aus_sources::intl::eia::EiaWholesalePricePoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.wholesale_price_local_mwh".to_string(),
            region_code: p.region_code.clone(),
            date: p.interval_start_utc.clone(),
            value: Decimal::from_f64(p.price_usd_mwh).unwrap_or_default(),
            unit: "USD/MWh".to_string(),
            source_name: "EIA".to_string(),
            source_url: "https://api.eia.gov".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("US".to_string()),
            market: None,
            metric_family: Some("energy.wholesale".to_string()),
            currency: Some("USD".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: None,
        })
        .collect()
}

pub fn map_entsoe_wholesale(
    points: Vec<aus_sources::intl::entsoe::EntsoeWholesalePoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.wholesale_price_local_mwh".to_string(),
            region_code: p.bidding_zone.clone(),
            date: p.interval_start_utc.clone(),
            value: Decimal::from_f64(p.price_eur_mwh).unwrap_or_default(),
            unit: "EUR/MWh".to_string(),
            source_name: "ENTSO-E".to_string(),
            source_url: "https://transparency.entsoe.eu".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some(p.country_code),
            market: None,
            metric_family: Some("energy.wholesale".to_string()),
            currency: Some("EUR".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: None,
        })
        .collect()
}

pub fn map_eurostat_retail(
    points: Vec<aus_sources::intl::eurostat::EurostatRetailPricePoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.retail_price_local_kwh".to_string(),
            region_code: p.country_code.clone(),
            date: p.period.clone(),
            value: Decimal::from_f64(p.price_local_kwh).unwrap_or_default(),
            unit: format!("{}/kWh", p.currency),
            source_name: "Eurostat".to_string(),
            source_url: "https://ec.europa.eu/eurostat".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some(p.country_code),
            market: None,
            metric_family: Some("energy.retail.nominal".to_string()),
            currency: Some(p.currency),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: Some(p.tax_status),
            consumption_band: Some(p.consumption_band),
            methodology_version: None,
        })
        .collect()
}

pub fn map_pln_retail(
    points: Vec<aus_sources::intl::pln::PlnRetailTariffPoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.retail_price_local_kwh".to_string(),
            region_code: "ID".to_string(),
            date: now.format("%Y-%m-%d").to_string(),
            value: Decimal::from_f64(p.price_local_kwh).unwrap_or_default(),
            unit: "IDR/kWh".to_string(),
            source_name: "PLN".to_string(),
            source_url: "https://web.pln.co.id".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("ID".to_string()),
            market: None,
            metric_family: Some("energy.retail.nominal".to_string()),
            currency: Some("IDR".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: Some("incl_tax".to_string()),
            consumption_band: Some(p.consumption_band),
            methodology_version: None,
        })
        .collect()
}

pub fn map_beijing_residential(
    points: Vec<aus_sources::intl::beijing::BeijingResidentialTariffPoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.retail_price_local_kwh".to_string(),
            region_code: "CN".to_string(),
            date: p.period,
            value: Decimal::from_f64(p.price_local_kwh).unwrap_or_default(),
            unit: "CNY/kWh".to_string(),
            source_name: "Beijing DRC".to_string(),
            source_url: "https://fgw.beijing.gov.cn".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Official,
            country_code: Some("CN".to_string()),
            market: None,
            metric_family: Some("energy.retail.nominal".to_string()),
            currency: Some("CNY".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: Some("incl_tax".to_string()),
            consumption_band: Some("household_mid".to_string()),
            methodology_version: None,
        })
        .collect()
}

pub fn map_nea_china_wholesale(
    points: Vec<aus_sources::intl::nea_china::NeaChinaWholesaleProxyPoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| LiveObservation {
            series_id: "energy.wholesale_price_local_mwh".to_string(),
            region_code: "CN".to_string(),
            date: p.period,
            value: Decimal::from_f64(p.price_cny_kwh * 1000.0).unwrap_or_default(),
            unit: "CNY/MWh".to_string(),
            source_name: "NEA".to_string(),
            source_url: "https://fjb.nea.gov.cn".to_string(),
            published_at: now,
            ingested_at: now,
            vintage: "latest".to_string(),
            is_modeled: false,
            confidence: ObservationConfidence::Derived,
            country_code: Some("CN".to_string()),
            market: None,
            metric_family: Some("energy.wholesale".to_string()),
            currency: Some("CNY".to_string()),
            interval_start_utc: None,
            interval_end_utc: None,
            tax_status: None,
            consumption_band: None,
            methodology_version: None,
        })
        .collect()
}

pub fn map_world_bank_normalization(
    points: Vec<aus_sources::intl::world_bank::WorldBankNormalizationPoint>,
) -> Vec<LiveObservation> {
    let now = Utc::now();
    points
        .into_iter()
        .map(|p| {
            let series_id = match p.indicator_code.as_str() {
                "PA.NUS.FCRF" => "normalization.fx_rate",
                "PA.NUS.PPP" => "normalization.ppp_factor",
                _ => "normalization.other",
            };
            LiveObservation {
                series_id: series_id.to_string(),
                region_code: p.country_code.clone(),
                date: p.year,
                value: Decimal::from_f64(p.value).unwrap_or_default(),
                unit: "factor".to_string(),
                source_name: "World Bank".to_string(),
                source_url: "https://api.worldbank.org".to_string(),
                published_at: now,
                ingested_at: now,
                vintage: "latest".to_string(),
                is_modeled: false,
                confidence: ObservationConfidence::Official,
                country_code: Some(p.country_code),
                market: None,
                metric_family: None,
                currency: None,
                interval_start_utc: None,
                interval_end_utc: None,
                tax_status: None,
                consumption_band: None,
                methodology_version: None,
            }
        })
        .collect()
}
